// ============================================================
//  SERVER.JS v4 — NovaCare Backend
// ============================================================
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const { Pool } = require('pg');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'hopital_secret_2024';

// ─── Base de données ──────────────────────────────────────────
function buildDbUrl() {
    const raw = process.env.DATABASE_URL || '';
    if (!raw) { console.error('DATABASE_URL manquante'); process.exit(1); }
    try {
        const u = new URL(raw);
        u.searchParams.delete('channel_binding');
        u.searchParams.set('sslmode', 'require');
        return u.toString();
    } catch(e) {
        return raw.replace(/[?&]channel_binding=[^&]*/g,'').replace(/[?&]sslmode=[^&]*/g,'') + '?sslmode=require';
    }
}
const pool = new Pool({ connectionString: buildDbUrl(), ssl: { rejectUnauthorized: false } });
pool.connect().then(c => { console.log('PostgreSQL OK'); c.release(); }).catch(e => console.error('PostgreSQL ERR:', e.message));

// ─── Middlewares ─────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// ─── Helpers ──────────────────────────────────────────────────
function auth(req, res, next) {
    const h = req.headers['authorization'];
    if (!h) return res.status(401).json({ error: 'Token manquant' });
    try { req.user = jwt.verify(h.split(' ')[1], JWT_SECRET); next(); }
    catch { res.status(401).json({ error: 'Session expirée, reconnectez-vous' }); }
}
function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès admin requis' });
    next();
}
function adminOrSub(req, res, next) {
    if (req.user.role !== 'admin' && req.user.role !== 'sub_admin')
        return res.status(403).json({ error: 'Accès refusé' });
    next();
}
async function nextId(client, name) {
    const r = await client.query('UPDATE counters SET value=value+1 WHERE name=$1 RETURNING value', [name]);
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

        // Connexion patient: chercher dans la table patients
        if (role === 'patient') {
            const r = await pool.query('SELECT * FROM patients WHERE id=$1', [username.toUpperCase()]);
            if (!r.rows.length) return res.status(401).json({ error: 'ID patient introuvable' });
            const p = r.rows[0];
            // Vérifier mot de passe dans la table patient_accounts
            const acc = await pool.query('SELECT * FROM patient_accounts WHERE patient_id=$1 AND active=TRUE', [p.id]);
            if (!acc.rows.length) return res.status(401).json({ error: 'Compte patient non activé. Contactez l\'accueil.' });
            const ok = await bcrypt.compare(password, acc.rows[0].password_hash);
            if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });
            const token = jwt.sign(
                { id: p.id, username: p.id, role: 'patient', name: p.full_name },
                JWT_SECRET, { expiresIn: '12h' }
            );
            return res.json({ token, user: { id: p.id, name: p.full_name, username: p.id, role: 'patient' } });
        }

        // Connexion staff — chercher par username + role (ou role=multi)
        let r = await pool.query(
            'SELECT * FROM users WHERE username=$1 AND role=$2 AND active=TRUE',
            [username, role]
        );
        // Si pas trouvé avec le rôle exact, chercher si c'est un compte multi-rôle
        if (!r.rows.length) {
            r = await pool.query(
                "SELECT * FROM users WHERE username=$1 AND role='multi' AND active=TRUE",
                [username]
            );
            if (r.rows.length) {
                // Vérifier que le rôle demandé fait partie de ses rôles
                const extraRoles = (r.rows[0].extra_roles || '').split(',').map(s => s.trim()).filter(Boolean);
                if (!extraRoles.includes(role)) {
                    return res.status(401).json({ error: 'Vous n\'avez pas accès à ce rôle' });
                }
            }
        }
        if (!r.rows.length)
            return res.status(401).json({ error: 'Identifiants incorrects ou compte désactivé' });
        const ok = await bcrypt.compare(password, r.rows[0].password_hash);
        if (!ok) return res.status(401).json({ error: 'Identifiants incorrects' });
        const u = r.rows[0];
        // Pour un compte multi, le token contient tous ses rôles
        const extraRoles = u.role === 'multi'
            ? (u.extra_roles || '').split(',').map(s => s.trim()).filter(Boolean)
            : [u.role];
        const activeRole = u.role === 'multi' ? role : u.role;
        const token = jwt.sign(
            { id: u.id, username: u.username, role: activeRole, roles: extraRoles, name: u.name },
            JWT_SECRET, { expiresIn: '12h' }
        );
        res.json({
            token,
            user: { id: u.id, name: u.name, username: u.username, role: activeRole, roles: extraRoles }
        });
    } catch(e) { console.error(e); res.status(500).json({ error: 'Erreur serveur' }); }
});

