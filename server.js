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

// ─── Migrations légères (ajout de colonnes si absentes) ───────
(async () => {
    try {
        await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS assigned_doctor VARCHAR(120)`);
        await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS assigned_doctor_name VARCHAR(200)`);
        await pool.query(`ALTER TABLE hosp_prescriptions ADD COLUMN IF NOT EXISTS delivered BOOLEAN DEFAULT false`);
        await pool.query(`ALTER TABLE hosp_prescriptions ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP`);
        await pool.query(`ALTER TABLE hosp_prescriptions ADD COLUMN IF NOT EXISTS delivered_by VARCHAR(120)`);
        await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(50)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_receipt ON transactions(receipt_number)`);
        const receiptCounter = await pool.query("SELECT 1 FROM counters WHERE name='receipt'");
        if (!receiptCounter.rows.length) {
            await pool.query("INSERT INTO counters(name, value) VALUES('receipt', 0)");
        }
        console.log('Migration colonnes médecin assigné OK');
    } catch (e) { console.error('Migration ERR:', e.message); }
})();

// ─── Mode Extra (majoration % sur les services) ────────────────
async function getExtraModeInfo() {
    const r = await pool.query(
        `SELECT setting_key, setting_val FROM hospital_settings WHERE setting_key IN ('extraMode','extraModePercentage')`
    );
    let active = false, percentage = 0;
    r.rows.forEach(row => {
        if (row.setting_key === 'extraMode') active = row.setting_val === 'true';
        if (row.setting_key === 'extraModePercentage') percentage = parseFloat(row.setting_val) || 0;
    });
    return { active, percentage, multiplier: active ? (1 + percentage / 100) : 1 };
}
function applyExtraMode(price, role, extraInfo) {
    if (!extraInfo.active) return price;
    if (role === 'admin' || role === 'sub_admin') return price; // l'admin voit toujours le prix de base
    const p = Number(price) || 0;
    return Math.round(p * extraInfo.multiplier * 100) / 100;
}

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
function adminSubOrCashier(req, res, next) {
    if (req.user.role !== 'admin' && req.user.role !== 'sub_admin' && req.user.role !== 'cashier')
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
        const { name, address, phone, logo, exchangeRate, subAdminPermissions, extraMode, extraModePercentage } = req.body;
        const fields = {};
        if (name)         fields.name         = name;
        if (address)      fields.address      = address;
        if (phone)        fields.phone        = phone;
        if (logo)         fields.logo         = logo;
        if (exchangeRate) fields.exchangeRate  = String(exchangeRate);
        if (subAdminPermissions) fields.subAdminPermissions = JSON.stringify(subAdminPermissions);
        if (extraMode !== undefined) fields.extraMode = extraMode ? 'true' : 'false';
        if (extraModePercentage !== undefined) fields.extraModePercentage = String(parseFloat(extraModePercentage) || 0);
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
    try {
        const { name, active, username, role, extraRoles } = req.body;
        const p = [], sets = [];
        if (name     !== undefined) { p.push(name);                    sets.push('name=$'        + p.length); }
        if (active   !== undefined) { p.push(active);                  sets.push('active=$'      + p.length); }
        if (username !== undefined) { p.push(username);                sets.push('username=$'    + p.length); }
        if (role     !== undefined) { p.push(role);                    sets.push('role=$'        + p.length); }
        if (extraRoles !== undefined) {
            p.push(extraRoles && extraRoles.length ? extraRoles.join(',') : null);
            sets.push('extra_roles=$' + p.length);
        }
        if (!sets.length) return res.json({ success: true });
        p.push(req.params.id);
        await pool.query('UPDATE users SET ' + sets.join(',') + ' WHERE id=$' + p.length, p);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Changer mot de passe utilisateur
app.put('/users/:id/password', auth, adminOnly, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court' });
        const hash = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
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
                externalOnly, consultationTypeId, modifiedConsultation, externalServices,
                assignedDoctorUsername, assignedDoctorName } = req.body;

        const ctr = await nextId(client, 'patient');
        const pid = 'PAT' + String(ctr).padStart(4, '0');

        await client.query(
            'INSERT INTO patients(id,full_name,birth_date,address,phone,responsible,type,registered_by,assigned_doctor,assigned_doctor_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
            [pid, fullName, birthDate || null, address, phone, responsible, type, req.user.username, assignedDoctorUsername || null, assignedDoctorName || null]
        );

        const extra = await getExtraModeInfo();

        if (!externalOnly && consultationTypeId) {
            let svcName, svcPrice;
            if (modifiedConsultation) {
                svcName  = 'Consultation: ' + modifiedConsultation.name;
                svcPrice = modifiedConsultation.price;
            } else {
                const ct = await client.query('SELECT * FROM consultation_types WHERE id=$1', [consultationTypeId]);
                if (ct.rows.length) {
                    svcName  = 'Consultation: ' + ct.rows[0].name;
                    svcPrice = applyExtraMode(ct.rows[0].price, req.user.role, extra);
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
        res.status(201).json({ id: pid, fullName, assignedDoctorName: assignedDoctorName || null });
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
    const client = await pool.connect();
    try {
        const { transactionIds, paymentMethod } = req.body;
        if (!transactionIds || !transactionIds.length)
            return res.status(400).json({ error: 'Aucune transaction' });
        await client.query('BEGIN');
        const ctr = await nextId(client, 'receipt');
        const receiptNumber = 'REC-' + String(ctr).padStart(5, '0');
        await client.query(
            "UPDATE transactions SET status='paid',payment_method=$1,payment_date=CURRENT_DATE,payment_time=CURRENT_TIME,payment_agent=$2,receipt_number=$3 WHERE id=ANY($4::text[])",
            [paymentMethod, req.user.username, receiptNumber, transactionIds]
        );
        await client.query('COMMIT');
        res.json({ success: true, receiptNumber });
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// Rechercher un reçu par son numéro
app.get('/transactions/receipt/:receiptNumber', auth, async (req, res) => {
    try {
        const r = await pool.query(
            'SELECT * FROM transactions WHERE receipt_number=$1 ORDER BY id',
            [req.params.receiptNumber.trim().toUpperCase()]
        );
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Lister tous les reçus générés (registre)
app.get('/transactions/receipts', auth, async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;
        const params = [];
        let where = 'receipt_number IS NOT NULL';
        if (fromDate) { params.push(fromDate); where += ` AND date >= $${params.length}`; }
        if (toDate)   { params.push(toDate);   where += ` AND date <= $${params.length}`; }
        const r = await pool.query(
            `SELECT receipt_number, patient_id, patient_name,
                    MIN(date) as date, MIN(payment_time) as payment_time,
                    MIN(payment_method) as payment_method, MIN(payment_agent) as payment_agent,
                    SUM(amount) as total, COUNT(*) as items
             FROM transactions
             WHERE ${where}
             GROUP BY receipt_number, patient_id, patient_name
             ORDER BY MIN(date) DESC NULLS LAST, MIN(payment_time) DESC NULLS LAST
             LIMIT 500`,
            params
        );
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Lister tous les reçus (regroupés) d'un patient donné
app.get('/transactions/receipts-by-patient/:patientId', auth, async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT receipt_number, patient_id, patient_name,
                    MIN(date) as date, MIN(payment_time) as payment_time,
                    MIN(payment_method) as payment_method, SUM(amount) as total, COUNT(*) as items
             FROM transactions
             WHERE patient_id=$1 AND receipt_number IS NOT NULL
             GROUP BY receipt_number, patient_id, patient_name
             ORDER BY MIN(date) DESC NULLS LAST, MIN(payment_time) DESC NULLS LAST`,
            [req.params.patientId.trim().toUpperCase()]
        );
        res.json(r.rows);
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

app.put('/transactions/:id', auth, adminSubOrCashier, async (req, res) => {
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
    const r = await pool.query(
        'SELECT m.*, s.name AS supplier_name FROM medications m LEFT JOIN suppliers s ON s.id=m.supplier_id ORDER BY m.name'
    );
    const extra = await getExtraModeInfo();
    res.json(r.rows.map(row => ({ ...row, price: applyExtraMode(row.price, req.user.role, extra) })));
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
app.get('/consultation-types', auth, async (req, res) => {
    const r = await pool.query('SELECT * FROM consultation_types ORDER BY id');
    const extra = await getExtraModeInfo();
    res.json(r.rows.map(row => ({ ...row, price: applyExtraMode(row.price, req.user.role, extra) })));
});
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

app.get('/lab-analysis-types', auth, async (req, res) => {
    const r = await pool.query('SELECT * FROM lab_analysis_types ORDER BY id');
    const extra = await getExtraModeInfo();
    res.json(r.rows.map(row => ({ ...row, price: applyExtraMode(row.price, req.user.role, extra) })));
});
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

app.get('/external-service-types', auth, async (req, res) => {
    const r = await pool.query('SELECT * FROM external_service_types ORDER BY id');
    const extra = await getExtraModeInfo();
    res.json(r.rows.map(row => ({ ...row, price: applyExtraMode(row.price, req.user.role, extra) })));
});
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
               todayRev, weekRev, byType, byAgent, refundsTotal] = await Promise.all([
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
            pool.query("SELECT COALESCE(SUM(amount),0) FROM refunds WHERE 1=1").catch(function() { return { rows: [{ coalesce: 0 }] }; }),
        ]);

        const totalRefundsAmt = parseFloat(refundsTotal.rows[0].coalesce) || 0;
        res.json({
            totalPatients:      parseInt(totalP.rows[0].count),
            todayPatients:      parseInt(todayP.rows[0].count),
            totalRevenue:       parseFloat(revenue.rows[0].coalesce) - totalRefundsAmt,
            todayRevenue:       parseFloat(todayRev.rows[0].coalesce),
            weekRevenue:        parseFloat(weekRev.rows[0].coalesce),
            unpaidCount:        parseInt(unpaid.rows[0].count),
            totalRefunds:       totalRefundsAmt,
            lowStock:           lowStock.rows,
            recentTransactions: recentTx.rows,
            byType:             byType.rows,
            byAgent:            byAgent.rows,
        });
    } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════
//  FOURNISSEURS
// ════════════════════════════════════════════════════════════

// Liste fournisseurs
app.get('/suppliers', auth, async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM suppliers ORDER BY name');
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Ajouter fournisseur
app.post('/suppliers', auth, adminOnly, async (req, res) => {
    try {
        const { name, phone, email, address, note } = req.body;
        const id = 'SUP' + Date.now();
        const r = await pool.query(
            'INSERT INTO suppliers(id,name,phone,email,address,note,total_debt) VALUES($1,$2,$3,$4,$5,$6,0) RETURNING *',
            [id, name, phone||null, email||null, address||null, note||null]
        );
        res.status(201).json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Modifier fournisseur
app.put('/suppliers/:id', auth, adminOnly, async (req, res) => {
    try {
        const { name, phone, email, address, note } = req.body;
        await pool.query(
            'UPDATE suppliers SET name=$1,phone=$2,email=$3,address=$4,note=$5 WHERE id=$6',
            [name, phone||null, email||null, address||null, note||null, req.params.id]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Supprimer fournisseur
app.delete('/suppliers/:id', auth, adminOnly, async (req, res) => {
    try {
        await pool.query('DELETE FROM suppliers WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── ACHATS FOURNISSEURS ──────────────────────────────────

// Liste achats d'un fournisseur
app.get('/supplier-purchases', auth, async (req, res) => {
    try {
        const { supplierId } = req.query;
        let q = 'SELECT * FROM supplier_purchases WHERE 1=1';
        const p = [];
        if (supplierId) { p.push(supplierId); q += ' AND supplier_id=$' + p.length; }
        q += ' ORDER BY date DESC';
        res.json((await pool.query(q, p)).rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Enregistrer un achat
app.post('/supplier-purchases', auth, adminOnly, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { supplierId, description, totalAmount, amountPaid, paymentType, note,
                medicationId, quantityReceived } = req.body;
        const amountDue = parseFloat(totalAmount) - parseFloat(amountPaid || 0);
        const id = 'PUR' + Date.now();
        const r = await client.query(
            `INSERT INTO supplier_purchases(id,supplier_id,description,total_amount,amount_paid,amount_due,payment_type,note,medication_id,quantity_received,date,created_by)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_DATE,$11) RETURNING *`,
            [id, supplierId, description, totalAmount, amountPaid||0, amountDue, paymentType,
             note||null, medicationId||null, quantityReceived||null, req.user.username]
        );
        // Mettre à jour la dette du fournisseur
        if (amountDue > 0) {
            await client.query(
                'UPDATE suppliers SET total_debt=total_debt+$1 WHERE id=$2',
                [amountDue, supplierId]
            );
        }
        // Mettre à jour le stock du médicament + lier le fournisseur
        if (medicationId && quantityReceived && parseInt(quantityReceived) > 0) {
            await client.query(
                'UPDATE medications SET quantity=quantity+$1, supplier_id=$2 WHERE id=$3',
                [parseInt(quantityReceived), supplierId, medicationId]
            );
        }
        await client.query('COMMIT');
        res.status(201).json(r.rows[0]);
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

// ─── PAIEMENTS PARTIELS ───────────────────────────────────

// Liste des paiements d'un achat
app.get('/supplier-payments', auth, async (req, res) => {
    try {
        const { purchaseId, supplierId } = req.query;
        let q = 'SELECT * FROM supplier_payments WHERE 1=1';
        const p = [];
        if (purchaseId) { p.push(purchaseId); q += ' AND purchase_id=$' + p.length; }
        if (supplierId) { p.push(supplierId); q += ' AND supplier_id=$' + p.length; }
        q += ' ORDER BY date DESC';
        res.json((await pool.query(q, p)).rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Enregistrer un paiement partiel
app.post('/supplier-payments', auth, adminOnly, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { purchaseId, supplierId, amount, note } = req.body;

        // Vérifier la dette restante sur cet achat
        const pur = await client.query('SELECT * FROM supplier_purchases WHERE id=$1', [purchaseId]);
        if (!pur.rows.length) throw new Error('Achat introuvable');
        const purchase = pur.rows[0];
        if (parseFloat(amount) > parseFloat(purchase.amount_due)) {
            throw new Error('Paiement supérieur à la dette restante (' + purchase.amount_due + ' HTG)');
        }

        // Enregistrer le paiement
        const id = 'PAY' + Date.now();
        await client.query(
            'INSERT INTO supplier_payments(id,purchase_id,supplier_id,amount,note,date,created_by) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,$6)',
            [id, purchaseId, supplierId, amount, note||null, req.user.username]
        );

        // Réduire la dette de l'achat
        const newDue = parseFloat(purchase.amount_due) - parseFloat(amount);
        const newPaid = parseFloat(purchase.amount_paid) + parseFloat(amount);
        const status = newDue <= 0 ? 'paid' : 'partial';
        await client.query(
            'UPDATE supplier_purchases SET amount_due=$1, amount_paid=$2, payment_type=$3 WHERE id=$4',
            [Math.max(0, newDue), newPaid, status, purchaseId]
        );

        // Réduire la dette totale du fournisseur
        await client.query(
            'UPDATE suppliers SET total_debt=GREATEST(0,total_debt-$1) WHERE id=$2',
            [amount, supplierId]
        );

        await client.query('COMMIT');
        res.status(201).json({ success: true, remainingDue: Math.max(0, newDue) });
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: e.message });
    } finally { client.release(); }
});

// Supprimer un achat
app.delete('/supplier-purchases/:id', auth, adminOnly, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query('SELECT * FROM supplier_purchases WHERE id=$1', [req.params.id]);
        if (r.rows.length) {
            // Remettre la dette du fournisseur
            await client.query(
                'UPDATE suppliers SET total_debt=GREATEST(0,total_debt-$1) WHERE id=$2',
                [r.rows[0].amount_due, r.rows[0].supplier_id]
            );
        }
        await client.query('DELETE FROM supplier_payments WHERE purchase_id=$1', [req.params.id]);
        await client.query('DELETE FROM supplier_purchases WHERE id=$1', [req.params.id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

// ════════════════════════════════════════════════════════════
//  HOSPITALISATION
// ════════════════════════════════════════════════════════════

// ─── Liste des hospitalisations ──────────────────────────────
app.get('/hospitalizations', auth, async (req, res) => {
    try {
        const { status, patientId } = req.query;
        let q = `SELECT h.*, p.full_name, p.phone, p.birth_date, p.type
                 FROM hospitalizations h
                 JOIN patients p ON p.id = h.patient_id
                 WHERE 1=1`;
        const params = [];
        if (status)    { params.push(status);    q += ' AND h.status=$'    + params.length; }
        if (patientId) { params.push(patientId); q += ' AND h.patient_id=$'+ params.length; }
        q += ' ORDER BY h.admission_date DESC, h.created_at DESC';
        res.json((await pool.query(q, params)).rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/hospitalizations/:id', auth, async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT h.*, p.full_name, p.phone, p.birth_date
             FROM hospitalizations h JOIN patients p ON p.id=h.patient_id
             WHERE h.id=$1`, [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'Hospitalisation introuvable' });
        res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── Admettre un patient ─────────────────────────────────────
app.post('/hospitalizations', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { patientId, room, bed, reason, doctorUsername, depositAmount } = req.body;
        const id = 'HOSP' + Date.now();
        await client.query(
            `INSERT INTO hospitalizations(id,patient_id,room,bed,admission_reason,doctor,status,deposit,balance,admission_date,created_by)
             VALUES($1,$2,$3,$4,$5,$6,'active',$7,$7,CURRENT_DATE,$8)`,
            [id, patientId, room||null, bed||null, reason||null,
             doctorUsername||req.user.username, parseFloat(depositAmount||0), req.user.username]
        );
        // Enregistrer le dépôt initial comme transaction si > 0
        if (parseFloat(depositAmount||0) > 0) {
            const tid = 'DEP' + Date.now();
            await client.query(
                `INSERT INTO hosp_deposits(id,hospitalization_id,patient_id,amount,note,created_by)
                 VALUES($1,$2,$3,$4,'Dépôt initial à l''admission',$5)`,
                [tid, id, patientId, depositAmount, req.user.username]
            );
        }
        await client.query('COMMIT');
        res.status(201).json({ id });
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

// ─── Modifier hospitalisation (chambre, statut, médecin) ──────
app.put('/hospitalizations/:id', auth, async (req, res) => {
    try {
        const { room, bed, status, dischargeDate, dischargeNote, doctor } = req.body;
        const p = [], sets = [];
        if (room !== undefined)          { p.push(room);          sets.push('room=$'+p.length); }
        if (bed !== undefined)           { p.push(bed);           sets.push('bed=$'+p.length); }
        if (status !== undefined)        { p.push(status);        sets.push('status=$'+p.length); }
        if (dischargeDate !== undefined) { p.push(dischargeDate); sets.push('discharge_date=$'+p.length); }
        if (dischargeNote !== undefined) { p.push(dischargeNote); sets.push('discharge_note=$'+p.length); }
        if (doctor !== undefined)        { p.push(doctor);        sets.push('doctor=$'+p.length); }
        if (!sets.length) return res.json({ success: true });
        p.push(req.params.id);
        await pool.query('UPDATE hospitalizations SET '+sets.join(',')+' WHERE id=$'+p.length, p);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── Dépôts ───────────────────────────────────────────────────
app.get('/hosp-deposits/:hospId', auth, async (req, res) => {
    const r = await pool.query(
        'SELECT * FROM hosp_deposits WHERE hospitalization_id=$1 ORDER BY created_at DESC',
        [req.params.hospId]);
    res.json(r.rows);
});

app.post('/hosp-deposits', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { hospitalizationId, patientId, amount, note } = req.body;
        const id = 'DEP' + Date.now();
        await client.query(
            'INSERT INTO hosp_deposits(id,hospitalization_id,patient_id,amount,note,created_by) VALUES($1,$2,$3,$4,$5,$6)',
            [id, hospitalizationId, patientId, amount, note||null, req.user.username]
        );
        // Augmenter le solde
        await client.query(
            'UPDATE hospitalizations SET deposit=deposit+$1, balance=balance+$1 WHERE id=$2',
            [amount, hospitalizationId]
        );
        await client.query('COMMIT');
        res.status(201).json({ id, success: true });
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

// ─── Prescriptions hospitalisation ───────────────────────────
app.get('/hosp-prescriptions/:hospId', auth, async (req, res) => {
    const r = await pool.query(
        'SELECT * FROM hosp_prescriptions WHERE hospitalization_id=$1 ORDER BY created_at DESC',
        [req.params.hospId]);
    res.json(r.rows);
});

// Vue pharmacie : toutes les prescriptions des patients hospitalisés actifs
app.get('/hosp-prescriptions', auth, async (req, res) => {
    const { status } = req.query;
    const params = [];
    let query = `SELECT hp.*, h.room, h.bed, h.doctor, p.full_name
                 FROM hosp_prescriptions hp
                 JOIN hospitalizations h ON h.id = hp.hospitalization_id
                 JOIN patients p ON p.id = hp.patient_id
                 WHERE h.status = 'active'`;
    if (status) { params.push(status); query += ` AND hp.status = $${params.length}`; }
    query += ' ORDER BY hp.created_at DESC';
    const r = await pool.query(query, params);
    res.json(r.rows);
});

app.post('/hosp-prescriptions', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { hospitalizationId, patientId, medicationId, medicationName,
                dosage, frequency, duration, route, note, pricePerUnit, quantity } = req.body;
        const id = 'RX' + Date.now();
        const totalPrice = parseFloat(pricePerUnit||0) * parseInt(quantity||1);
        await client.query(
            `INSERT INTO hosp_prescriptions(id,hospitalization_id,patient_id,medication_id,medication_name,
             dosage,frequency,duration,route,note,price_per_unit,quantity,total_price,prescribed_by,status)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending')`,
            [id, hospitalizationId, patientId, medicationId||null, medicationName,
             dosage, frequency||null, duration||null, route||null, note||null,
             pricePerUnit||0, quantity||1, totalPrice, req.user.username]
        );
        // Déduire du solde ou créer une dette
        await client.query(
            'UPDATE hospitalizations SET balance=balance-$1 WHERE id=$2',
            [totalPrice, hospitalizationId]
        );
        // Réduire le stock si médicament en inventaire
        if (medicationId && quantity) {
            await client.query(
                'UPDATE medications SET quantity=GREATEST(0,quantity-$1) WHERE id=$2',
                [quantity, medicationId]
            );
        }
        await client.query('COMMIT');
        res.status(201).json({ id, totalPrice });
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

app.put('/hosp-prescriptions/:id', auth, async (req, res) => {
    const { status, administeredAt, administeredBy, nurseNote,
            delivered, deliveredAt, deliveredBy } = req.body;
    const fields = [];
    const params = [];
    if (status !== undefined)         { params.push(status);         fields.push('status=$'         + params.length); }
    if (administeredAt !== undefined) { params.push(administeredAt); fields.push('administered_at=$' + params.length); }
    if (administeredBy !== undefined) { params.push(administeredBy);fields.push('administered_by=$'  + params.length); }
    if (nurseNote !== undefined)      { params.push(nurseNote);      fields.push('nurse_note=$'       + params.length); }
    if (delivered !== undefined)      { params.push(delivered);      fields.push('delivered=$'        + params.length); }
    if (deliveredAt !== undefined)    { params.push(deliveredAt);    fields.push('delivered_at=$'     + params.length); }
    if (deliveredBy !== undefined)    { params.push(deliveredBy);    fields.push('delivered_by=$'     + params.length); }
    if (!fields.length) return res.json({ success: true });
    params.push(req.params.id);
    await pool.query(`UPDATE hosp_prescriptions SET ${fields.join(', ')} WHERE id=$${params.length}`, params);
    res.json({ success: true });
});

// ─── Suivi infirmier ──────────────────────────────────────────
app.get('/hosp-nursing/:hospId', auth, async (req, res) => {
    const r = await pool.query(
        'SELECT * FROM hosp_nursing_notes WHERE hospitalization_id=$1 ORDER BY created_at DESC',
        [req.params.hospId]);
    res.json(r.rows);
});

app.post('/hosp-nursing', auth, async (req, res) => {
    try {
        const { hospitalizationId, patientId, temperature, bloodPressure,
                pulse, oxygenSat, weight, generalState, notes } = req.body;
        const id = 'NUR' + Date.now();
        const r = await pool.query(
            `INSERT INTO hosp_nursing_notes(id,hospitalization_id,patient_id,temperature,blood_pressure,
             pulse,oxygen_sat,weight,general_state,notes,recorded_by)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [id, hospitalizationId, patientId, temperature||null, bloodPressure||null,
             pulse||null, oxygenSat||null, weight||null, generalState||null,
             notes||null, req.user.username]
        );
        res.status(201).json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── Services hospitalisation (radios, analyses spéciales) ───
app.post('/hosp-services', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { hospitalizationId, patientId, service, amount, note } = req.body;
        const id = 'HSVC' + Date.now();
        await client.query(
            `INSERT INTO hosp_services(id,hospitalization_id,patient_id,service,amount,note,created_by)
             VALUES($1,$2,$3,$4,$5,$6,$7)`,
            [id, hospitalizationId, patientId, service, amount, note||null, req.user.username]
        );
        await client.query(
            'UPDATE hospitalizations SET balance=balance-$1 WHERE id=$2',
            [amount, hospitalizationId]
        );
        await client.query('COMMIT');
        res.status(201).json({ id });
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

app.get('/hosp-services/:hospId', auth, async (req, res) => {
    const r = await pool.query(
        'SELECT * FROM hosp_services WHERE hospitalization_id=$1 ORDER BY created_at DESC',
        [req.params.hospId]);
    res.json(r.rows);
});

// ════════════════════════════════════════════════════════════
//  REMBOURSEMENTS / RETOURS
// ════════════════════════════════════════════════════════════

// Liste des remboursements
app.get('/refunds', auth, async (req, res) => {
    try {
        const { patientId, fromDate, toDate } = req.query;
        let q = 'SELECT * FROM refunds WHERE 1=1';
        const p = [];
        if (patientId) { p.push(patientId); q += ' AND patient_id=$' + p.length; }
        if (fromDate)  { p.push(fromDate);  q += ' AND date>=$' + p.length; }
        if (toDate)    { p.push(toDate);    q += ' AND date<=$' + p.length; }
        q += ' ORDER BY created_at DESC';
        res.json((await pool.query(q, p)).rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Enregistrer un remboursement
app.post('/refunds', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { transactionId, reason, refundType, exchangeTransactionId } = req.body;
        // refundType: 'refund' = remboursement, 'exchange' = échange

        // Récupérer la transaction originale
        const txRes = await client.query('SELECT * FROM transactions WHERE id=$1', [transactionId]);
        if (!txRes.rows.length) throw new Error('Transaction introuvable');
        const tx = txRes.rows[0];
        if (tx.status !== 'paid') throw new Error('Seules les transactions payées peuvent être remboursées');

        const id = 'REF' + Date.now();

        // Enregistrer le remboursement
        await client.query(
            `INSERT INTO refunds(id,transaction_id,patient_id,patient_name,service,amount,refund_type,reason,date,created_by)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE,$9)`,
            [id, transactionId, tx.patient_id, tx.patient_name, tx.service,
             tx.amount, refundType||'refund', reason||null, req.user.username]
        );

        // Marquer la transaction originale comme remboursée
        await client.query(
            "UPDATE transactions SET status='refunded', refund_id=$1 WHERE id=$2",
            [id, transactionId]
        );

        // Si c'est un retour médicament → remettre en stock
        if (tx.type === 'medication' && tx.medication_id && tx.quantity) {
            await client.query(
                'UPDATE medications SET quantity=quantity+$1 WHERE id=$2',
                [tx.quantity, tx.medication_id]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({
            id,
            amount: tx.amount,
            service: tx.service,
            patientName: tx.patient_name
        });
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: e.message });
    } finally { client.release(); }
});

// Supprimer un remboursement (annuler le remboursement)
app.delete('/refunds/:id', auth, adminOnly, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query('SELECT * FROM refunds WHERE id=$1', [req.params.id]);
        if (!r.rows.length) throw new Error('Remboursement introuvable');
        const refund = r.rows[0];

        // Remettre la transaction en statut payé
        await client.query(
            "UPDATE transactions SET status='paid', refund_id=NULL WHERE id=$1",
            [refund.transaction_id]
        );

        // Si médicament → réduire le stock à nouveau
        const tx = await client.query('SELECT * FROM transactions WHERE id=$1', [refund.transaction_id]);
        if (tx.rows.length && tx.rows[0].type === 'medication' && tx.rows[0].medication_id && tx.rows[0].quantity) {
            await client.query(
                'UPDATE medications SET quantity=GREATEST(0,quantity-$1) WHERE id=$2',
                [tx.rows[0].quantity, tx.rows[0].medication_id]
            );
        }

        await client.query('DELETE FROM refunds WHERE id=$1', [req.params.id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: e.message });
    } finally { client.release(); }
});

// ════════════════════════════════════════════════════════════
//  PETITE CAISSE — Transferts depuis grande caisse
// ════════════════════════════════════════════════════════════

app.get('/petite-caisse', auth, adminOnly, async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM petite_caisse ORDER BY created_at DESC LIMIT 100');
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/petite-caisse', auth, adminOnly, async (req, res) => {
    try {
        const { amount, note, direction } = req.body;
        // direction: 'in' = ajout depuis grande caisse, 'out' = dépense petite caisse
        const id = 'PC' + Date.now();
        const r = await pool.query(
            'INSERT INTO petite_caisse(id,amount,note,direction,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *',
            [id, amount, note||null, direction||'in', req.user.username]
        );
        res.status(201).json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/petite-caisse/:id', auth, adminOnly, async (req, res) => {
    await pool.query('DELETE FROM petite_caisse WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  GESTION DE CAISSE — COMMISSIONS / RETRAITS
// ════════════════════════════════════════════════════════════

// Enregistrer un retrait/commission
app.post('/cash-withdrawals', auth, adminOnly, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { agentUsername, agentName, amount, note, date, paymentMethod } = req.body;
        const method = paymentMethod || 'cash';
        const id = 'WD' + Date.now();

        // Vérifier que le solde du compte est suffisant
        const bal = await getAccountBalance(client, method);
        if (bal < parseFloat(amount)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'Solde insuffisant sur ce compte. Disponible: ' + bal.toLocaleString('fr') + ' HTG'
            });
        }

        await client.query(
            `INSERT INTO cash_withdrawals(id,agent_username,agent_name,amount,note,date,created_by,payment_method)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
            [id, agentUsername, agentName, amount, note||null,
             date||new Date().toISOString().split('T')[0], req.user.username, method]
        );

        // Déduire du compte concerné
        await client.query(
            `INSERT INTO account_movements(id,account,amount,direction,reference,note,created_by)
             VALUES($1,$2,$3,'out',$4,$5,$6)`,
            ['MOV'+Date.now(), method, amount, id, note||'Décaissement', req.user.username]
        );

        await client.query('COMMIT');
        res.status(201).json({ id, success: true, newBalance: bal - parseFloat(amount) });
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

// Helper: calculer le solde d'un compte
async function getAccountBalance(client, method) {
    // Encaissements reçus via cette méthode
    const inc = await client.query(
        "SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE status='paid' AND LOWER(payment_method)=$1",
        [method]
    );
    // Retraits effectués depuis ce compte
    const out = await client.query(
        "SELECT COALESCE(SUM(amount),0) as total FROM cash_withdrawals WHERE LOWER(payment_method)=$1",
        [method]
    );
    // Mouvements manuels (petite caisse, transferts)
    const mov_in  = await client.query(
        "SELECT COALESCE(SUM(amount),0) as total FROM account_movements WHERE account=$1 AND direction='in'",
        [method]
    ).catch(function() { return { rows: [{ total: 0 }] }; });
    const mov_out = await client.query(
        "SELECT COALESCE(SUM(amount),0) as total FROM account_movements WHERE account=$1 AND direction='out'",
        [method]
    ).catch(function() { return { rows: [{ total: 0 }] }; });

    return parseFloat(inc.rows[0].total)
         - parseFloat(out.rows[0].total)
         + parseFloat(mov_in.rows[0].total)
         - parseFloat(mov_out.rows[0].total);
}

// Lister les retraits
// Soldes de tous les comptes
app.get('/account-balances', auth, adminOnly, async (req, res) => {
    try {
        const methods = ['cash','moncash','natcash','card','virement','petite_caisse'];
        const client = await pool.connect();
        const balances = {};
        for (const m of methods) {
            balances[m] = await getAccountBalance(client, m);
        }
        client.release();
        res.json(balances);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/cash-withdrawals', auth, adminOnly, async (req, res) => {
    try {
        const { agentUsername, date, fromDate, toDate } = req.query;
        let q = 'SELECT * FROM cash_withdrawals WHERE 1=1';
        const p = [];
        if (agentUsername) { p.push(agentUsername); q += ' AND agent_username=$'+p.length; }
        if (date)          { p.push(date);           q += ' AND date=$'+p.length; }
        if (fromDate)      { p.push(fromDate);        q += ' AND date>=$'+p.length; }
        if (toDate)        { p.push(toDate);          q += ' AND date<=$'+p.length; }
        q += ' ORDER BY created_at DESC';
        res.json((await pool.query(q, p)).rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Supprimer un retrait
app.delete('/cash-withdrawals/:id', auth, adminOnly, async (req, res) => {
    await pool.query('DELETE FROM cash_withdrawals WHERE id=$1', [req.params.id]);
    res.json({ success: true });
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
