// ============================================================
//  SERVER.JS v3 — NovaCare Backend
// ============================================================
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;

function buildConnectionString() {
    const raw = process.env.DATABASE_URL || '';
    if (!raw) { console.error('❌ DATABASE_URL non définie!'); process.exit(1); }
    try {
        const url = new URL(raw);
        url.searchParams.delete('channel_binding');
        url.searchParams.set('sslmode', 'require');
        return url.toString();
    } catch(e) {
        return raw.replace(/[?&]channel_binding=[^&]*/g, '').replace(/[?&]sslmode=[^&]*/g, '') + '?sslmode=require';
    }
}

const pool = new Pool({ connectionString: buildConnectionString(), ssl: { rejectUnauthorized: false } });
pool.connect().then(c => { console.log('✅ PostgreSQL connecté'); c.release(); }).catch(e => console.error('❌ PostgreSQL:', e.message));

app.use(cors({ origin: '*' }));
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));

// ─── Auth middleware ──────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'hopital_secret_2024';

function auth(req, res, next) {
    const header = req.headers['authorization'];
    if (!header) return res.status(401).json({ error: 'Token manquant' });
    try {
        req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' });
    }
}

function adminOrSubAdmin(req, res, next) {
    if (req.user.role !== 'admin' && req.user.role !== 'sub_admin') return res.status(403).json({ error: 'Accès refusé' });
    next();
}
function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès admin requis' });
    next();
}

async function nextCounter(client, name) {
    const r = await client.query('UPDATE counters SET value=value+1 WHERE name=$1 RETURNING value', [name]);
    return r.rows[0].value;
}

// ════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════
app.post('/auth/login', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username || !password || !role) return res.status(400).json({ error: 'Champs manquants' });
        const r = await pool.query('SELECT * FROM users WHERE username=$1 AND role=$2 AND active=TRUE', [username, role]);
        if (!r.rows.length) return res.status(401).json({ error: 'Identifiants incorrects ou compte désactivé' });
        const user = r.rows[0];
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Identifiants incorrects' });
        const token = jwt.sign({ id:user.id, username:user.username, role:user.role, name:user.name }, JWT_SECRET, { expiresIn:'12h' });
        res.json({ token, user: { id:user.id, name:user.name, username:user.username, role:user.role } });
    } catch(err) { console.error(err); res.status(500).json({ error: 'Erreur serveur' }); }
});

// ════════════════════════════════════════════════════════
//  PARAMÈTRES
// ════════════════════════════════════════════════════════
app.get('/settings', auth, async (req, res) => {
    const r = await pool.query('SELECT setting_key,setting_val FROM hospital_settings');
    const obj = {};
    r.rows.forEach(row => obj[row.setting_key] = row.setting_val);
    // Parse JSON fields
    if (obj.subAdminPermissions) try { obj.subAdminPermissions = JSON.parse(obj.subAdminPermissions); } catch(e){}
    res.json(obj);
});

app.put('/settings', auth, adminOnly, async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, address, phone, logo, exchangeRate, subAdminPermissions } = req.body;
        const fields = { name, address, phone, exchangeRate: String(exchangeRate||'130') };
        if (logo) fields.logo = logo;
        if (subAdminPermissions) fields.subAdminPermissions = JSON.stringify(subAdminPermissions);
        for (const [k, v] of Object.entries(fields)) {
            if (v !== undefined) await client.query('INSERT INTO hospital_settings(setting_key,setting_val) VALUES($1,$2) ON CONFLICT(setting_key) DO UPDATE SET setting_val=$2', [k, v]);
        }
        res.json({ success: true });
    } catch(err) { console.error(err); res.status(500).json({ error:'Erreur serveur' }); }
    finally { client.release(); }
});