// ════════════════════════════════════════════════════════════
//  PARAMÈTRES
// ════════════════════════════════════════════════════════════
app.get('/settings', auth, async (req, res) => {
    try {
        const r = await pool.query('SELECT setting_key, setting_val FROM hospital_settings');
        const obj = {};
        r.rows.forEach(row => { obj[row.setting_key] = row.setting_val; });
        if (obj.subAdminPermissions) {
            try { obj.subAdminPermissions = JSON.parse(obj.subAdminPermissions); } catch(e) {}
        }
        res.json(obj);
    } catch(e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

app.put('/settings', auth, adminOnly, async (req, res) => {
    try {
        const { name, address, phone, logo, exchangeRate, subAdminPermissions } = req.body;
        const fields = {};
        if (name)         fields.name         = name;
        if (address)      fields.address      = address;
        if (phone)        fields.phone        = phone;
        if (logo)         fields.logo         = logo;
        if (exchangeRate) fields.exchangeRate  = String(exchangeRate);
        if (subAdminPermissions) fields.subAdminPermissions = JSON.stringify(subAdminPermissions);
        for (const [k, v] of Object.entries(fields)) {
            await pool.query(
                'INSERT INTO hospital_settings(setting_key,setting_val) VALUES($1,$2) ON CONFLICT(setting_key) DO UPDATE SET setting_val=$2',
                [k, v]
            );
        }
        res.json({ success: true });
    } catch(e) { console.error(e); res.status(500).json({ error: 'Erreur serveur' }); }
});

// ════════════════════════════════════════════════════════════
//  UTILISATEURS
// ════════════════════════════════════════════════════════════
// ─── COMPTES PATIENTS ─────────────────────────────────────
app.post('/patient-accounts', auth, adminOnly, async (req, res) => {
    try {
        const { patientId, password } = req.body;
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO patient_accounts(patient_id,password_hash,active) VALUES($1,$2,TRUE) ON CONFLICT(patient_id) DO UPDATE SET password_hash=$2,active=TRUE',
            [patientId, hash]
        );
        res.json({ success: true, message: 'Compte patient créé/mis à jour' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/patient-accounts/:patientId', auth, adminOnly, async (req, res) => {
    await pool.query('UPDATE patient_accounts SET active=FALSE WHERE patient_id=$1', [req.params.patientId]);
    res.json({ success: true });
});

app.get('/users', auth, async (req, res) => {
    const r = await pool.query('SELECT id,name,role,username,active FROM users ORDER BY name');
    res.json(r.rows);
});
app.post('/users', auth, adminOnly, async (req, res) => {
    try {
        const { name, role, username, password, extraRoles } = req.body;
        const hash = await bcrypt.hash(password, 10);
        const extraRolesStr = extraRoles ? extraRoles.join(',') : null;
        const r = await pool.query(
            'INSERT INTO users(name,role,username,password_hash,extra_roles) VALUES($1,$2,$3,$4,$5) RETURNING id,name,role,username,active,extra_roles',
            [name, role, username, hash, extraRolesStr]
        );
        res.status(201).json(r.rows[0]);
    } catch(e) { res.status(400).json({ error: 'Identifiant déjà utilisé' }); }
});
app.put('/users/:id', auth, adminOnly, async (req, res) => {
    const { name, active } = req.body;
    await pool.query('UPDATE users SET name=$1, active=$2 WHERE id=$3', [name, active, req.params.id]);
    res.json({ success: true });
});
app.delete('/users/:id', auth, adminOnly, async (req, res) => {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  PATIENTS
// ════════════════════════════════════════════════════════════
app.get('/patients', auth, async (req, res) => {
    try {
        const { search, date } = req.query;
        let q = 'SELECT * FROM patients WHERE 1=1';
        const p = [];
        if (search) {
            p.push('%' + search.toLowerCase() + '%');
            q += ' AND (LOWER(full_name) LIKE $' + p.length + ' OR LOWER(id) LIKE $' + p.length + ')';
        }
        if (date) { p.push(date); q += ' AND registration_date=$' + p.length; }
        q += ' ORDER BY created_at DESC';
        res.json((await pool.query(q, p)).rows);
    } catch(e) { console.error(e); res.status(500).json({ error: 'Erreur serveur' }); }
});

app.get('/patients/:id', auth, async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM patients WHERE id=$1', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'Patient introuvable' });
        res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

app.post('/patients', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { fullName, birthDate, address, phone, responsible, type,
                externalOnly, consultationTypeId, modifiedConsultation, externalServices } = req.body;

        const ctr = await nextId(client, 'patient');
        const pid = 'PAT' + String(ctr).padStart(4, '0');

        await client.query(
            'INSERT INTO patients(id,full_name,birth_date,address,phone,responsible,type,registered_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [pid, fullName, birthDate || null, address, phone, responsible, type, req.user.username]
        );

        if (!externalOnly && consultationTypeId) {
            let svcName, svcPrice;
            if (modifiedConsultation) {
                svcName  = 'Consultation: ' + modifiedConsultation.name;
                svcPrice = modifiedConsultation.price;
            } else {
                const ct = await client.query('SELECT * FROM consultation_types WHERE id=$1', [consultationTypeId]);
                if (ct.rows.length) {
                    svcName  = 'Consultation: ' + ct.rows[0].name;
                    svcPrice = ct.rows[0].price;
                }
            }
            if (svcName) {
                const tctr = await nextId(client, 'transaction');
                const tid  = 'TR' + String(tctr).padStart(4, '0');
                await client.query(
                    "INSERT INTO transactions(id,patient_id,patient_name,service,amount,status,type,created_by) VALUES($1,$2,$3,$4,$5,'unpaid','consultation',$6)",
                    [tid, pid, fullName, svcName, svcPrice, req.user.username]
                );
            }
        }

        if (externalServices && externalServices.length) {
            for (const svc of externalServices) {
                const tctr = await nextId(client, 'transaction');
                const tid  = 'EXT' + String(tctr).padStart(4, '0');
                await client.query(
                    "INSERT INTO transactions(id,patient_id,patient_name,service,amount,status,type,created_by) VALUES($1,$2,$3,$4,$5,'unpaid','external',$6)",
                    [tid, pid, fullName, 'Service: ' + svc.name, svc.price, req.user.username]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ id: pid, fullName });
    } catch(e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

app.put('/patients/:id/privileges', auth, adminOrSub, async (req, res) => {
    try {
        const { privilegeType, discountPercentage } = req.body;
        const id = req.params.id;
        if (privilegeType === 'vip') {
            await pool.query('UPDATE patients SET vip=TRUE,sponsored=FALSE,discount_percentage=0 WHERE id=$1', [id]);
            await pool.query("UPDATE transactions SET status='paid',payment_method='vip',payment_date=CURRENT_DATE,payment_time=CURRENT_TIME,payment_agent=$1 WHERE patient_id=$2 AND status='unpaid'", [req.user.username, id]);
        } else if (privilegeType === 'sponsored') {
            await pool.query('UPDATE patients SET vip=FALSE,sponsored=TRUE,discount_percentage=$1 WHERE id=$2', [discountPercentage || 0, id]);
        } else {
            await pool.query('UPDATE patients SET vip=FALSE,sponsored=FALSE,discount_percentage=0 WHERE id=$1', [id]);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════
//  TRANSACTIONS
// ════════════════════════════════════════════════════════════
app.get('/transactions', auth, async (req, res) => {
    try {
        const { patientId, status, type, date, fromDate, toDate } = req.query;
        let q = 'SELECT * FROM transactions WHERE 1=1';
        const p = [];
        if (patientId) { p.push(patientId); q += ' AND patient_id=$'   + p.length; }
        if (status && status !== 'all') { p.push(status); q += ' AND status=$' + p.length; }
        if (type)      { p.push(type);      q += ' AND type=$'     + p.length; }
        if (date)      { p.push(date);      q += ' AND date=$'     + p.length; }
        if (fromDate)  { p.push(fromDate);  q += ' AND date>=$'    + p.length; }
        if (toDate)    { p.push(toDate);    q += ' AND date<=$'    + p.length; }
        q += ' ORDER BY created_at DESC';
        res.json((await pool.query(q, p)).rows);
    } catch(e) { console.error(e); res.status(500).json({ error: 'Erreur serveur' }); }
});

app.post('/transactions/pay', auth, async (req, res) => {
    try {
        const { transactionIds, paymentMethod } = req.body;
        if (!transactionIds || !transactionIds.length)
            return res.status(400).json({ error: 'Aucune transaction' });
        await pool.query(
            "UPDATE transactions SET status='paid',payment_method=$1,payment_date=CURRENT_DATE,payment_time=CURRENT_TIME,payment_agent=$2 WHERE id=ANY($3::text[])",
            [paymentMethod, req.user.username, transactionIds]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/transactions/add', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { patientId, patientName, service, amount, type,
                analysisId, medicationId, dosage, quantity } = req.body;
        const prefix = type === 'external' ? 'EXT' : type === 'lab' ? 'LAB' : type === 'medication' ? 'MED' : 'TR';
        const ctr = await nextId(client, 'transaction');
        const tid = prefix + String(ctr).padStart(4, '0');
        await client.query(
            "INSERT INTO transactions(id,patient_id,patient_name,service,amount,status,type,created_by,analysis_id,medication_id,dosage,quantity) VALUES($1,$2,$3,$4,$5,'unpaid',$6,$7,$8,$9,$10,$11)",
            [tid, patientId, patientName, service, amount, type, req.user.username,
             analysisId || null, medicationId || null, dosage || null, quantity || null]
        );
        if (type === 'medication' && medicationId && quantity) {
            await client.query('UPDATE medications SET reserved=reserved+$1 WHERE id=$2', [quantity, medicationId]);
        }
        await client.query('COMMIT');
        res.status(201).json({ id: tid });
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

app.put('/transactions/:id', auth, adminOrSub, async (req, res) => {
    try {
        const { service, amount, status, paymentMethod } = req.body;
        const p = [], sets = [];
        if (service)       { p.push(service);        sets.push('service=$'        + p.length); }
        if (amount)        { p.push(amount);          sets.push('amount=$'         + p.length); }
        if (status)        { p.push(status);          sets.push('status=$'         + p.length); }
        if (paymentMethod) { p.push(paymentMethod);   sets.push('payment_method=$' + p.length); }
        if (!sets.length) return res.json({ success: true });
        p.push(req.params.id);
        await pool.query('UPDATE transactions SET ' + sets.join(',') + ' WHERE id=$' + p.length, p);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/transactions/:id', auth, adminOrSub, async (req, res) => {
    await pool.query('DELETE FROM transactions WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

app.put('/transactions/:id/lab-result', auth, async (req, res) => {
    try {
        const { result } = req.body;
        await pool.query("UPDATE transactions SET result=$1,lab_status='completed' WHERE id=$2", [result, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/transactions/:id/consultation-type', auth, async (req, res) => {
    try {
        const { consultationTypeId } = req.body;
        const ct = await pool.query('SELECT * FROM consultation_types WHERE id=$1', [consultationTypeId]);
        if (!ct.rows.length) return res.status(404).json({ error: 'Type introuvable' });
        await pool.query(
            "UPDATE transactions SET service=$1,amount=$2,status='unpaid',original_type_id=$3 WHERE id=$4",
            ['Consultation: ' + ct.rows[0].name, ct.rows[0].price, consultationTypeId, req.params.id]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
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
        if (m.quantity < tr.quantity) throw new Error('Stock insuffisant (dispo: ' + m.quantity + ')');
        const newRes = Math.max(0, (m.reserved || 0) - tr.quantity);
        await client.query('UPDATE medications SET quantity=quantity-$1,reserved=$2 WHERE id=$3', [tr.quantity, newRes, tr.medication_id]);
        await client.query("UPDATE transactions SET delivery_status='delivered',delivery_date=CURRENT_DATE,delivery_time=CURRENT_TIME,delivered_by=$1 WHERE id=$2", [req.user.username, req.params.id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: e.message });
    } finally { client.release(); }
});

// ════════════════════════════════════════════════════════════
//  SIGNES VITAUX
// ════════════════════════════════════════════════════════════
app.get('/vitals/:patientId', auth, async (req, res) => {
    const r = await pool.query('SELECT * FROM vitals WHERE patient_id=$1 ORDER BY date DESC,time DESC', [req.params.patientId]);
    res.json(r.rows);
});
app.post('/vitals', auth, async (req, res) => {
    try {
        const { patientId, values } = req.body;
        const r = await pool.query(
            'INSERT INTO vitals(patient_id,taken_by,values) VALUES($1,$2,$3) RETURNING *',
            [patientId, req.user.username, JSON.stringify(values)]
        );
        res.status(201).json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});
app.put('/vitals/:id', auth, async (req, res) => {
    await pool.query('UPDATE vitals SET values=$1 WHERE id=$2', [JSON.stringify(req.body.values), req.params.id]);
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  CONSULTATIONS
// ════════════════════════════════════════════════════════════
app.get('/consultations/:patientId', auth, async (req, res) => {
    const r = await pool.query('SELECT * FROM consultations WHERE patient_id=$1 ORDER BY date DESC', [req.params.patientId]);
    res.json(r.rows);
});
app.post('/consultations', auth, async (req, res) => {
    try {
        const { patientId, patientName, diagnosis, followupDate, followupTime } = req.body;
        const id = 'CONS' + Date.now();
        const r = await pool.query(
            'INSERT INTO consultations(id,patient_id,patient_name,doctor,diagnosis,followup_date,followup_time) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
            [id, patientId, patientName, req.user.username, diagnosis, followupDate || null, followupTime || null]
        );
        res.status(201).json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════
//  MÉDICAMENTS
// ════════════════════════════════════════════════════════════
app.get('/medications', auth, async (req, res) => {
    res.json((await pool.query('SELECT * FROM medications ORDER BY name')).rows);
});
app.post('/medications', auth, async (req, res) => {
    try {
        const { name, genericName, form, unit, quantity, alertThreshold, price, espace, etagere } = req.body;
        const id = 'MED' + Date.now();
        const r = await pool.query(
            'INSERT INTO medications(id,name,generic_name,form,unit,quantity,alert_threshold,price,espace,etagere) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
            [id, name, genericName||name, form||'Comprimé', unit||'comprimés', quantity, alertThreshold||10, price, espace||null, etagere||null]
        );
        res.status(201).json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});
app.put('/medications/:id', auth, async (req, res) => {
    try {
        const { name, quantity, alertThreshold, price, espace, etagere } = req.body;
        const p = [], sets = [];
        if (name)           { p.push(name);           sets.push('name=$'            + p.length); }
        if (quantity!=null) { p.push(quantity);        sets.push('quantity=$'        + p.length); }
        if (alertThreshold) { p.push(alertThreshold);  sets.push('alert_threshold=$' + p.length); }
        if (price!=null)    { p.push(price);           sets.push('price=$'           + p.length); }
        if (espace!==undefined)  { p.push(espace||null);  sets.push('espace=$'  + p.length); }
        if (etagere!==undefined) { p.push(etagere||null); sets.push('etagere=$' + p.length); }
        if (!sets.length) return res.json({ success: true });
        p.push(req.params.id);
        await pool.query('UPDATE medications SET ' + sets.join(',') + ' WHERE id=$' + p.length, p);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});
app.delete('/medications/:id', auth, adminOnly, async (req, res) => {
    await pool.query('DELETE FROM medications WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  TYPES (consultation, vitaux, labo, externe)
// ════════════════════════════════════════════════════════════
app.get('/consultation-types', auth, async (req, res) => { res.json((await pool.query('SELECT * FROM consultation_types ORDER BY id')).rows); });
app.post('/consultation-types', auth, adminOrSub, async (req, res) => {
    const { name, price, description } = req.body;
    const r = await pool.query('INSERT INTO consultation_types(name,price,description) VALUES($1,$2,$3) RETURNING *', [name, price, description]);
    res.status(201).json(r.rows[0]);
});
app.put('/consultation-types/:id', auth, adminOrSub, async (req, res) => {
    const { name, price, description, active } = req.body;
    await pool.query('UPDATE consultation_types SET name=$1,price=$2,description=$3,active=$4 WHERE id=$5', [name, price, description, active, req.params.id]);
    res.json({ success: true });
});
app.delete('/consultation-types/:id', auth, adminOrSub, async (req, res) => {
    await pool.query('DELETE FROM consultation_types WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

app.get('/vital-types', auth, async (req, res) => { res.json((await pool.query('SELECT * FROM vital_types ORDER BY id')).rows); });
app.post('/vital-types', auth, adminOrSub, async (req, res) => {
    const { name, unit, min, max } = req.body;
    const r = await pool.query('INSERT INTO vital_types(name,unit,min,max) VALUES($1,$2,$3,$4) RETURNING *', [name, unit, min, max]);
    res.status(201).json(r.rows[0]);
});
app.put('/vital-types/:id', auth, adminOrSub, async (req, res) => {
    const { name, unit, min, max, active } = req.body;
    await pool.query('UPDATE vital_types SET name=$1,unit=$2,min=$3,max=$4,active=$5 WHERE id=$6', [name, unit, min, max, active, req.params.id]);
    res.json({ success: true });
});
app.delete('/vital-types/:id', auth, adminOrSub, async (req, res) => {
    await pool.query('DELETE FROM vital_types WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

app.get('/lab-analysis-types', auth, async (req, res) => { res.json((await pool.query('SELECT * FROM lab_analysis_types ORDER BY id')).rows); });
app.post('/lab-analysis-types', auth, adminOrSub, async (req, res) => {
    const { name, price, resultType } = req.body;
    const r = await pool.query('INSERT INTO lab_analysis_types(name,price,result_type) VALUES($1,$2,$3) RETURNING *', [name, price, resultType]);
    res.status(201).json(r.rows[0]);
});
app.put('/lab-analysis-types/:id', auth, adminOrSub, async (req, res) => {
    const { name, price, active } = req.body;
    await pool.query('UPDATE lab_analysis_types SET name=$1,price=$2,active=$3 WHERE id=$4', [name, price, active, req.params.id]);
    res.json({ success: true });
});
app.delete('/lab-analysis-types/:id', auth, adminOrSub, async (req, res) => {
    await pool.query('DELETE FROM lab_analysis_types WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

app.get('/external-service-types', auth, async (req, res) => { res.json((await pool.query('SELECT * FROM external_service_types ORDER BY id')).rows); });
app.post('/external-service-types', auth, adminOrSub, async (req, res) => {
    const { name, price } = req.body;
    const r = await pool.query('INSERT INTO external_service_types(name,price) VALUES($1,$2) RETURNING *', [name, price]);
    res.status(201).json(r.rows[0]);
});
app.put('/external-service-types/:id', auth, adminOrSub, async (req, res) => {
    const { name, price, active } = req.body;
    await pool.query('UPDATE external_service_types SET name=$1,price=$2,active=$3 WHERE id=$4', [name, price, active, req.params.id]);
    res.json({ success: true });
});
app.delete('/external-service-types/:id', auth, adminOrSub, async (req, res) => {
    await pool.query('DELETE FROM external_service_types WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  RENDEZ-VOUS
// ════════════════════════════════════════════════════════════
app.get('/appointments', auth, async (req, res) => {
    try {
        const { patientId, doctor, fromDate } = req.query;
        let q = 'SELECT * FROM appointments WHERE 1=1';
        const p = [];
        if (patientId) { p.push(patientId); q += ' AND patient_id=$' + p.length; }
        if (doctor)    { p.push(doctor);    q += ' AND doctor=$'     + p.length; }
        if (fromDate)  { p.push(fromDate);  q += ' AND date>=$'      + p.length; }
        q += ' ORDER BY date,time';
        res.json((await pool.query(q, p)).rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/appointments', auth, async (req, res) => {
    try {
        const { patientId, patientName, date, time, reason, doctor } = req.body;
        const r = await pool.query(
            'INSERT INTO appointments(id,patient_id,patient_name,date,time,reason,doctor,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
            ['APP' + Date.now(), patientId, patientName, date, time, reason, doctor, req.user.username]
        );
        res.status(201).json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});
app.put('/appointments/:id', auth, async (req, res) => {
    await pool.query('UPDATE appointments SET status=$1 WHERE id=$2', [req.body.status, req.params.id]);
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  MESSAGERIE
// ════════════════════════════════════════════════════════════
app.get('/messages', auth, async (req, res) => {
    try {
        let r;
        if (req.user.role === 'admin' || req.user.role === 'sub_admin') {
            r = await pool.query(
                "SELECT * FROM messages WHERE recipient=$1 OR recipient='admin' OR recipient='sub_admin' ORDER BY created_at DESC LIMIT 100",
                [req.user.username]
            );
        } else if (req.user.role === 'patient') {
            // Patient voit ses messages reçus
            r = await pool.query(
                'SELECT * FROM messages WHERE recipient=$1 OR recipient=$1 ORDER BY created_at DESC LIMIT 50',
                [req.user.username]
            );
        } else {
            r = await pool.query(
                'SELECT * FROM messages WHERE recipient=$1 OR recipient=$2 ORDER BY created_at DESC LIMIT 100',
                [req.user.username, req.user.role]
            );
        }
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/messages/unread-count', auth, async (req, res) => {
    try {
        const r = await pool.query(
            'SELECT COUNT(*) FROM messages WHERE (recipient=$1 OR recipient=$2) AND read=FALSE',
            [req.user.username, req.user.role]
        );
        res.json({ count: parseInt(r.rows[0].count) });
    } catch(e) { res.json({ count: 0 }); }
});
app.post('/messages', auth, async (req, res) => {
    try {
        const { recipient, recipientRole, subject, content, type } = req.body;
        const id = 'MSG' + Date.now() + Math.random().toString(36).substr(2, 5);
        const r = await pool.query(
            'INSERT INTO messages(id,sender,sender_role,recipient,recipient_role,subject,content,type) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
            [id, req.user.username, req.user.role, recipient, recipientRole, subject, content, type || 'notification']
        );
        res.status(201).json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});
app.put('/messages/:id/read', auth, async (req, res) => {
    await pool.query('UPDATE messages SET read=TRUE WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});
app.put('/messages/read-all', auth, async (req, res) => {
    await pool.query('UPDATE messages SET read=TRUE WHERE recipient=$1 OR recipient=$2', [req.user.username, req.user.role]);
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  STATISTIQUES
// ════════════════════════════════════════════════════════════
app.get('/stats', auth, adminOrSub, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const monday = new Date();
        monday.setDate(monday.getDate() - monday.getDay() + 1);
        const weekStart = monday.toISOString().split('T')[0];

        const { fromDate, toDate, type } = req.query;

        // Construire le filtre dynamiquement SANS template literals
        let txFilter = 'WHERE 1=1';
        const txParams = [];
        if (fromDate) { txParams.push(fromDate); txFilter += ' AND date>=$' + txParams.length; }
        if (toDate)   { txParams.push(toDate);   txFilter += ' AND date<=$' + txParams.length; }
        if (type && type !== 'all') { txParams.push(type); txFilter += ' AND type=$' + txParams.length; }

        const [totalP, todayP, revenue, unpaid, lowStock, recentTx,
               todayRev, weekRev, byType, byAgent] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM patients'),
            pool.query('SELECT COUNT(*) FROM patients WHERE registration_date=$1', [today]),
            pool.query("SELECT COALESCE(SUM(amount),0) FROM transactions " + txFilter + " AND status='paid'", txParams),
            pool.query("SELECT COUNT(*) FROM transactions " + txFilter + " AND status='unpaid'", txParams),
            pool.query('SELECT * FROM medications WHERE quantity<=alert_threshold ORDER BY quantity'),
            pool.query("SELECT * FROM transactions " + txFilter + " ORDER BY created_at DESC LIMIT 50", txParams),
            pool.query("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE status='paid' AND date=$1", [today]),
            pool.query("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE status='paid' AND date>=$1", [weekStart]),
            pool.query("SELECT type, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM transactions " + txFilter + " AND status='paid' GROUP BY type", txParams),
            pool.query("SELECT payment_agent, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM transactions " + txFilter + " AND status='paid' AND payment_agent IS NOT NULL GROUP BY payment_agent ORDER BY total DESC", txParams),
        ]);

        res.json({
            totalPatients:      parseInt(totalP.rows[0].count),
            todayPatients:      parseInt(todayP.rows[0].count),
            totalRevenue:       parseFloat(revenue.rows[0].coalesce),
            todayRevenue:       parseFloat(todayRev.rows[0].coalesce),
            weekRevenue:        parseFloat(weekRev.rows[0].coalesce),
            unpaidCount:        parseInt(unpaid.rows[0].count),
            lowStock:           lowStock.rows,
            recentTransactions: recentTx.rows,
            byType:             byType.rows,
            byAgent:            byAgent.rows,
        });
    } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════
//  FICHIERS STATIQUES + FALLBACK SPA
//  IMPORTANT: doit être APRÈS toutes les routes API
// ════════════════════════════════════════════════════════════
app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log('Serveur NovaCare port ' + PORT));
