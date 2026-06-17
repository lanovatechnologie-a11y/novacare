// ============================================================
//  SERVER.JS — Backend Node.js/Express + Neon PostgreSQL
//  Déployable sur Render.com
// ============================================================

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Connexion Neon PostgreSQL ────────────────────────────────
// On nettoie l'URL pour retirer channel_binding qui cause des erreurs
function buildConnectionString() {
    const raw = process.env.DATABASE_URL || '';
    if (!raw) { console.error('❌ DATABASE_URL non définie!'); process.exit(1); }
    // Retirer channel_binding=require et reconstruire proprement
    try {
        const url = new URL(raw);
        url.searchParams.delete('channel_binding');
        url.searchParams.set('sslmode', 'require');
        return url.toString();
    } catch(e) {
        // Fallback si URL invalide
        return raw.replace(/[?&]channel_binding=[^&]*/g, '').replace(/[?&]sslmode=[^&]*/g, '') + '?sslmode=require';
    }
}

const pool = new Pool({
    connectionString: buildConnectionString(),
    ssl: { rejectUnauthorized: false }
});

pool.connect()
    .then(client => { console.log('✅ Connexion PostgreSQL réussie'); client.release(); })
    .catch(err  => { console.error('❌ Erreur PostgreSQL:', err.message); });


// ─── Middlewares ──────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.static(__dirname));   // Sert index.html et fichiers frontend
app.use(express.json({ limit: '10mb' }));   // 10mb pour les images base64

// ─── Auth middleware ──────────────────────────────────────────
function auth(req, res, next) {
    const header = req.headers['authorization'];
    if (!header) return res.status(401).json({ error: 'Token manquant' });
    const token = header.split(' ')[1];
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'hopital_secret_2024');
        next();
    } catch {
        res.status(401).json({ error: 'Token invalide' });
    }
}

function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
    next();
}

// Helper : incrémenter compteur et retourner nouvelle valeur
async function nextCounter(client, name) {
    const r = await client.query(
        'UPDATE counters SET value = value + 1 WHERE name = $1 RETURNING value',
        [name]
    );
    return r.rows[0].value;
}

// ════════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════════
app.post('/auth/login', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username || !password || !role)
            return res.status(400).json({ error: 'Champs manquants' });

        const r = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND role = $2 AND active = TRUE',
            [username, role]
        );
        if (r.rows.length === 0)
            return res.status(401).json({ error: 'Identifiants incorrects ou compte désactivé' });

        const user = r.rows[0];
        const ok   = await bcrypt.compare(password, user.password_hash);
        if (!ok)
            return res.status(401).json({ error: 'Identifiants incorrects' });

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, name: user.name },
            process.env.JWT_SECRET || 'hopital_secret_2024',
            { expiresIn: '12h' }
        );

        res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ════════════════════════════════════════════════════════════
//  PARAMÈTRES HÔPITAL
// ════════════════════════════════════════════════════════════
app.get('/settings', auth, async (req, res) => {
    const r = await pool.query('SELECT setting_key, setting_val FROM hospital_settings');
    const obj = {};
    r.rows.forEach(row => obj[row.setting_key] = row.setting_val);
    res.json(obj);
});