// ════════════════════════════════════════════════════════
//  UTILISATEURS
// ════════════════════════════════════════════════════════
app.get('/users', auth, async (req, res) => {
    const r = await pool.query('SELECT id,name,role,username,active,created_at FROM users ORDER BY name');
    res.json(r.rows);
});
app.post('/users', auth, adminOnly, async (req, res) => {
    const { name, role, username, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    try {
        const r = await pool.query('INSERT INTO users(name,role,username,password_hash) VALUES($1,$2,$3,$4) RETURNING id,name,role,username,active', [name, role, username, hash]);
        res.status(201).json(r.rows[0]);
    } catch(e) { res.status(400).json({ error: 'Identifiant déjà utilisé' }); }
});
app.put('/users/:id', auth, adminOnly, async (req, res) => {
    const { name, active } = req.body;
    await pool.query('UPDATE users SET name=$1,active=$2 WHERE id=$3', [name, active, req.params.id]);
    res.json({ success: true });
});
app.delete('/users/:id', auth, adminOnly, async (req, res) => {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════
//  PATIENTS
// ════════════════════════════════════════════════════════
app.get('/patients', auth, async (req, res) => {
    const { search, date } = req.query;
    let q = 'SELECT * FROM patients WHERE 1=1';
    const params = [];
    if (search) {
        params.push('%' + search.toLowerCase() + '%');
        q += ` AND (LOWER(full_name) LIKE $\${params.length} OR id LIKE $\${params.length})`;
    }
    if (date) { params.push(date); q += ` AND registration_date=$\${params.length}`; }
    q += ' ORDER BY created_at DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
});

app.get('/patients/:id', auth, async (req, res) => {
    const r = await pool.query('SELECT * FROM patients WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Patient introuvable' });
    res.json(r.rows[0]);
});

app.post('/patients', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { fullName, birthDate, address, phone, responsible, type, externalOnly, consultationTypeId, modifiedConsultation, externalServices } = req.body;
        const ctr = await nextCounter(client, 'patient');
        const pid = 'PAT' + String(ctr).padStart(4, '0');

        await client.query(
            'INSERT INTO patients(id,full_name,birth_date,address,phone,responsible,type,registered_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [pid, fullName, birthDate||null, address, phone, responsible, type, req.user.username]
        );

        if (!externalOnly && consultationTypeId) {
            let service, amount;
            if (modifiedConsultation) {
                service = 'Consultation: ' + modifiedConsultation.name;
                amount  = modifiedConsultation.price;
            } else {
                const ct = await client.query('SELECT * FROM consultation_types WHERE id=$1', [consultationTypeId]);
                if (ct.rows.length) { service = 'Consultation: ' + ct.rows[0].name; amount = ct.rows[0].price; }
            }
            if (service) {
                const tctr = await nextCounter(client, 'transaction');
                const tid  = 'TR' + String(tctr).padStart(4, '0');
                await client.query(
                    `INSERT INTO transactions(id,patient_id,patient_name,service,amount,status,type,created_by) VALUES($1,$2,$3,$4,$5,'unpaid','consultation',$6)`,
                    [tid, pid, fullName, service, amount, req.user.username]
                );
            }
        }

        if (externalServices && externalServices.length) {
            for (const svc of externalServices) {
                const tctr = await nextCounter(client, 'transaction');
                const tid  = 'EXT' + String(tctr).padStart(4, '0');
                await client.query(
                    `INSERT INTO transactions(id,patient_id,patient_name,service,amount,status,type,created_by) VALUES($1,$2,$3,$4,$5,'unpaid','external',$6)`,
                    [tid, pid, fullName, 'Service externe: ' + svc.name, svc.price, req.user.username]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ id: pid });
    } catch(err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

app.put('/patients/:id/privileges', auth, adminOrSubAdmin, async (req, res) => {
    const { privilegeType, discountPercentage } = req.body;
    const patId = req.params.id;
    try {
        if (privilegeType === 'vip') {
            await pool.query('UPDATE patients SET vip=TRUE, sponsored=FALSE, discount_percentage=0 WHERE id=$1', [patId]);
            await pool.query("UPDATE transactions SET status='paid', payment_method='vip', payment_date=CURRENT_DATE, payment_time=CURRENT_TIME, payment_agent=$1 WHERE patient_id=$2 AND status='unpaid'", [req.user.username, patId]);
        } else if (privilegeType === 'sponsored') {
            await pool.query('UPDATE patients SET vip=FALSE, sponsored=TRUE, discount_percentage=$1 WHERE id=$2', [discountPercentage||0, patId]);
        } else {
            await pool.query('UPDATE patients SET vip=FALSE, sponsored=FALSE, discount_percentage=0 WHERE id=$1', [patId]);
        }
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  TRANSACTIONS
// ════════════════════════════════════════════════════════
app.get('/transactions', auth, async (req, res) => {
    const { patientId, status, type, date, fromDate, toDate } = req.query;
    let q = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];
    if (patientId) { params.push(patientId); q += ` AND patient_id=$\${params.length}`; }
    if (status && status !== 'all') { params.push(status); q += ` AND status=$\${params.length}`; }
    if (type)      { params.push(type);      q += ` AND type=$\${params.length}`; }
    if (date)      { params.push(date);      q += ` AND date=$\${params.length}`; }
    if (fromDate)  { params.push(fromDate);  q += ` AND date>=$\${params.length}`; }
    if (toDate)    { params.push(toDate);    q += ` AND date<=$\${params.length}`; }
    q += ' ORDER BY created_at DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
});

app.post('/transactions/pay', auth, async (req, res) => {
    const { transactionIds, paymentMethod } = req.body;
    if (!transactionIds || !transactionIds.length) return res.status(400).json({ error: 'Aucune transaction' });
    await pool.query(
        "UPDATE transactions SET status='paid', payment_method=$1, payment_date=CURRENT_DATE, payment_time=CURRENT_TIME, payment_agent=$2 WHERE id=ANY($3::text[])",
        [paymentMethod, req.user.username, transactionIds]
    );
    res.json({ success: true });
});

app.post('/transactions/add', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { patientId, patientName, service, amount, type, analysisId, medicationId, dosage, quantity } = req.body;
        const prefix = type==='external'?'EXT':type==='lab'?'LAB':type==='medication'?'MED':'TR';
        const ctr = await nextCounter(client, 'transaction');
        const tid = prefix + String(ctr).padStart(4, '0');
        await client.query(
            `INSERT INTO transactions(id,patient_id,patient_name,service,amount,status,type,created_by,analysis_id,medication_id,dosage,quantity) VALUES($1,$2,$3,$4,$5,'unpaid',$6,$7,$8,$9,$10,$11)`,
            [tid, patientId, patientName, service, amount, type, req.user.username, analysisId||null, medicationId||null, dosage||null, quantity||null]
        );
        if (type==='medication' && medicationId && quantity) {
            await client.query('UPDATE medications SET reserved=reserved+$1 WHERE id=$2', [quantity, medicationId]);
        }
        await client.query('COMMIT');
        res.status(201).json({ id: tid });
    } catch(err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
    finally { client.release(); }
});

// Admin: modifier une transaction
app.put('/transactions/:id', auth, adminOrSubAdmin, async (req, res) => {
    const { service, amount, status, paymentMethod, type } = req.body;
    try {
        await pool.query(
            'UPDATE transactions SET service=COALESCE($1,service), amount=COALESCE($2,amount), status=COALESCE($3,status), payment_method=COALESCE($4,payment_method), type=COALESCE($5,type) WHERE id=$6',
            [service||null, amount||null, status||null, paymentMethod||null, type||null, req.params.id]
        );
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Admin: supprimer une transaction
app.delete('/transactions/:id', auth, adminOrSubAdmin, async (req, res) => {
    await pool.query('DELETE FROM transactions WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

app.put('/transactions/:id/lab-result', auth, async (req, res) => {
    const { result } = req.body;
    await pool.query("UPDATE transactions SET result=$1, lab_status='completed' WHERE id=$2", [result, req.params.id]);
    res.json({ success: true });
});

app.put('/transactions/:id/consultation-type', auth, async (req, res) => {
    const { consultationTypeId } = req.body;
    const ct = await pool.query('SELECT * FROM consultation_types WHERE id=$1', [consultationTypeId]);
    if (!ct.rows.length) return res.status(404).json({ error: 'Type introuvable' });
    const { name, price } = ct.rows[0];
    await pool.query(
        "UPDATE transactions SET service=$1, amount=$2, status='unpaid', original_type_id=$3 WHERE id=$4",
        ['Consultation: ' + name, price, consultationTypeId, req.params.id]
    );
    res.json({ success: true });
});

app.put('/transactions/:id/deliver', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query('SELECT * FROM transactions WHERE id=$1', [req.params.id]);
        if (!r.rows.length) throw new Error('Transaction introuvable');
        const tr = r.rows[0];
        if (tr.status !== 'paid') throw new Error('Médicament non payé');
        const med = await client.query('SELECT * FROM medications WHERE id=$1', [tr.medication_id]);
        if (!med.rows.length) throw new Error('Médicament introuvable');
        const m = med.rows[0];
        if (m.quantity < tr.quantity) throw new Error(`Stock insuffisant (dispo: \${m.quantity})`);
        const newReserved = Math.max(0, (m.reserved||0) - tr.quantity);
        await client.query('UPDATE medications SET quantity=quantity-$1, reserved=$2 WHERE id=$3', [tr.quantity, newReserved, tr.medication_id]);
        await client.query("UPDATE transactions SET delivery_status='delivered', delivery_date=CURRENT_DATE, delivery_time=CURRENT_TIME, delivered_by=$1 WHERE id=$2", [req.user.username, req.params.id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch(err) { await client.query('ROLLBACK'); res.status(400).json({ error: err.message }); }
    finally { client.release(); }
});

// ════════════════════════════════════════════════════════
//  SIGNES VITAUX
// ════════════════════════════════════════════════════════
app.get('/vitals/:patientId', auth, async (req, res) => {
    const r = await pool.query('SELECT * FROM vitals WHERE patient_id=$1 ORDER BY date DESC, time DESC', [req.params.patientId]);
    res.json(r.rows);
});
app.post('/vitals', auth, async (req, res) => {
    const { patientId, values } = req.body;
    const r = await pool.query('INSERT INTO vitals(patient_id,taken_by,values) VALUES($1,$2,$3) RETURNING *', [patientId, req.user.username, JSON.stringify(values)]);
    res.status(201).json(r.rows[0]);
});
app.put('/vitals/:id', auth, async (req, res) => {
    const { values } = req.body;
    await pool.query('UPDATE vitals SET values=$1 WHERE id=$2', [JSON.stringify(values), req.params.id]);
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════
//  CONSULTATIONS
// ════════════════════════════════════════════════════════
app.get('/consultations/:patientId', auth, async (req, res) => {
    const r = await pool.query('SELECT * FROM consultations WHERE patient_id=$1 ORDER BY date DESC', [req.params.patientId]);
    res.json(r.rows);
});
app.post('/consultations', auth, async (req, res) => {
    const { patientId, patientName, diagnosis, followupDate, followupTime } = req.body;
    const id = 'CONS' + Date.now();
    const r = await pool.query(
        'INSERT INTO consultations(id,patient_id,patient_name,doctor,diagnosis,followup_date,followup_time) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [id, patientId, patientName, req.user.username, diagnosis, followupDate||null, followupTime||null]
    );
    res.status(201).json(r.rows[0]);
});

// ════════════════════════════════════════════════════════
//  MÉDICAMENTS
// ════════════════════════════════════════════════════════
app.get('/medications', auth, async (req, res) => {
    const r = await pool.query('SELECT * FROM medications ORDER BY name');
    res.json(r.rows);
});
app.post('/medications', auth, async (req, res) => {
    const { name, genericName, form, unit, quantity, alertThreshold, price } = req.body;
    const id = 'MED' + Date.now();
    const r = await pool.query(
        'INSERT INTO medications(id,name,generic_name,form,unit,quantity,alert_threshold,price) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [id, name, genericName, form, unit, quantity, alertThreshold, price]
    );
    res.status(201).json(r.rows[0]);
});
app.put('/medications/:id', auth, async (req, res) => {
    const { quantity, alertThreshold, price, name } = req.body;
    await pool.query('UPDATE medications SET quantity=COALESCE($1,quantity), alert_threshold=COALESCE($2,alert_threshold), price=COALESCE($3,price), name=COALESCE($4,name) WHERE id=$5', [quantity||null, alertThreshold||null, price||null, name||null, req.params.id]);
    res.json({ success: true });
});
app.delete('/medications/:id', auth, adminOnly, async (req, res) => {
    await pool.query('DELETE FROM medications WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════
//  TYPES (consultation, vitaux, labo, externe)
// ════════════════════════════════════════════════════════
app.get('/consultation-types', auth, async (req, res) => { res.json((await pool.query('SELECT * FROM consultation_types ORDER BY id')).rows); });
app.post('/consultation-types', auth, adminOrSubAdmin, async (req, res) => { const { name,price,description }=req.body; res.status(201).json((await pool.query('INSERT INTO consultation_types(name,price,description) VALUES($1,$2,$3) RETURNING *',[name,price,description])).rows[0]); });
app.put('/consultation-types/:id', auth, adminOrSubAdmin, async (req, res) => { const {name,price,description,active}=req.body; await pool.query('UPDATE consultation_types SET name=$1,price=$2,description=$3,active=$4 WHERE id=$5',[name,price,description,active,req.params.id]); res.json({success:true}); });
app.delete('/consultation-types/:id', auth, adminOrSubAdmin, async (req, res) => { await pool.query('DELETE FROM consultation_types WHERE id=$1',[req.params.id]); res.json({success:true}); });

app.get('/vital-types', auth, async (req, res) => { res.json((await pool.query('SELECT * FROM vital_types ORDER BY id')).rows); });
app.post('/vital-types', auth, adminOrSubAdmin, async (req, res) => { const {name,unit,min,max}=req.body; res.status(201).json((await pool.query('INSERT INTO vital_types(name,unit,min,max) VALUES($1,$2,$3,$4) RETURNING *',[name,unit,min,max])).rows[0]); });
app.put('/vital-types/:id', auth, adminOrSubAdmin, async (req, res) => { const {name,unit,min,max,active}=req.body; await pool.query('UPDATE vital_types SET name=$1,unit=$2,min=$3,max=$4,active=$5 WHERE id=$6',[name,unit,min,max,active,req.params.id]); res.json({success:true}); });
app.delete('/vital-types/:id', auth, adminOrSubAdmin, async (req, res) => { await pool.query('DELETE FROM vital_types WHERE id=$1',[req.params.id]); res.json({success:true}); });

app.get('/lab-analysis-types', auth, async (req, res) => { res.json((await pool.query('SELECT * FROM lab_analysis_types ORDER BY id')).rows); });
app.post('/lab-analysis-types', auth, adminOrSubAdmin, async (req, res) => { const {name,price,resultType}=req.body; res.status(201).json((await pool.query('INSERT INTO lab_analysis_types(name,price,result_type) VALUES($1,$2,$3) RETURNING *',[name,price,resultType])).rows[0]); });
app.put('/lab-analysis-types/:id', auth, adminOrSubAdmin, async (req, res) => { const {name,price,active}=req.body; await pool.query('UPDATE lab_analysis_types SET name=$1,price=$2,active=$3 WHERE id=$4',[name,price,active,req.params.id]); res.json({success:true}); });
app.delete('/lab-analysis-types/:id', auth, adminOrSubAdmin, async (req, res) => { await pool.query('DELETE FROM lab_analysis_types WHERE id=$1',[req.params.id]); res.json({success:true}); });

app.get('/external-service-types', auth, async (req, res) => { res.json((await pool.query('SELECT * FROM external_service_types ORDER BY id')).rows); });
app.post('/external-service-types', auth, adminOrSubAdmin, async (req, res) => { const {name,price}=req.body; res.status(201).json((await pool.query('INSERT INTO external_service_types(name,price) VALUES($1,$2) RETURNING *',[name,price])).rows[0]); });
app.put('/external-service-types/:id', auth, adminOrSubAdmin, async (req, res) => { const {name,price,active}=req.body; await pool.query('UPDATE external_service_types SET name=$1,price=$2,active=$3 WHERE id=$4',[name,price,active,req.params.id]); res.json({success:true}); });
app.delete('/external-service-types/:id', auth, adminOrSubAdmin, async (req, res) => { await pool.query('DELETE FROM external_service_types WHERE id=$1',[req.params.id]); res.json({success:true}); });

// ════════════════════════════════════════════════════════
//  RENDEZ-VOUS
// ════════════════════════════════════════════════════════
app.get('/appointments', auth, async (req, res) => {
    const { patientId, doctor, fromDate } = req.query;
    let q = 'SELECT * FROM appointments WHERE 1=1', params = [];
    if (patientId) { params.push(patientId); q+=` AND patient_id=$\${params.length}`; }
    if (doctor)    { params.push(doctor);    q+=` AND doctor=$\${params.length}`; }
    if (fromDate)  { params.push(fromDate);  q+=` AND date>=$\${params.length}`; }
    q += ' ORDER BY date,time';
    res.json((await pool.query(q,params)).rows);
});
app.post('/appointments', auth, async (req, res) => {
    const { patientId,patientName,date,time,reason,doctor } = req.body;
    const r = await pool.query('INSERT INTO appointments(id,patient_id,patient_name,date,time,reason,doctor,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        ['APP'+Date.now(), patientId, patientName, date, time, reason, doctor, req.user.username]);
    res.status(201).json(r.rows[0]);
});
app.put('/appointments/:id', auth, async (req, res) => {
    const { status } = req.body;
    await pool.query('UPDATE appointments SET status=$1 WHERE id=$2',[status,req.params.id]);
    res.json({success:true});
});

// ════════════════════════════════════════════════════════
//  MESSAGERIE
// ════════════════════════════════════════════════════════
app.get('/messages', auth, async (req, res) => {
    // Admin voit tout, autres voient leurs messages
    let q, params;
    if (req.user.role === 'admin' || req.user.role === 'sub_admin') {
        q = 'SELECT * FROM messages WHERE recipient=$1 OR recipient=\'admin\' OR recipient=\'sub_admin\' OR recipient=$1 ORDER BY created_at DESC LIMIT 100';
        params = [req.user.username];
    } else {
        q = 'SELECT * FROM messages WHERE recipient=$1 OR recipient=$2 ORDER BY created_at DESC LIMIT 100';
        params = [req.user.username, req.user.role];
    }
    res.json((await pool.query(q, params)).rows);
});
app.get('/messages/unread-count', auth, async (req, res) => {
    const r = await pool.query('SELECT COUNT(*) FROM messages WHERE (recipient=$1 OR recipient=$2) AND read=FALSE',[req.user.username, req.user.role]);
    res.json({ count: parseInt(r.rows[0].count) });
});
app.post('/messages', auth, async (req, res) => {
    const { recipient, recipientRole, subject, content, type } = req.body;
    const id = 'MSG'+Date.now()+Math.random().toString(36).substr(2,5);
    const r = await pool.query(
        'INSERT INTO messages(id,sender,sender_role,recipient,recipient_role,subject,content,type) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [id, req.user.username, req.user.role, recipient, recipientRole, subject, content, type||'notification']
    );
    res.status(201).json(r.rows[0]);
});
app.put('/messages/:id/read', auth, async (req, res) => {
    await pool.query('UPDATE messages SET read=TRUE WHERE id=$1',[req.params.id]);
    res.json({success:true});
});
app.put('/messages/read-all', auth, async (req, res) => {
    await pool.query('UPDATE messages SET read=TRUE WHERE recipient=$1 OR recipient=$2',[req.user.username, req.user.role]);
    res.json({success:true});
});

// ════════════════════════════════════════════════════════
//  STATISTIQUES (admin + rapports par poste)
// ════════════════════════════════════════════════════════
app.get('/stats', auth, adminOrSubAdmin, async (req, res) => {
    const { fromDate, toDate, role, type } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const monday = new Date(); monday.setDate(monday.getDate() - monday.getDay() + 1);
    const weekStart = monday.toISOString().split('T')[0];

    let txFilter = 'WHERE 1=1';
    const txParams = [];
    if (fromDate) { txParams.push(fromDate); txFilter += ` AND date>=$\${txParams.length}`; }
    if (toDate)   { txParams.push(toDate);   txFilter += ` AND date<=$\${txParams.length}`; }
    if (type && type !== 'all') { txParams.push(type); txFilter += ` AND type=$\${txParams.length}`; }

    const [totalP, todayP, revenue, unpaid, lowStock, recentTx, todayRevenue, weekRevenue, txByType, txByAgent] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM patients'),
        pool.query('SELECT COUNT(*) FROM patients WHERE registration_date=$1',[today]),
        pool.query(`SELECT COALESCE(SUM(amount),0) FROM transactions \${txFilter} AND status='paid'`, txParams),
        pool.query(`SELECT COUNT(*) FROM transactions \${txFilter} AND status='unpaid'`, txParams),
        pool.query('SELECT * FROM medications WHERE quantity<=alert_threshold ORDER BY quantity'),
        pool.query(`SELECT * FROM transactions \${txFilter} ORDER BY created_at DESC LIMIT 50`, txParams),
        pool.query("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE status='paid' AND date=$1",[today]),
        pool.query("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE status='paid' AND date>=$1",[weekStart]),
        pool.query(`SELECT type, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM transactions \${txFilter} AND status='paid' GROUP BY type`, txParams),
        pool.query(`SELECT payment_agent, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM transactions \${txFilter} AND status='paid' AND payment_agent IS NOT NULL GROUP BY payment_agent ORDER BY total DESC`, txParams),
    ]);

    res.json({
        totalPatients:    parseInt(totalP.rows[0].count),
        todayPatients:    parseInt(todayP.rows[0].count),
        totalRevenue:     parseFloat(revenue.rows[0].coalesce),
        todayRevenue:     parseFloat(todayRevenue.rows[0].coalesce),
        weekRevenue:      parseFloat(weekRevenue.rows[0].coalesce),
        unpaidCount:      parseInt(unpaid.rows[0].count),
        lowStock:         lowStock.rows,
        recentTransactions: recentTx.rows,
        byType:           txByType.rows,
        byAgent:          txByAgent.rows,
    });
});

// Fallback SPA
app.get('*', (req, res) => {
    const apiPaths = ['/auth','/patients','/transactions','/settings','/users','/medications','/vitals','/consultations','/messages','/stats','/appointments','/consultation-types','/vital-types','/lab-analysis-types','/external-service-types'];
    if (!apiPaths.some(p => req.path.startsWith(p))) {
        res.sendFile(__dirname + '/index.html');
    }
});

app.listen(PORT, () => console.log(`✅ Serveur NovaCare démarré sur le port \${PORT}`));