app.put('/settings', auth, adminOnly, async (req, res) => {
    const { name, address, phone, logo } = req.body;
    const updates = { name, address, phone, logo };
    try {
        for (const [k, v] of Object.entries(updates)) {
            if (v !== undefined) {
                await pool.query(
                    'INSERT INTO hospital_settings(setting_key,setting_val) VALUES($1,$2) ON CONFLICT(setting_key) DO UPDATE SET setting_val=$2',
                    [k, v]
                );
            }
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ════════════════════════════════════════════════════════════
//  UTILISATEURS
// ════════════════════════════════════════════════════════════
app.get('/users', auth, adminOnly, async (req, res) => {
    const r = await pool.query('SELECT id,name,role,username,active FROM users ORDER BY id');
    res.json(r.rows);
});

app.post('/users', auth, adminOnly, async (req, res) => {
    const { name, role, username, password } = req.body;
    if (!name || !role || !username || !password)
        return res.status(400).json({ error: 'Champs manquants' });
    try {
        const hash = await bcrypt.hash(password, 10);
        const r = await pool.query(
            'INSERT INTO users(name,role,username,password_hash) VALUES($1,$2,$3,$4) RETURNING id,name,role,username,active',
            [name, role, username, hash]
        );
        res.status(201).json(r.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Nom d\'utilisateur déjà pris' });
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.put('/users/:id', auth, adminOnly, async (req, res) => {
    const { name, active, password } = req.body;
    const id = parseInt(req.params.id);
    try {
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            await pool.query('UPDATE users SET name=$1, active=$2, password_hash=$3 WHERE id=$4', [name, active, hash, id]);
        } else {
            await pool.query('UPDATE users SET name=$1, active=$2 WHERE id=$3', [name, active, id]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.delete('/users/:id', auth, adminOnly, async (req, res) => {
    await pool.query('UPDATE users SET active=FALSE WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  PATIENTS
// ════════════════════════════════════════════════════════════
app.get('/patients', auth, async (req, res) => {
    const { search, date } = req.query;
    let q = 'SELECT * FROM patients WHERE 1=1';
    const params = [];
    if (search) {
        params.push(`%${search}%`);
        q += ` AND (LOWER(full_name) LIKE LOWER($${params.length}) OR LOWER(id) LIKE LOWER($${params.length}))`;
    }
    if (date) {
        params.push(date);
        q += ` AND registration_date = $${params.length}`;
    }
    q += ' ORDER BY created_at DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
});

app.get('/patients/:id', auth, async (req, res) => {
    const r = await pool.query('SELECT * FROM patients WHERE id=$1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Patient non trouvé' });
    res.json(r.rows[0]);
});

app.post('/patients', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const {
            fullName, birthDate, address, phone, responsible,
            type, externalOnly, consultationTypeId, modifiedConsultation, externalServices
        } = req.body;

        const ctr    = await nextCounter(client, 'patient');
        const prefix = type === 'urgence' ? 'URG' : type === 'pediatrie' ? 'PED' : type === 'externe' ? 'EXT' : 'PAT';
        const patId  = prefix + String(ctr).padStart(4, '0');

        await client.query(
            `INSERT INTO patients(id,full_name,birth_date,address,phone,responsible,type,registered_by)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
            [patId, fullName, birthDate || null, address, phone, responsible, type, req.user.username]
        );

        const transactions = [];

        if (externalOnly || type === 'externe') {
            for (const svc of (externalServices || [])) {
                const tid = 'EXT' + String(await nextCounter(client, 'transaction')).padStart(4, '0');
                await client.query(
                    `INSERT INTO transactions(id,patient_id,patient_name,service,amount,status,type,created_by)
                     VALUES($1,$2,$3,$4,$5,'unpaid','external',$6)`,
                    [tid, patId, fullName, `Service externe: ${svc.name}`, svc.price, req.user.username]
                );
                transactions.push({ id: tid, service: svc.name, amount: svc.price });
            }
        } else if (consultationTypeId) {
            const ctRes = await client.query('SELECT * FROM consultation_types WHERE id=$1', [consultationTypeId]);
            if (ctRes.rows.length === 0) throw new Error('Type de consultation invalide');
            let ct = ctRes.rows[0];
            let modName  = null, modPrice = null;
            if (modifiedConsultation) {
                modName  = modifiedConsultation.name;
                modPrice = modifiedConsultation.price;
                ct = { ...ct, name: modName, price: modPrice };
            }
            const tid = 'TR' + String(await nextCounter(client, 'transaction')).padStart(4, '0');
            await client.query(
                `INSERT INTO transactions(id,patient_id,patient_name,service,amount,status,type,created_by,original_type_id,modified_name,modified_price)
                 VALUES($1,$2,$3,$4,$5,'unpaid','consultation',$6,$7,$8,$9)`,
                [tid, patId, fullName, `Consultation: ${ct.name}`, ct.price, req.user.username, consultationTypeId, modName, modPrice]
            );
            transactions.push({ id: tid, service: ct.name, amount: ct.price });
        }

        await client.query('COMMIT');
        res.status(201).json({ id: patId, transactions });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message || 'Erreur serveur' });
    } finally {
        client.release();
    }
});

app.put('/patients/:id/privileges', auth, adminOnly, async (req, res) => {
    const { privilegeType, discountPercentage } = req.body;
    const patId = req.params.id;
    try {
        if (privilegeType === 'vip') {
            await pool.query('UPDATE patients SET vip=TRUE, sponsored=FALSE, discount_percentage=0 WHERE id=$1', [patId]);
            await pool.query(
                `UPDATE transactions SET status='paid', payment_method='vip',
                 payment_date=CURRENT_DATE, payment_time=CURRENT_TIME, payment_agent=$1
                 WHERE patient_id=$2 AND status='unpaid'`,
                [req.user.username, patId]
            );
        } else if (privilegeType === 'sponsored') {
            await pool.query(
                'UPDATE patients SET vip=FALSE, sponsored=TRUE, discount_percentage=$1 WHERE id=$2',
                [discountPercentage || 0, patId]
            );
        } else {
            await pool.query('UPDATE patients SET vip=FALSE, sponsored=FALSE, discount_percentage=0 WHERE id=$1', [patId]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ════════════════════════════════════════════════════════════
//  TRANSACTIONS
// ════════════════════════════════════════════════════════════
app.get('/transactions', auth, async (req, res) => {
    const { patientId, status, type, date } = req.query;
    let q = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];
    if (patientId) { params.push(patientId); q += ` AND patient_id=$${params.length}`; }
    if (status)    { params.push(status);    q += ` AND status=$${params.length}`; }
    if (type)      { params.push(type);      q += ` AND type=$${params.length}`; }
    if (date)      { params.push(date);      q += ` AND date=$${params.length}`; }
    q += ' ORDER BY created_at DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
});

app.post('/transactions/pay', auth, async (req, res) => {
    const { transactionIds, paymentMethod } = req.body;
    if (!transactionIds || transactionIds.length === 0)
        return res.status(400).json({ error: 'Aucune transaction sélectionnée' });
    try {
        await pool.query(
            `UPDATE transactions SET status='paid', payment_method=$1,
             payment_date=CURRENT_DATE, payment_time=CURRENT_TIME, payment_agent=$2
             WHERE id = ANY($3::text[])`,
            [paymentMethod, req.user.username, transactionIds]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/transactions/add', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { patientId, patientName, service, amount, type, analysisId, medicationId, dosage, quantity } = req.body;
        const prefix = type === 'external' ? 'EXT' : type === 'lab' ? 'LAB' : type === 'medication' ? 'MED' : 'TR';
        const ctr = await nextCounter(client, 'transaction');
        const tid = prefix + String(ctr).padStart(4, '0');

        await client.query(
            `INSERT INTO transactions(id,patient_id,patient_name,service,amount,status,type,created_by,analysis_id,medication_id,dosage,quantity)
             VALUES($1,$2,$3,$4,$5,'unpaid',$6,$7,$8,$9,$10,$11)`,
            [tid, patientId, patientName, service, amount, type, req.user.username,
             analysisId || null, medicationId || null, dosage || null, quantity || null]
        );

        // Réserver le stock médicament
        if (type === 'medication' && medicationId && quantity) {
            await client.query(
                'UPDATE medications SET reserved = reserved + $1 WHERE id=$2',
                [quantity, medicationId]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ id: tid });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message || 'Erreur serveur' });
    } finally {
        client.release();
    }
});

// ════════════════════════════════════════════════════════════
//  SIGNES VITAUX
// ════════════════════════════════════════════════════════════
app.get('/vitals/:patientId', auth, async (req, res) => {
    const r = await pool.query(
        'SELECT * FROM vitals WHERE patient_id=$1 ORDER BY date DESC, time DESC',
        [req.params.patientId]
    );
    res.json(r.rows);
});

app.post('/vitals', auth, async (req, res) => {
    const { patientId, values } = req.body;
    try {
        const r = await pool.query(
            'INSERT INTO vitals(patient_id,taken_by,values) VALUES($1,$2,$3) RETURNING *',
            [patientId, req.user.username, JSON.stringify(values)]
        );
        res.status(201).json(r.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.put('/vitals/:id', auth, async (req, res) => {
    const { values } = req.body;
    await pool.query('UPDATE vitals SET values=$1 WHERE id=$2', [JSON.stringify(values), req.params.id]);
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  CONSULTATIONS
// ════════════════════════════════════════════════════════════
app.get('/consultations/:patientId', auth, async (req, res) => {
    const r = await pool.query(
        'SELECT * FROM consultations WHERE patient_id=$1 ORDER BY date DESC',
        [req.params.patientId]
    );
    res.json(r.rows);
});

app.post('/consultations', auth, async (req, res) => {
    const { patientId, patientName, diagnosis, followupDate, followupTime } = req.body;
    const id = 'CONS' + Date.now();
    try {
        const r = await pool.query(
            `INSERT INTO consultations(id,patient_id,patient_name,doctor,diagnosis,followup_date,followup_time)
             VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [id, patientId, patientName, req.user.username, diagnosis, followupDate || null, followupTime || null]
        );
        res.status(201).json(r.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ════════════════════════════════════════════════════════════
//  LAB — résultats
// ════════════════════════════════════════════════════════════
app.put('/transactions/:id/lab-result', auth, async (req, res) => {
    const { result } = req.body;
    await pool.query(
        "UPDATE transactions SET result=$1, lab_status='completed' WHERE id=$2",
        [result, req.params.id]
    );
    res.json({ success: true });
});

app.put('/transactions/:id/consultation-type', auth, async (req, res) => {
    const { consultationTypeId } = req.body;
    const ct = await pool.query('SELECT * FROM consultation_types WHERE id=$1', [consultationTypeId]);
    if (!ct.rows.length) return res.status(404).json({ error: 'Type introuvable' });
    const { name, price } = ct.rows[0];
    await pool.query(
        `UPDATE transactions SET service=$1, amount=$2, status='unpaid', original_type_id=$3 WHERE id=$4`,
        [`Consultation: ${name}`, price, consultationTypeId, req.params.id]
    );
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  PHARMACIE — délivrance
// ════════════════════════════════════════════════════════════
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

        if (m.quantity < tr.quantity) throw new Error(`Stock insuffisant (disponible: ${m.quantity})`);

        // BUGFIX: réservé ne peut pas descendre en dessous de 0
        const newReserved = Math.max(0, (m.reserved || 0) - tr.quantity);
        await client.query(
            'UPDATE medications SET quantity=quantity-$1, reserved=$2 WHERE id=$3',
            [tr.quantity, newReserved, tr.medication_id]
        );

        await client.query(
            `UPDATE transactions SET delivery_status='delivered', delivery_date=CURRENT_DATE,
             delivery_time=CURRENT_TIME, delivered_by=$1 WHERE id=$2`,
            [req.user.username, req.params.id]
        );

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ════════════════════════════════════════════════════════════
//  MÉDICAMENTS
// ════════════════════════════════════════════════════════════
app.get('/medications', auth, async (req, res) => {
    const r = await pool.query('SELECT * FROM medications ORDER BY name');
    res.json(r.rows);
});

app.post('/medications', auth, adminOnly, async (req, res) => {
    const { name, genericName, form, unit, quantity, alertThreshold, price } = req.body;
    const id = 'MED' + Date.now();
    const r = await pool.query(
        'INSERT INTO medications(id,name,generic_name,form,unit,quantity,alert_threshold,price) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [id, name, genericName, form, unit, quantity, alertThreshold, price]
    );
    res.status(201).json(r.rows[0]);
});

app.put('/medications/:id', auth, adminOnly, async (req, res) => {
    const { quantity, alertThreshold, price } = req.body;
    await pool.query(
        'UPDATE medications SET quantity=$1, alert_threshold=$2, price=$3 WHERE id=$4',
        [quantity, alertThreshold, price, req.params.id]
    );
    res.json({ success: true });
});

app.delete('/medications/:id', auth, adminOnly, async (req, res) => {
    await pool.query('DELETE FROM medications WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  TYPES DE CONFIGURATION (consultation, vitaux, lab, externe)
// ════════════════════════════════════════════════════════════

// Consultation types
app.get('/consultation-types', auth, async (req, res) => {
    const r = await pool.query('SELECT * FROM consultation_types ORDER BY id');
    res.json(r.rows);
});
app.post('/consultation-types', auth, adminOnly, async (req, res) => {
    const { name, price, description } = req.body;
    const r = await pool.query('INSERT INTO consultation_types(name,price,description) VALUES($1,$2,$3) RETURNING *', [name, price, description]);
    res.status(201).json(r.rows[0]);
});
app.put('/consultation-types/:id', auth, adminOnly, async (req, res) => {
    const { name, price, description, active } = req.body;
    await pool.query('UPDATE consultation_types SET name=$1,price=$2,description=$3,active=$4 WHERE id=$5', [name, price, description, active, req.params.id]);
    res.json({ success: true });
});
app.delete('/consultation-types/:id', auth, adminOnly, async (req, res) => {
    await pool.query('DELETE FROM consultation_types WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// Vital types
app.get('/vital-types', auth, async (req, res) => {
    const r = await pool.query('SELECT * FROM vital_types ORDER BY id');
    res.json(r.rows);
});
app.post('/vital-types', auth, adminOnly, async (req, res) => {
    const { name, unit, min, max } = req.body;
    const r = await pool.query('INSERT INTO vital_types(name,unit,min,max) VALUES($1,$2,$3,$4) RETURNING *', [name, unit, min, max]);
    res.status(201).json(r.rows[0]);
});
app.put('/vital-types/:id', auth, adminOnly, async (req, res) => {
    const { name, unit, min, max, active } = req.body;
    await pool.query('UPDATE vital_types SET name=$1,unit=$2,min=$3,max=$4,active=$5 WHERE id=$6', [name, unit, min, max, active, req.params.id]);
    res.json({ success: true });
});
app.delete('/vital-types/:id', auth, adminOnly, async (req, res) => {
    await pool.query('DELETE FROM vital_types WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// Lab analysis types
app.get('/lab-analysis-types', auth, async (req, res) => {
    const r = await pool.query('SELECT * FROM lab_analysis_types ORDER BY id');
    res.json(r.rows);
});
app.post('/lab-analysis-types', auth, adminOnly, async (req, res) => {
    const { name, price, resultType } = req.body;
    const r = await pool.query('INSERT INTO lab_analysis_types(name,price,result_type) VALUES($1,$2,$3) RETURNING *', [name, price, resultType]);
    res.status(201).json(r.rows[0]);
});
app.put('/lab-analysis-types/:id', auth, adminOnly, async (req, res) => {
    const { name, price, active } = req.body;
    await pool.query('UPDATE lab_analysis_types SET name=$1,price=$2,active=$3 WHERE id=$4', [name, price, active, req.params.id]);
    res.json({ success: true });
});
app.delete('/lab-analysis-types/:id', auth, adminOnly, async (req, res) => {
    await pool.query('DELETE FROM lab_analysis_types WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// External service types
app.get('/external-service-types', auth, async (req, res) => {
    const r = await pool.query('SELECT * FROM external_service_types ORDER BY id');
    res.json(r.rows);
});
app.post('/external-service-types', auth, adminOnly, async (req, res) => {
    const { name, price } = req.body;
    const r = await pool.query('INSERT INTO external_service_types(name,price) VALUES($1,$2) RETURNING *', [name, price]);
    res.status(201).json(r.rows[0]);
});
app.put('/external-service-types/:id', auth, adminOnly, async (req, res) => {
    const { name, price, active } = req.body;
    await pool.query('UPDATE external_service_types SET name=$1,price=$2,active=$3 WHERE id=$4', [name, price, active, req.params.id]);
    res.json({ success: true });
});
app.delete('/external-service-types/:id', auth, adminOnly, async (req, res) => {
    await pool.query('DELETE FROM external_service_types WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  RENDEZ-VOUS
// ════════════════════════════════════════════════════════════
app.get('/appointments', auth, async (req, res) => {
    const { patientId, doctor, fromDate } = req.query;
    let q = 'SELECT * FROM appointments WHERE 1=1';
    const params = [];
    if (patientId) { params.push(patientId); q += ` AND patient_id=$${params.length}`; }
    if (doctor)    { params.push(doctor);    q += ` AND doctor=$${params.length}`; }
    if (fromDate)  { params.push(fromDate);  q += ` AND date >= $${params.length}`; }
    q += ' ORDER BY date, time';
    const r = await pool.query(q, params);
    res.json(r.rows);
});

app.post('/appointments', auth, async (req, res) => {
    const { patientId, patientName, date, time, reason, doctor } = req.body;
    const id = 'APP' + Date.now();
    const r = await pool.query(
        'INSERT INTO appointments(id,patient_id,patient_name,date,time,reason,doctor,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [id, patientId, patientName, date, time, reason, doctor, req.user.username]
    );
    res.status(201).json(r.rows[0]);
});

app.put('/appointments/:id', auth, async (req, res) => {
    const { status } = req.body;
    await pool.query('UPDATE appointments SET status=$1 WHERE id=$2', [status, req.params.id]);
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  MESSAGERIE
// ════════════════════════════════════════════════════════════
app.get('/messages', auth, async (req, res) => {
    const r = await pool.query(
        'SELECT * FROM messages WHERE recipient=$1 ORDER BY created_at DESC',
        [req.user.username]
    );
    res.json(r.rows);
});

app.get('/messages/unread-count', auth, async (req, res) => {
    const r = await pool.query(
        'SELECT COUNT(*) FROM messages WHERE recipient=$1 AND read=FALSE',
        [req.user.username]
    );
    res.json({ count: parseInt(r.rows[0].count) });
});

app.post('/messages', auth, async (req, res) => {
    const { recipient, recipientRole, subject, content, type } = req.body;
    const id = 'MSG' + Date.now() + Math.random().toString(36).substr(2,5);   // BUGFIX: ID unique
    const r = await pool.query(
        'INSERT INTO messages(id,sender,sender_role,recipient,recipient_role,subject,content,type) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [id, req.user.username, req.user.role, recipient, recipientRole, subject, content, type || 'notification']
    );
    res.status(201).json(r.rows[0]);
});

app.put('/messages/:id/read', auth, async (req, res) => {
    await pool.query('UPDATE messages SET read=TRUE WHERE id=$1 AND recipient=$2', [req.params.id, req.user.username]);
    res.json({ success: true });
});

app.put('/messages/read-all', auth, async (req, res) => {
    await pool.query('UPDATE messages SET read=TRUE WHERE recipient=$1', [req.user.username]);
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  STATISTIQUES ADMIN
// ════════════════════════════════════════════════════════════
app.get('/stats', auth, adminOnly, async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const [
        totalPatients,
        todayPatients,
        totalRevenue,
        unpaidCount,
        lowStock,
        recentTx
    ] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM patients'),
        pool.query('SELECT COUNT(*) FROM patients WHERE registration_date=$1', [today]),
        pool.query("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE status='paid'"),
        pool.query("SELECT COUNT(*) FROM transactions WHERE status='unpaid'"),
        pool.query('SELECT * FROM medications WHERE quantity <= alert_threshold ORDER BY quantity'),
        pool.query('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 20')
    ]);

    res.json({
        totalPatients:  parseInt(totalPatients.rows[0].count),
        todayPatients:  parseInt(todayPatients.rows[0].count),
        totalRevenue:   parseFloat(totalRevenue.rows[0].coalesce),
        unpaidCount:    parseInt(unpaidCount.rows[0].count),
        lowStock:       lowStock.rows,
        recentTransactions: recentTx.rows
    });
});

// ─── Démarrage ────────────────────────────────────────────────
// Fallback → renvoie index.html pour toutes les routes non-API
app.get('*', (req, res) => {
    if (!req.path.startsWith('/auth') && !req.path.startsWith('/patients') && !req.path.startsWith('/transactions') && !req.path.startsWith('/settings') && !req.path.startsWith('/users') && !req.path.startsWith('/medications') && !req.path.startsWith('/vitals') && !req.path.startsWith('/consultations') && !req.path.startsWith('/messages') && !req.path.startsWith('/stats') && !req.path.startsWith('/appointments')) {
        res.sendFile(__dirname + '/index.html');
    }
});

app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}`);
    pool.query('SELECT NOW()').then(() => console.log('✅ Base de données Neon connectée'));
});
