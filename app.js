// ============================================================
//  APP.JS — Logique principale frontend
//  Connecté à l'API backend via api.js
// ============================================================

// ─── État global ─────────────────────────────────────────────
const state = {
    currentUser:   null,
    currentRole:   null,
    // Données chargées depuis l'API (cache léger)
    consultationTypes:    [],
    vitalTypes:           [],
    labAnalysisTypes:     [],
    externalServiceTypes: [],
    medications:          [],
    hospitalSettings:     {},
    // État UI temporaire
    currentModifiedConsultation: null,
    currentModifiedAnalysis:     null,
    currentCashierPatient:       null,
    selectedServices:            [],
    currentDoctorPatient:        null,
};

// ─── Utilitaires UI ─────────────────────────────────────────
function showSpinner()  { document.getElementById('spinner-overlay').classList.remove('hidden'); }
function hideSpinner()  { document.getElementById('spinner-overlay').classList.add('hidden'); }

function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3200);
}

async function apiCall(fn, errorMsg = 'Erreur') {
    showSpinner();
    try {
        return await fn();
    } catch (err) {
        toast(err.message || errorMsg, 'error');
        throw err;
    } finally {
        hideSpinner();
    }
}

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('fr-FR');
}

// ─── INITIALISATION ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupLogin();
    setupNavigation();
});

// ─── CONNEXION ────────────────────────────────────────────────
function setupLogin() {
    const roleBtns = document.querySelectorAll('.login-role-btn');
    roleBtns.forEach(btn => btn.addEventListener('click', function () {
        roleBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
    }));

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const role     = document.querySelector('.login-role-btn.active').dataset.role;

        try {
            showSpinner();
            const data = await API.login(username, password, role);
            localStorage.setItem('hopital_token', data.token);
            state.currentUser = data.user;
            state.currentRole = role;

            document.getElementById('current-username').textContent = data.user.name;
            document.getElementById('current-user-role').textContent = role;
            document.getElementById('dashboard-role').textContent = role.charAt(0).toUpperCase() + role.slice(1);

            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');

            await loadBaseData();
            setupRoleBasedNavigation();
            updateRoleDashboard();
            checkUnreadMessages();
        } catch (err) {
            toast(err.message || 'Identifiants incorrects', 'error');
        } finally {
            hideSpinner();
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('Voulez-vous vous déconnecter?')) {
            localStorage.removeItem('hopital_token');
            location.reload();
        }
    });
}

async function loadBaseData() {
    try {
        const [ct, vt, lat, est, meds, settings] = await Promise.all([
            API.getConsultationTypes(),
            API.getVitalTypes(),
            API.getLabAnalysisTypes(),
            API.getExternalServiceTypes(),
            API.getMedications(),
            API.getSettings(),
        ]);
        state.consultationTypes    = ct;
        state.vitalTypes           = vt;
        state.labAnalysisTypes     = lat;
        state.externalServiceTypes = est;
        state.medications          = meds;
        state.hospitalSettings     = settings;

        applyHospitalSettings();
        updateConsultationTypesSelect();
        updateVitalsInputs();
        updateLabAnalysesSelect();
        updateExternalServicesSelect();
        updateExternalServicesOptions();
        updateDoctorConsultationTypes();
    } catch (err) {
        toast('Erreur chargement des données', 'error');
    }
}

function applyHospitalSettings() {
    const s = state.hospitalSettings;
    if (s.name) {
        document.getElementById('hospital-name-login').textContent = s.name;
        document.getElementById('hospital-name-header').textContent = s.name;
        document.getElementById('hospital-name').value = s.name;
    }
    if (s.address) {
        document.getElementById('hospital-address-header').textContent = s.address;
        document.getElementById('hospital-address').value = s.address;
    }
    if (s.phone) document.getElementById('hospital-phone').value = s.phone;
    if (s.logo) {
        ['header-logo', 'login-logo', 'card-logo', 'certificate-logo', 'invoice-logo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.src = s.logo; el.style.display = 'block'; }
        });
        document.getElementById('header-icon').style.display = 'none';
        document.getElementById('login-icon').style.display  = 'none';
    }
}

// ─── NAVIGATION ──────────────────────────────────────────────
function setupNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function () {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
            document.getElementById(this.dataset.target).classList.add('active');

            const target = this.dataset.target;
            if      (target === 'dashboard')      updateRoleDashboard();
            else if (target === 'secretary')      { updateTodayPatientsList(); updateConsultationTypesSelect(); loadAppointmentsList(); }
            else if (target === 'administration') { updateAdminStats(); }
            else if (target === 'pharmacy')       updateMedicationStockDisplay();
            else if (target === 'messaging')      { loadConversations(); checkUnreadMessages(); }
            else if (target === 'doctor')         loadDoctorAppointments();
            else if (target === 'settings')       { updateSettingsDisplay(); updateMedicationsSettingsList(); }
        });
    });
}

function setupRoleBasedNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    const role = state.currentRole;
    const roleAccess = {
        admin:     ['dashboard','secretary','cashier','nurse','doctor','laboratory','pharmacy','messaging','administration','settings'],
        secretary: ['dashboard','secretary','messaging'],
        cashier:   ['dashboard','cashier','messaging'],
        nurse:     ['dashboard','nurse','messaging'],
        doctor:    ['dashboard','doctor','messaging'],
        lab:       ['dashboard','laboratory','messaging'],
        pharmacy:  ['dashboard','pharmacy','messaging'],
    };
    const allowed = roleAccess[role] || ['dashboard'];
    tabs.forEach(tab => {
        if (allowed.includes(tab.dataset.target)) tab.classList.remove('hidden');
        else tab.classList.add('hidden');
    });
    const visible = document.querySelectorAll('.nav-tab:not(.hidden)');
    if (visible.length > 0) {
        visible.forEach(t => t.classList.remove('active'));
        visible[0].classList.add('active');
        document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
        document.getElementById(visible[0].dataset.target).classList.add('active');
    }
}

function showSection(sectionId) {
    const tab = document.querySelector(`.nav-tab[data-target="${sectionId}"]`);
    if (tab) tab.click();
}

// ─── TABLEAU DE BORD ─────────────────────────────────────────
async function updateRoleDashboard() {
    const container = document.getElementById('role-dashboard-content');
    const role = state.currentRole;
    const today = new Date().toISOString().split('T')[0];

    try {
        if (role === 'admin') {
            const stats = await apiCall(() => API.getStats());
            container.innerHTML = `
                <div class="stats-container">
                    <div class="stat-card"><div class="stat-icon" style="background:#1a6bca"><i class="fas fa-users"></i></div>
                        <div class="stat-info"><h3>${stats.totalPatients}</h3><p>Patients total</p></div></div>
                    <div class="stat-card"><div class="stat-icon" style="background:#28a745"><i class="fas fa-money-bill-wave"></i></div>
                        <div class="stat-info"><h3>${stats.totalRevenue.toLocaleString('fr-FR')} Gdes</h3><p>Revenus totaux</p></div></div>
                    <div class="stat-card"><div class="stat-icon" style="background:#ffc107"><i class="fas fa-exclamation-triangle"></i></div>
                        <div class="stat-info"><h3>${stats.unpaidCount}</h3><p>Services impayés</p></div></div>
                    <div class="stat-card"><div class="stat-icon" style="background:#dc3545"><i class="fas fa-pills"></i></div>
                        <div class="stat-info"><h3>${stats.lowStock.length}</h3><p>Médicaments en alerte</p></div></div>
                </div>
                <div class="card mt-3"><h3>Transactions récentes</h3>
                    <div class="table-container"><table><thead><tr><th>Date</th><th>Patient</th><th>Service</th><th>Montant</th><th>Statut</th></tr></thead>
                    <tbody>${stats.recentTransactions.slice(0,8).map(t => `
                        <tr><td>${t.date}</td><td>${t.patient_name}</td><td>${t.service}</td>
                        <td>${t.amount} Gdes</td>
                        <td><span class="${t.status==='paid'?'status-paid':'status-unpaid'}">${t.status==='paid'?'Payé':'Non payé'}</span></td></tr>`).join('')}
                    </tbody></table></div></div>`;
        } else if (role === 'secretary') {
            const patients = await apiCall(() => API.getPatients({ date: today }));
            const unread = await API.getUnreadCount();
            container.innerHTML = `
                <div class="stats-container">
                    <div class="stat-card"><div class="stat-icon" style="background:#1a6bca"><i class="fas fa-user-plus"></i></div>
                        <div class="stat-info"><h3>${patients.length}</h3><p>Patients aujourd'hui</p></div></div>
                    <div class="stat-card clickable-stat" onclick="showSection('messaging')">
                        <div class="stat-icon" style="background:#17a2b8"><i class="fas fa-comments"></i></div>
                        <div class="stat-info"><h3>${unread.count}</h3><p>Messages non lus</p></div></div>
                </div>
                <div class="card mt-3"><h3>Patients du jour</h3>
                    <div class="table-container"><table><thead><tr><th>ID</th><th>Nom</th><th>Type</th><th>Heure</th></tr></thead>
                    <tbody>${patients.slice(0,8).map(p=>`<tr><td>${p.id}</td><td>${p.full_name}</td><td>${p.type}</td><td>${p.registration_time||'-'}</td></tr>`).join('')}
                    </tbody></table></div></div>`;
        } else if (role === 'cashier') {
            const txs = await apiCall(() => API.getTransactions({ status: 'paid' }));
            const todayTxs = txs.filter(t => t.payment_date === today);
            const revenue = todayTxs.reduce((s,t) => s + parseFloat(t.amount), 0);
            const unread = await API.getUnreadCount();
            container.innerHTML = `
                <div class="stats-container">
                    <div class="stat-card"><div class="stat-icon" style="background:#28a745"><i class="fas fa-money-bill-wave"></i></div>
                        <div class="stat-info"><h3>${revenue.toLocaleString('fr-FR')} Gdes</h3><p>Encaissements aujourd'hui</p></div></div>
                    <div class="stat-card clickable-stat" onclick="showSection('messaging')">
                        <div class="stat-icon" style="background:#17a2b8"><i class="fas fa-comments"></i></div>
                        <div class="stat-info"><h3>${unread.count}</h3><p>Messages non lus</p></div></div>
                </div>`;
        } else if (role === 'nurse') {
            const unread = await API.getUnreadCount();
            container.innerHTML = `
                <div class="stats-container">
                    <div class="stat-card clickable-stat" onclick="showSection('messaging')">
                        <div class="stat-icon" style="background:#17a2b8"><i class="fas fa-comments"></i></div>
                        <div class="stat-info"><h3>${unread.count}</h3><p>Messages non lus</p></div></div>
                </div>
                <p class="mt-3">Utilisez l'onglet <strong>Infirmier</strong> pour saisir les signes vitaux.</p>`;
        } else if (role === 'doctor') {
            const apps = await apiCall(() => API.getAppointments({ doctor: state.currentUser.username, fromDate: today }));
            const unread = await API.getUnreadCount();
            container.innerHTML = `
                <div class="stats-container">
                    <div class="stat-card"><div class="stat-icon" style="background:#1a6bca"><i class="fas fa-calendar-alt"></i></div>
                        <div class="stat-info"><h3>${apps.length}</h3><p>Rendez-vous à venir</p></div></div>
                    <div class="stat-card clickable-stat" onclick="showSection('messaging')">
                        <div class="stat-icon" style="background:#17a2b8"><i class="fas fa-comments"></i></div>
                        <div class="stat-info"><h3>${unread.count}</h3><p>Messages non lus</p></div></div>
                </div>`;
        } else if (role === 'pharmacy') {
            const meds = state.medications.filter(m => m.quantity <= m.alert_threshold);
            const unread = await API.getUnreadCount();
            container.innerHTML = `
                <div class="stats-container">
                    <div class="stat-card"><div class="stat-icon" style="background:#dc3545"><i class="fas fa-pills"></i></div>
                        <div class="stat-info"><h3>${meds.length}</h3><p>Médicaments en alerte</p></div></div>
                    <div class="stat-card clickable-stat" onclick="showSection('messaging')">
                        <div class="stat-icon" style="background:#17a2b8"><i class="fas fa-comments"></i></div>
                        <div class="stat-info"><h3>${unread.count}</h3><p>Messages non lus</p></div></div>
                </div>`;
        } else if (role === 'lab') {
            const txs = await apiCall(() => API.getTransactions({ type: 'lab' }));
            const pending = txs.filter(t => t.status === 'paid' && t.lab_status !== 'completed');
            const unread = await API.getUnreadCount();
            container.innerHTML = `
                <div class="stats-container">
                    <div class="stat-card"><div class="stat-icon" style="background:#ffc107"><i class="fas fa-flask"></i></div>
                        <div class="stat-info"><h3>${pending.length}</h3><p>Analyses en attente</p></div></div>
                    <div class="stat-card clickable-stat" onclick="showSection('messaging')">
                        <div class="stat-icon" style="background:#17a2b8"><i class="fas fa-comments"></i></div>
                        <div class="stat-info"><h3>${unread.count}</h3><p>Messages non lus</p></div></div>
                </div>`;
        }
    } catch(e) {
        container.innerHTML = `<div class="alert alert-danger">Erreur chargement du tableau de bord</div>`;
    }
}

// ─── SECRÉTARIAT ─────────────────────────────────────────────
function updateConsultationTypesSelect() {
    const sel = document.getElementById('consultation-type-secretary');
    sel.innerHTML = '<option value="">Sélectionner...</option>';
    state.consultationTypes.filter(ct => ct.active).forEach(ct => {
        sel.innerHTML += `<option value="${ct.id}">${ct.name} — ${ct.price} Gdes</option>`;
    });
}

function updateExternalServicesOptions() {
    const container = document.getElementById('external-services-options');
    let html = '<div class="service-external-list">';
    state.externalServiceTypes.filter(s => s.active).forEach(s => {
        html += `<div class="service-item"><label>
            <input type="checkbox" class="external-service-option" value="${s.id}" data-price="${s.price}">
            ${s.name} — ${s.price} Gdes</label></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

function updateExternalServicesSelect() {
    const sel = document.getElementById('external-service-select');
    sel.innerHTML = '<option value="">Choisir un service</option>';
    state.externalServiceTypes.filter(s => s.active).forEach(s => {
        sel.innerHTML += `<option value="${s.id}" data-price="${s.price}">${s.name} — ${s.price} Gdes</option>`;
    });
}

// Gestion type patient → affichage consultation vs services externes
function setupPatientTypeChange() {
    document.querySelectorAll('input[name="patient-type"]').forEach(radio => {
        radio.addEventListener('change', function () { syncExternalUI(); });
    });
    document.getElementById('external-only').addEventListener('change', syncExternalUI);
}

function syncExternalUI() {
    const type       = document.querySelector('input[name="patient-type"]:checked').value;
    const extOnly    = document.getElementById('external-only').checked;
    const isExternal = type === 'externe' || extOnly;
    document.getElementById('consultation-type-container').classList.toggle('hidden', isExternal);
    document.getElementById('external-services-selection').classList.toggle('hidden', !isExternal);
    document.getElementById('consultation-type-secretary').required = !isExternal;
}

document.addEventListener('DOMContentLoaded', () => {
    // Bouton "ajouter service externe" dans le formulaire
    document.getElementById('add-external-service-registration').addEventListener('click', () => {
        const container = document.getElementById('external-services-options');
        const div = document.createElement('div');
        div.className = 'service-item';
        div.innerHTML = `
            <input type="text" class="form-control external-service-custom" placeholder="Nom du service" style="width:200px;display:inline-block;">
            <input type="number" class="form-control external-service-price" placeholder="Prix (Gdes)" style="width:150px;display:inline-block;">
            <button type="button" class="btn btn-danger btn-sm remove-external-service">✕</button>`;
        container.appendChild(div);
        div.querySelector('.remove-external-service').addEventListener('click', () => div.remove());
    });

    // Modification consultation
    document.getElementById('consultation-type-secretary').addEventListener('change', function () {
        document.getElementById('modify-consultation-type-btn').classList.toggle('hidden', !this.value);
    });
    document.getElementById('modify-consultation-type-btn').addEventListener('click', () => {
        const id = parseInt(document.getElementById('consultation-type-secretary').value);
        const ct = state.consultationTypes.find(c => c.id === id);
        if (!ct) return;
        document.getElementById('modified-consultation-name').value  = ct.name;
        document.getElementById('modified-consultation-price').value = ct.price;
        document.getElementById('consultation-modification-secretary').classList.remove('hidden');
    });
    document.getElementById('save-modified-consultation').addEventListener('click', () => {
        const name  = document.getElementById('modified-consultation-name').value;
        const price = parseFloat(document.getElementById('modified-consultation-price').value);
        if (!name || isNaN(price)) { toast('Remplir tous les champs', 'error'); return; }
        state.currentModifiedConsultation = { name, price };
        document.getElementById('consultation-modification-secretary').classList.add('hidden');
        toast('Modification enregistrée pour ce patient uniquement');
    });
    document.getElementById('cancel-consultation-modification').addEventListener('click', () => {
        state.currentModifiedConsultation = null;
        document.getElementById('consultation-modification-secretary').classList.add('hidden');
    });

    // Formulaire d'enregistrement patient
    document.getElementById('patient-registration-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName           = document.getElementById('patient-fullname').value;
        const birthDate          = document.getElementById('patient-birthdate').value;
        const address            = document.getElementById('patient-address').value;
        const phone              = document.getElementById('patient-phone').value;
        const responsible        = document.getElementById('patient-responsible').value;
        const type               = document.querySelector('input[name="patient-type"]:checked').value;
        const externalOnly       = document.getElementById('external-only').checked;
        const consultationTypeId = parseInt(document.getElementById('consultation-type-secretary').value);

        if (type !== 'externe' && !externalOnly && !consultationTypeId) {
            toast('Sélectionner un type de consultation', 'error'); return;
        }

        // Construire la liste des services externes
        const externalServices = [];
        document.querySelectorAll('.external-service-option:checked').forEach(cb => {
            const svc = state.externalServiceTypes.find(s => s.id == cb.value);
            if (svc) externalServices.push({ name: svc.name, price: svc.price });
        });
        document.querySelectorAll('.external-service-custom').forEach((input, i) => {
            const name  = input.value.trim();
            const price = parseFloat(document.querySelectorAll('.external-service-price')[i].value);
            if (name && !isNaN(price)) externalServices.push({ name, price });
        });

        if ((externalOnly || type === 'externe') && externalServices.length === 0) {
            toast('Sélectionner au moins un service externe', 'error'); return;
        }

        try {
            const result = await apiCall(() => API.createPatient({
                fullName, birthDate, address, phone, responsible, type,
                externalOnly, consultationTypeId: externalOnly ? null : consultationTypeId,
                modifiedConsultation: state.currentModifiedConsultation,
                externalServices,
            }));

            toast(`Patient enregistré ! ID: ${result.id}`);
            e.target.reset();
            document.getElementById('patient-normal').checked = true;
            document.getElementById('external-only').checked  = false;
            document.getElementById('consultation-type-container').classList.remove('hidden');
            document.getElementById('external-services-selection').classList.add('hidden');
            document.getElementById('modify-consultation-type-btn').classList.add('hidden');
            document.getElementById('consultation-modification-secretary').classList.add('hidden');
            state.currentModifiedConsultation = null;
            updateTodayPatientsList();
            // Notifier la caisse
            await API.sendMessage({
                recipient: 'cashier',
                recipientRole: 'cashier',
                subject: 'Nouveau patient',
                content: `Nouveau patient enregistré ID ${result.id} — ${fullName}`,
                type: 'notification',
            }).catch(() => {});
        } catch (err) { /* toast already shown */ }
    });

    // Rendez-vous depuis secrétariat
    document.getElementById('search-appointment-patient').addEventListener('click', async () => {
        const search = document.getElementById('appointment-patient-search').value.trim();
        if (!search) return;
        try {
            const patients = await apiCall(() => API.getPatients({ search }));
            if (!patients.length) { toast('Patient non trouvé', 'error'); return; }
            const p = patients[0];
            document.getElementById('appointment-patient-name').textContent = `${p.full_name} (${p.id})`;
            document.getElementById('appointment-patient-details').dataset.patientId = p.id;
            document.getElementById('appointment-patient-details').dataset.patientName = p.full_name;
            document.getElementById('appointment-patient-details').classList.remove('hidden');
            // Charger médecins
            const users = await API.getUsers().catch(() => []);
            const doctors = users.filter(u => u.role === 'doctor' && u.active);
            const sel = document.getElementById('appointment-doctor');
            sel.innerHTML = '<option value="">Sélectionner un médecin</option>';
            doctors.forEach(d => sel.innerHTML += `<option value="${d.username}">${d.name}</option>`);
        } catch(e) {}
    });

    document.getElementById('schedule-appointment').addEventListener('click', async () => {
        const details = document.getElementById('appointment-patient-details');
        const patientId   = details.dataset.patientId;
        const patientName = details.dataset.patientName;
        const date   = document.getElementById('appointment-date').value;
        const time   = document.getElementById('appointment-time').value;
        const reason = document.getElementById('appointment-reason').value;
        const doctor = document.getElementById('appointment-doctor').value;
        if (!date || !time || !doctor) { toast('Remplir tous les champs', 'error'); return; }
        try {
            await apiCall(() => API.addAppointment({ patientId, patientName, date, time, reason, doctor }));
            toast('Rendez-vous programmé!');
            loadAppointmentsList();
        } catch(e) {}
    });

    // Services externes (secrétariat)
    document.getElementById('search-external-patient').addEventListener('click', async () => {
        const search = document.getElementById('external-service-search').value.trim();
        try {
            const patients = await apiCall(() => API.getPatients({ search }));
            if (!patients.length) { toast('Patient non trouvé', 'error'); return; }
            const p = patients[0];
            document.getElementById('external-patient-name').textContent = `${p.full_name} (${p.id})`;
            document.getElementById('external-patient-name').dataset.patientId = p.id;
            document.getElementById('external-services-container').classList.remove('hidden');
            await loadExternalServicesList(p.id);
        } catch(e) {}
    });

    document.getElementById('add-external-service').addEventListener('click', async () => {
        const patientId = document.getElementById('external-patient-name').dataset.patientId;
        const sel = document.getElementById('external-service-select');
        const svcId = sel.value;
        const svc = state.externalServiceTypes.find(s => s.id == svcId);
        if (!svc) { toast('Sélectionner un service', 'error'); return; }
        try {
            await apiCall(() => API.addTransaction({
                patientId,
                patientName: document.getElementById('external-patient-name').textContent.split('(')[0].trim(),
                service: `Service externe: ${svc.name}`,
                amount: svc.price,
                type: 'external',
            }));
            toast('Service ajouté!');
            await loadExternalServicesList(patientId);
        } catch(e) {}
    });
});

async function loadExternalServicesList(patientId) {
    const txs = await API.getTransactions({ patientId, type: 'external' });
    const container = document.getElementById('external-services-list');
    if (!txs.length) { container.innerHTML = '<p>Aucun service externe.</p>'; return; }
    container.innerHTML = txs.map(t => `
        <div class="service-item">
            <div>${t.service}</div>
            <div>${t.amount} Gdes</div>
            <div><span class="${t.status==='paid'?'status-paid':'status-unpaid'}">${t.status==='paid'?'Payé':'Non payé'}</span></div>
        </div>`).join('');
}

async function updateTodayPatientsList() {
    const today = new Date().toISOString().split('T')[0];
    try {
        const patients = await API.getPatients({ date: today });
        const tbody = document.getElementById('today-patients-list');
        tbody.innerHTML = patients.map(p => `
            <tr>
                <td>${p.id}</td><td>${p.full_name}</td><td>${p.phone}</td>
                <td>${p.type}</td>
                <td><span class="${p.vip?'vip-tag':''}">${p.vip?'VIP':p.sponsored?`Sponsorisé ${p.discount_percentage}%`:'-'}</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="printPatientCard('${p.id}')"><i class="fas fa-id-card"></i></button>
                </td>
            </tr>`).join('') || '<tr><td colspan="6">Aucun patient aujourd\'hui</td></tr>';
    } catch(e) {}
}

async function loadAppointmentsList() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const apps = await API.getAppointments({ fromDate: today });
        const container = document.getElementById('appointments-list');
        container.innerHTML = apps.map(a => `
            <div class="appointment-item">
                <div class="d-flex justify-between">
                    <div>
                        <strong>${a.patient_name}</strong> — ${a.date} à ${a.time}<br>
                        <small>Motif: ${a.reason||'-'} | Médecin: ${a.doctor||'-'}</small>
                    </div>
                    <div>
                        <span class="appointment-status status-${a.status==='scheduled'?'pending':a.status}">${a.status}</span>
                        <div class="appointment-actions">
                            <button class="btn btn-sm btn-success" onclick="updateApptStatus('${a.id}','confirmed')">Confirmer</button>
                            <button class="btn btn-sm btn-danger" onclick="updateApptStatus('${a.id}','cancelled')">Annuler</button>
                        </div>
                    </div>
                </div>
            </div>`).join('') || '<p>Aucun rendez-vous programmé.</p>';
    } catch(e) {}
}

async function updateApptStatus(id, status) {
    await apiCall(() => API.updateAppointment(id, { status }));
    toast('Statut mis à jour');
    loadAppointmentsList();
}

// Carte patient (print)
async function printPatientCard(patientId) {
    try {
        const p = await API.getPatient(patientId);
        const s = state.hospitalSettings;
        document.getElementById('card-hospital-name').textContent    = s.name    || 'Hôpital';
        document.getElementById('card-hospital-address').textContent = s.address || '';
        document.getElementById('card-patient-name').textContent     = p.full_name;
        document.getElementById('card-patient-id').textContent       = p.id;
        document.getElementById('card-patient-dob').textContent      = formatDate(p.birth_date);
        document.getElementById('card-patient-phone').textContent    = p.phone;
        document.getElementById('card-issue-date').textContent       = new Date().toLocaleDateString('fr-FR');
        const typeEl = document.getElementById('card-patient-type');
        const typeMap = { urgence: ['URGENCE','emergency-patient-tag'], pediatrie: ['PÉDIATRIE','pediatric-tag'], externe: ['EXTERNE','external-patient-tag'] };
        const [txt, cls] = typeMap[p.type] || ['STANDARD',''];
        typeEl.textContent  = p.vip ? txt + ' VIP' : p.sponsored ? txt + ` SPONSORISÉ (${p.discount_percentage}%)` : txt;
        typeEl.className    = cls + (p.vip ? ' vip-tag' : '');
        document.getElementById('patient-card-container').classList.remove('hidden');
        setTimeout(() => { window.print(); document.getElementById('patient-card-container').classList.add('hidden'); }, 400);
    } catch(e) {}
}

// ─── CAISSE ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('search-cashier-patient').addEventListener('click', async () => {
        const search = document.getElementById('cashier-patient-search').value.trim();
        try {
            const patients = await apiCall(() => API.getPatients({ search }));
            if (!patients.length) { toast('Patient non trouvé', 'error'); return; }
            const p = patients[0];
            state.currentCashierPatient = p;
            document.getElementById('cashier-patient-name').textContent = p.full_name;
            document.getElementById('cashier-patient-id').textContent   = p.id;
            document.getElementById('cashier-patient-details').classList.remove('hidden');
            await loadServicesForPayment(p);
        } catch(e) {}
    });

    document.getElementById('amount-given').addEventListener('input', function () {
        const total = parseFloat(document.getElementById('total-to-pay').textContent);
        const given = parseFloat(this.value);
        const el    = document.getElementById('change-result');
        if (isNaN(given)) { el.textContent = 'Monnaie: 0 Gdes'; el.style.color=''; return; }
        if (given < total) { el.textContent = `Manquant: ${(total-given).toFixed(2)} Gdes`; el.style.color='#dc3545'; return; }
        el.textContent = `Monnaie: ${(given-total).toFixed(2)} Gdes`;
        el.style.color = '#28a745';
    });

    document.querySelectorAll('.payment-method').forEach(m => {
        m.addEventListener('click', function () {
            document.querySelectorAll('.payment-method').forEach(x => x.classList.remove('active'));
            this.classList.add('active');
        });
    });

    document.getElementById('mark-as-paid').addEventListener('click', async () => {
        if (!state.selectedServices.length) { toast('Aucun service sélectionné', 'error'); return; }
        const given = parseFloat(document.getElementById('amount-given').value);
        const total = parseFloat(document.getElementById('total-to-pay').textContent);
        if (isNaN(given) || given < total) { toast('Montant insuffisant', 'error'); return; }
        const method = document.querySelector('.payment-method.active').dataset.method;
        const ids = state.selectedServices.map(s => s.id);
        try {
            await apiCall(() => API.payTransactions(ids, method));
            toast('Paiement enregistré!');
            await loadServicesForPayment(state.currentCashierPatient);
            generateInvoice(total, given, method);
            // Notifier les autres rôles
            const msgs = ['secretary','doctor','nurse','lab','pharmacy'].map(r =>
                API.sendMessage({ recipient: r, recipientRole: r, subject: 'Paiement effectué',
                    content: `Paiement de ${state.currentCashierPatient.full_name}: ${total} Gdes (${method})`,
                    type: 'payment_notification' }).catch(()=>{})
            );
            await Promise.all(msgs);
        } catch(e) {}
    });

    document.getElementById('print-invoice').addEventListener('click', () => window.print());
    document.getElementById('print-receipt').addEventListener('click', () => window.print());
});

async function loadServicesForPayment(patient) {
    const txs = await API.getTransactions({ patientId: patient.id, status: 'unpaid' });
    state.selectedServices = [];
    let total = 0;
    let html = '';
    txs.forEach(t => {
        let amount = parseFloat(t.amount);
        if (patient.sponsored && patient.discount_percentage > 0) amount *= (1 - patient.discount_percentage / 100);
        total += amount;
        state.selectedServices.push({ ...t, finalAmount: amount });
        html += `<div class="service-item">
            <div>
                <input type="checkbox" class="service-checkbox" data-id="${t.id}" checked>
                <strong>${t.service}</strong>
                ${patient.sponsored && patient.discount_percentage > 0 ?
                    `<br><small>Réduction ${patient.discount_percentage}%: ${t.amount} → ${amount.toFixed(2)} Gdes</small>` : ''}
            </div>
            <div>${amount.toFixed(2)} Gdes</div>
        </div>`;
    });
    document.getElementById('services-to-pay-list').innerHTML = html || '<p>Aucun service à payer.</p>';
    document.getElementById('total-to-pay').textContent = total.toFixed(2);

    document.querySelectorAll('.service-checkbox').forEach(cb => {
        cb.addEventListener('change', function () {
            const id = this.dataset.id;
            if (this.checked) {
                const t = txs.find(x => x.id === id);
                if (t) { let a = parseFloat(t.amount); if (patient.sponsored) a *= (1 - patient.discount_percentage/100); state.selectedServices.push({...t,finalAmount:a}); }
            } else {
                state.selectedServices = state.selectedServices.filter(x => x.id !== id);
            }
            document.getElementById('total-to-pay').textContent = state.selectedServices.reduce((s,x)=>s+x.finalAmount,0).toFixed(2);
        });
    });
}

function generateInvoice(total, given, method) {
    const p = state.currentCashierPatient;
    const s = state.hospitalSettings;
    document.getElementById('invoice-hospital-name').textContent    = s.name    || 'Hôpital';
    document.getElementById('invoice-hospital-address').textContent = s.address || '';
    document.getElementById('invoice-hospital-phone').textContent   = s.phone   || '';
    document.getElementById('invoice-patient-name').textContent     = p.full_name;
    document.getElementById('invoice-patient-id').textContent       = p.id;
    const now = new Date();
    document.getElementById('invoice-date').textContent  = now.toLocaleDateString('fr-FR');
    document.getElementById('invoice-time').textContent  = now.toLocaleTimeString('fr-FR');
    document.getElementById('invoice-total-amount').textContent   = total.toFixed(2);
    document.getElementById('invoice-amount-given').textContent   = given.toFixed(2) + ' Gdes';
    document.getElementById('invoice-change').textContent         = (given-total).toFixed(2) + ' Gdes';
    document.getElementById('invoice-payment-method').textContent = method;
    document.getElementById('invoice-number').textContent         = 'INV-' + Date.now();
    document.getElementById('invoice-services-list').innerHTML    = state.selectedServices.map(s =>
        `<div class="receipt-item"><span>${s.service}</span><span>${s.finalAmount.toFixed(2)} Gdes</span></div>`
    ).join('');
    document.getElementById('invoice-container').classList.remove('hidden');
}

// ─── INFIRMIER ───────────────────────────────────────────────
function updateVitalsInputs() {
    const container = document.getElementById('vitals-inputs-container');
    container.innerHTML = state.vitalTypes.filter(v => v.active).map(v => `
        <div class="vital-item">
            <label class="form-label">${v.name} (${v.unit})</label>
            <input type="text" class="form-control vital-input" data-id="${v.id}" placeholder="Valeur">
            <small class="text-muted">Norm: ${v.min} – ${v.max} ${v.unit}</small>
        </div>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('search-nurse-patient').addEventListener('click', async () => {
        const search = document.getElementById('nurse-patient-search').value.trim();
        try {
            const patients = await apiCall(() => API.getPatients({ search }));
            if (!patients.length) { toast('Patient non trouvé', 'error'); return; }
            const p = patients[0];
            document.getElementById('nurse-patient-name').textContent = p.full_name;
            document.getElementById('nurse-patient-id').textContent   = p.id;
            const txs = await API.getTransactions({ patientId: p.id, status: 'unpaid' });
            const unpaid = txs.length > 0;
            document.getElementById('nurse-payment-status').textContent = unpaid ? 'Non payé' : 'Payé';
            document.getElementById('nurse-payment-status').className   = `patient-status-badge ${unpaid?'status-unpaid':'status-paid'}`;
            document.getElementById('nurse-patient-details').classList.remove('hidden');
            loadVitalsHistory(p.id);
        } catch(e) {}
    });

    document.getElementById('vitals-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const patientId = document.getElementById('nurse-patient-id').textContent;
        const values = {};
        document.querySelectorAll('.vital-input').forEach(input => {
            const vital = state.vitalTypes.find(v => v.id == input.dataset.id);
            if (vital && input.value.trim()) {
                values[vital.name] = { value: input.value, unit: vital.unit, normalRange: `${vital.min} – ${vital.max}` };
            }
        });
        try {
            await apiCall(() => API.addVitals({ patientId, values }));
            toast('Signes vitaux enregistrés!');
            loadVitalsHistory(patientId);
            e.target.reset();
        } catch(e) {}
    });
});

async function loadVitalsHistory(patientId) {
    const vitals = await API.getVitals(patientId);
    const container = document.getElementById('vitals-history');
    if (!vitals.length) { container.innerHTML = '<p>Aucun signe vital.</p>'; return; }
    const activeVitals = state.vitalTypes.filter(v => v.active);
    container.innerHTML = `<div class="table-container"><table><thead><tr><th>Date/Heure</th>${activeVitals.map(v=>`<th>${v.name}</th>`).join('')}<th>Par</th></tr></thead><tbody>
        ${vitals.map(r => `<tr><td>${r.date} ${r.time}</td>${activeVitals.map(v=>{const val=r.values[v.name];return`<td>${val?val.value+' '+val.unit:'-'}</td>`;}).join('')}<td>${r.taken_by}</td></tr>`).join('')}
    </tbody></table></div>`;
}

// ─── MÉDECIN ─────────────────────────────────────────────────
function updateDoctorConsultationTypes() {
    const sel = document.getElementById('doctor-consultation-type');
    sel.innerHTML = '<option value="">Sélectionner...</option>';
    state.consultationTypes.filter(ct => ct.active).forEach(ct => {
        sel.innerHTML += `<option value="${ct.id}">${ct.name} — ${ct.price} Gdes</option>`;
    });
}

function updateLabAnalysesSelect() {
    const container = document.getElementById('lab-analyses-selection');
    container.innerHTML = state.labAnalysisTypes.filter(a => a.active).map(a => `
        <label style="display:block;margin-bottom:5px;">
            <input type="checkbox" value="${a.id}" data-price="${a.price}">
            ${a.name} (${a.price} Gdes)
        </label>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('search-doctor-patient').addEventListener('click', async () => {
        const search = document.getElementById('doctor-patient-search').value.trim();
        try {
            const patients = await apiCall(() => API.getPatients({ search }));
            if (!patients.length) { toast('Patient non trouvé', 'error'); return; }
            const p = patients[0];
            state.currentDoctorPatient = p;
            const birth = new Date(p.birth_date);
            const age   = Math.floor((new Date() - birth) / (365.25*24*60*60*1000));
            document.getElementById('doctor-patient-name').textContent  = p.full_name;
            document.getElementById('doctor-patient-id').textContent    = p.id;
            document.getElementById('doctor-patient-age').textContent   = age;
            document.getElementById('doctor-patient-phone').textContent = p.phone;
            document.getElementById('doctor-patient-type').textContent  = p.type;
            const txs = await API.getTransactions({ patientId: p.id });
            const unpaid = txs.filter(t => t.status==='unpaid').length;
            const paid   = txs.filter(t => t.status==='paid').length;
            let statusText = unpaid===0&&paid>0?'Tout payé':paid>0&&unpaid>0?'Partiel':'Non payé';
            let statusClass= unpaid===0&&paid>0?'status-paid':paid>0&&unpaid>0?'status-partial':'status-unpaid';
            document.getElementById('doctor-payment-status').textContent = statusText;
            document.getElementById('doctor-payment-status').className   = `patient-status-badge ${statusClass}`;
            // Consultation existante
            const consult = txs.find(t => t.type==='consultation');
            document.getElementById('current-consultation-info').innerHTML = consult ?
                `<p><strong>Type:</strong> ${consult.service}</p><p><strong>Montant:</strong> ${consult.amount} Gdes</p><p><strong>Statut:</strong> <span class="${consult.status==='paid'?'status-paid':'status-unpaid'}">${consult.status==='paid'?'Payé':'Non payé'}</span></p>` :
                '<p>Aucune consultation enregistrée.</p>';
            document.getElementById('consultation-modification-section').classList.toggle('hidden', !consult || consult.status==='paid');
            // Vitaux récents
            const vitals = await API.getVitals(p.id);
            const latest = vitals[0];
            const vitalDisplay = document.getElementById('current-vitals-display');
            if (latest) {
                vitalDisplay.innerHTML = Object.entries(latest.values).map(([name, v]) =>
                    `<p><strong>${name}:</strong> ${v.value} ${v.unit} <small>(Norm: ${v.normalRange})</small></p>`).join('');
                vitalDisplay.dataset.vitalId = latest.id;
            } else {
                vitalDisplay.innerHTML = '<p>Aucun signe vital enregistré.</p>';
            }
            document.getElementById('doctor-patient-details').classList.remove('hidden');
        } catch(e) {}
    });

    document.getElementById('edit-vitals-btn').addEventListener('click', () => {
        const mod = document.getElementById('doctor-vitals-modification');
        mod.classList.remove('hidden');
        const container = document.getElementById('vitals-modification-inputs');
        container.innerHTML = state.vitalTypes.filter(v=>v.active).map(v=>`
            <div class="vital-item">
                <label class="form-label">${v.name} (${v.unit})</label>
                <input type="text" class="form-control vital-mod-input" data-id="${v.id}" placeholder="Valeur">
            </div>`).join('');
    });

    document.getElementById('cancel-vitals-modification').addEventListener('click', () => {
        document.getElementById('doctor-vitals-modification').classList.add('hidden');
    });

    document.getElementById('vitals-modification-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const patientId = document.getElementById('doctor-patient-id').textContent;
        const vitalId   = document.getElementById('current-vitals-display').dataset.vitalId;
        const values = {};
        document.querySelectorAll('.vital-mod-input').forEach(input => {
            const vital = state.vitalTypes.find(v => v.id == input.dataset.id);
            if (vital && input.value.trim()) {
                values[vital.name] = { value: input.value, unit: vital.unit, normalRange: `${vital.min} – ${vital.max}` };
            }
        });
        try {
            if (vitalId) { await apiCall(() => API.updateVitals(vitalId, { values })); }
            else         { await apiCall(() => API.addVitals({ patientId, values })); }
            toast('Signes vitaux modifiés!');
            document.getElementById('doctor-vitals-modification').classList.add('hidden');
            document.getElementById('search-doctor-patient').click();
        } catch(e) {}
    });

    document.getElementById('update-consultation-type').addEventListener('click', async () => {
        const typeId = parseInt(document.getElementById('doctor-consultation-type').value);
        if (!typeId) { toast('Sélectionner un type', 'error'); return; }
        const p = state.currentDoctorPatient;
        const txs = await API.getTransactions({ patientId: p.id, type: 'consultation' });
        if (!txs.length) { toast('Aucune consultation trouvée', 'error'); return; }
        try {
            await apiCall(() => API.updateConsultationType(txs[0].id, typeId));
            toast('Type de consultation modifié. Le patient doit retourner à la caisse si le prix est plus élevé.');
            document.getElementById('search-doctor-patient').click();
        } catch(e) {}
    });

    // Analyses
    document.getElementById('modify-analyses-btn').addEventListener('click', () => {
        document.getElementById('lab-modification-panel').classList.toggle('hidden');
    });
    document.getElementById('save-modified-analysis').addEventListener('click', () => {
        const name  = document.getElementById('modified-analysis-name').value;
        const price = parseFloat(document.getElementById('modified-analysis-price').value);
        if (!name || isNaN(price)) { toast('Remplir tous les champs', 'error'); return; }
        state.currentModifiedAnalysis = { ...state.currentModifiedAnalysis, modifiedName: name, modifiedPrice: price };
        document.getElementById('lab-modification-panel').classList.add('hidden');
        toast('Analyse modifiée pour ce patient uniquement');
    });
    document.getElementById('cancel-analysis-modification').addEventListener('click', () => {
        document.getElementById('lab-modification-panel').classList.add('hidden');
        state.currentModifiedAnalysis = null;
    });

    // Médicament search
    document.getElementById('medication-search').addEventListener('input', function () {
        const q = this.value.toLowerCase();
        const sug = document.getElementById('medication-suggestions');
        if (q.length < 2) { sug.classList.add('hidden'); return; }
        const matches = state.medications.filter(m => m.name.toLowerCase().includes(q) || (m.generic_name||'').toLowerCase().includes(q)).slice(0,5);
        if (matches.length) {
            sug.innerHTML = matches.map(m => `<div class="suggestion-item" style="padding:5px 10px;cursor:pointer;" onclick="addMedToPrescription('${m.id}')">${m.name} (${m.form}) — Stock: ${m.quantity}</div>`).join('');
            sug.classList.remove('hidden');
        } else { sug.classList.add('hidden'); }
    });

    // Formulaire consultation
    document.getElementById('consultation-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.currentDoctorPatient) { toast('Sélectionner un patient', 'error'); return; }
        const p        = state.currentDoctorPatient;
        const diagnosis    = document.getElementById('consultation-diagnosis').value;
        const followupDate = document.getElementById('followup-date').value;
        const followupTime = document.getElementById('followup-time').value;

        try {
            // Enregistrer consultation
            await apiCall(() => API.addConsultation({ patientId: p.id, patientName: p.full_name, diagnosis, followupDate, followupTime }));

            // Enregistrer analyses demandées
            const checkedAnalyses = document.querySelectorAll('#lab-analyses-selection input:checked');
            for (const cb of checkedAnalyses) {
                const aId = parseInt(cb.value);
                const aType = state.labAnalysisTypes.find(a => a.id === aId);
                if (!aType) continue;
                let name  = state.currentModifiedAnalysis?.id === aId && state.currentModifiedAnalysis.modifiedName ? state.currentModifiedAnalysis.modifiedName : aType.name;
                let price = state.currentModifiedAnalysis?.id === aId && state.currentModifiedAnalysis.modifiedPrice ? state.currentModifiedAnalysis.modifiedPrice : aType.price;
                await API.addTransaction({ patientId: p.id, patientName: p.full_name, service: `Analyse: ${name}`, amount: price, type: 'lab', analysisId: aId });
            }

            // Enregistrer médicaments prescrits
            const medRows = document.querySelectorAll('#prescription-medications-list tr');
            for (const row of medRows) {
                const medId  = row.querySelector('.quantity-input').dataset.medId;
                const qty    = parseInt(row.querySelector('.quantity-input').value);
                const dosage = row.querySelectorAll('input')[1].value;
                const med    = state.medications.find(m => m.id === medId);
                if (!med) continue;
                if (qty > med.quantity) { toast(`Stock insuffisant pour ${med.name}`, 'error'); continue; }
                await API.addTransaction({ patientId: p.id, patientName: p.full_name, service: `Médicament: ${med.name}`, amount: med.price * qty, type: 'medication', medicationId: med.id, dosage, quantity: qty });
            }

            toast('Consultation enregistrée!');
            state.currentModifiedAnalysis = null;
            e.target.reset();
            document.getElementById('prescription-medications-list').innerHTML = '';
            // Notifier
            await API.sendMessage({ recipient: 'cashier', recipientRole: 'cashier', subject: 'Consultation enregistrée', content: `Consultation enregistrée pour ${p.full_name} (${p.id})`, type: 'notification' }).catch(()=>{});
        } catch(e) {}
    });
});

function addMedToPrescription(medId) {
    const med = state.medications.find(m => m.id === medId);
    if (!med) return;
    const tbody = document.getElementById('prescription-medications-list');
    const row   = document.createElement('tr');
    row.innerHTML = `
        <td>${med.name}</td>
        <td><input type="text" class="form-control" value="1 comprimé 3x/jour"></td>
        <td><input type="number" class="form-control quantity-input" data-med-id="${med.id}" value="10" min="1" max="${med.quantity}"></td>
        <td>${med.quantity}</td>
        <td><button class="btn btn-danger btn-sm" onclick="this.closest('tr').remove()">Supprimer</button></td>`;
    tbody.appendChild(row);
    document.getElementById('medication-suggestions').classList.add('hidden');
    document.getElementById('medication-search').value = '';
}

async function loadDoctorAppointments() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const apps = await API.getAppointments({ doctor: state.currentUser.username, fromDate: today });
        const container = document.getElementById('doctor-appointments-list');
        container.innerHTML = apps.map(a => `
            <div class="appointment-item">
                <strong>${a.patient_name}</strong> — ${a.date} à ${a.time}<br>
                <small>Motif: ${a.reason||'-'}</small>
                <span class="appointment-status status-${a.status==='scheduled'?'pending':a.status} ml-2">${a.status}</span>
                <div class="appointment-actions">
                    <button class="btn btn-sm btn-success" onclick="updateApptStatus('${a.id}','completed')">Terminé</button>
                </div>
            </div>`).join('') || '<p>Aucun rendez-vous.</p>';
    } catch(e) {}
}

// ─── LABORATOIRE ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('search-lab-patient').addEventListener('click', async () => {
        const search = document.getElementById('lab-patient-search').value.trim();
        try {
            const patients = await apiCall(() => API.getPatients({ search }));
            if (!patients.length) { toast('Patient non trouvé', 'error'); return; }
            const p = patients[0];
            document.getElementById('lab-patient-name').textContent = p.full_name;
            document.getElementById('lab-patient-id').textContent   = p.id;
            const txs = await API.getTransactions({ patientId: p.id, type: 'lab' });
            const unpaid = txs.filter(t => t.status==='unpaid').length;
            const paid   = txs.filter(t => t.status==='paid').length;
            let statusText = unpaid===0&&paid>0?'Tout payé':paid>0&&unpaid>0?'Partiellement payé':unpaid>0?'Non payé':'Aucune analyse';
            let statusClass= unpaid===0&&paid>0?'status-paid':paid>0&&unpaid>0?'status-partial':unpaid>0?'status-unpaid':'';
            document.getElementById('lab-payment-status').textContent = statusText;
            document.getElementById('lab-payment-status').className   = `patient-status-badge ${statusClass}`;
            const labList = document.getElementById('lab-analyses-list');
            labList.innerHTML = txs.map(t => `
                <div class="card mb-2">
                    <div class="d-flex justify-between">
                        <div>
                            <h5>${t.service}</h5>
                            <p>Statut paiement: <span class="${t.status==='paid'?'status-paid':'status-unpaid'}">${t.status==='paid'?'Payé':'Non payé'}</span></p>
                            <p>Analyse: <span class="${t.lab_status==='completed'?'status-paid':'status-unpaid'}">${t.lab_status||'En attente'}</span></p>
                        </div>
                        <div>
                            ${t.status==='paid'&&t.lab_status!=='completed'?`<button class="btn btn-success" onclick="enterLabResult('${t.id}')">Saisir résultat</button>`:''}
                            ${t.result?`<button class="btn btn-info" onclick="viewLabResult('${t.id}')">Voir résultat</button>`:''}
                        </div>
                    </div>
                    ${t.result?`<div class="mt-2"><strong>Résultat:</strong><br><pre>${t.result.startsWith('data:')?`<img src="${t.result}" style="max-width:200px;">`:t.result}</pre></div>`:''}
                </div>`).join('') || '<p>Aucune analyse.</p>';
            document.getElementById('lab-patient-details').classList.remove('hidden');
            updatePendingAnalysesList();
        } catch(e) {}
    });
});

async function updatePendingAnalysesList() {
    try {
        const txs = await API.getTransactions({ type: 'lab' });
        const pending = txs.filter(t => t.status==='paid' && t.lab_status!=='completed');
        const container = document.getElementById('pending-analyses-list');
        container.innerHTML = pending.length ?
            `<div class="table-container"><table><thead><tr><th>Patient</th><th>Analyse</th><th>Date</th><th>Action</th></tr></thead><tbody>
                ${pending.map(t=>`<tr><td>${t.patient_name}</td><td>${t.service}</td><td>${t.date}</td>
                <td><button class="btn btn-sm btn-success" onclick="enterLabResult('${t.id}')">Saisir</button></td></tr>`).join('')}
            </tbody></table></div>` : '<p>Aucune analyse en attente.</p>';
    } catch(e) {}
}

function enterLabResult(txId) {
    const modal = document.createElement('div');
    modal.id = 'lab-result-modal';
    modal.className = 'transaction-details-modal';
    modal.innerHTML = `<div class="transaction-details-content">
        <h4>Saisir résultat</h4>
        <textarea id="lab-result-text" class="form-control" rows="5" placeholder="Résultat..."></textarea>
        <div style="margin-top:10px;">
            <label>Ou image: <input type="file" id="lab-result-image" accept="image/*"></label>
        </div>
        <div class="mt-3">
            <button class="btn btn-success" onclick="saveLabResultFn('${txId}')">Enregistrer</button>
            <button class="btn btn-secondary" onclick="document.getElementById('lab-result-modal').remove()">Annuler</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
}

async function saveLabResultFn(txId) {
    const fileInput = document.getElementById('lab-result-image');
    const textVal   = document.getElementById('lab-result-text').value;
    try {
        if (fileInput.files[0]) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                await apiCall(() => API.saveLabResult(txId, e.target.result));
                toast('Résultat image enregistré!');
                document.getElementById('lab-result-modal').remove();
                updatePendingAnalysesList();
                // Notifier médecin
                await API.sendMessage({ recipient: 'doctor', recipientRole: 'doctor', subject: 'Résultat disponible', content: `Résultat analyse disponible (${txId})`, type: 'lab_result' }).catch(()=>{});
            };
            reader.readAsDataURL(fileInput.files[0]);
        } else {
            if (!textVal.trim()) { toast('Entrer un résultat', 'error'); return; }
            await apiCall(() => API.saveLabResult(txId, textVal));
            toast('Résultat enregistré!');
            document.getElementById('lab-result-modal').remove();
            updatePendingAnalysesList();
            await API.sendMessage({ recipient: 'doctor', recipientRole: 'doctor', subject: 'Résultat disponible', content: `Résultat analyse disponible (${txId})`, type: 'lab_result' }).catch(()=>{});
        }
    } catch(e) {}
}

function viewLabResult(txId) {
    // Affichage dans un modal — on relit depuis l'API
    API.getTransactions({}).then(txs => {
        const t = txs.find(x => x.id === txId);
        if (!t || !t.result) return;
        const modal = document.createElement('div');
        modal.className = 'transaction-details-modal';
        modal.innerHTML = `<div class="transaction-details-content">
            <h4>${t.service}</h4>
            ${t.result.startsWith('data:')?`<img src="${t.result}" style="max-width:100%;">`:`<pre>${t.result}</pre>`}
            <button class="btn btn-secondary mt-3" onclick="this.closest('.transaction-details-modal').remove()">Fermer</button>
        </div>`;
        document.body.appendChild(modal);
    });
}

// ─── PHARMACIE ───────────────────────────────────────────────
async function updateMedicationStockDisplay() {
    const meds = await API.getMedications().catch(()=>[]);
    state.medications = meds;
    const container = document.getElementById('medication-stock-list');
    container.innerHTML = `<table><thead><tr><th>Médicament</th><th>Forme</th><th>Unité</th><th>Stock</th><th>Alerte</th><th>Prix</th><th>Statut</th></tr></thead><tbody>
        ${meds.map(m=>`<tr class="${m.quantity===0?'out-of-stock':m.quantity<=m.alert_threshold?'low-stock':''}">
            <td>${m.name}</td><td>${m.form||'-'}</td><td>${m.unit||'-'}</td>
            <td>${m.quantity}</td><td>${m.alert_threshold}</td><td>${m.price} Gdes</td>
            <td>${m.quantity===0?'<span class="status-unpaid">Rupture</span>':m.quantity<=m.alert_threshold?'<span class="status-partial">Stock faible</span>':'<span class="status-paid">OK</span>'}</td>
        </tr>`).join('')}
    </tbody></table>`;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('search-pharmacy-patient').addEventListener('click', async () => {
        const search = document.getElementById('pharmacy-patient-search').value.trim();
        try {
            const patients = await apiCall(() => API.getPatients({ search }));
            if (!patients.length) { toast('Patient non trouvé', 'error'); return; }
            const p = patients[0];
            document.getElementById('pharmacy-patient-name').textContent = p.full_name;
            document.getElementById('pharmacy-patient-id').textContent   = p.id;
            const txs = await API.getTransactions({ patientId: p.id, type: 'medication' });
            const unpaid = txs.filter(t => t.status==='unpaid').length;
            const paid   = txs.filter(t => t.status==='paid').length;
            let st = unpaid===0&&paid>0?'Tout payé':paid>0&&unpaid>0?'Partiellement payé':unpaid>0?'Non payé':'Aucun médicament';
            let sc = unpaid===0&&paid>0?'status-paid':paid>0&&unpaid>0?'status-partial':unpaid>0?'status-unpaid':'';
            document.getElementById('pharmacy-payment-status').textContent = st;
            document.getElementById('pharmacy-payment-status').className   = `patient-status-badge ${sc}`;
            document.getElementById('pharmacy-prescriptions-list').innerHTML = txs.map(t => `
                <div class="card mb-2">
                    <div class="d-flex justify-between">
                        <div>
                            <h5>${t.service}</h5>
                            <p>Posologie: ${t.dosage||'-'}</p>
                            <p>Paiement: <span class="${t.status==='paid'?'status-paid':'status-unpaid'}">${t.status==='paid'?'Payé':'Non payé'}</span></p>
                            <p>Livraison: <span class="${t.delivery_status==='delivered'?'status-paid':'status-unpaid'}">${t.delivery_status||'En attente'}</span></p>
                        </div>
                        <div>
                            ${t.status==='paid'&&t.delivery_status!=='delivered'?`<button class="btn btn-success" onclick="deliverMed('${t.id}')">Délivrer</button>`:''}
                            ${t.delivery_status==='delivered'?'<span class="text-success"><i class="fas fa-check"></i> Délivré</span>':''}
                        </div>
                    </div>
                </div>`).join('') || '<p>Aucun médicament prescrit.</p>';
            const hasDeliverable = txs.some(t => t.status==='paid' && t.delivery_status!=='delivered');
            document.getElementById('deliver-medications').disabled = !hasDeliverable;
            document.getElementById('pharmacy-patient-details').classList.remove('hidden');
        } catch(e) {}
    });

    document.getElementById('deliver-medications').addEventListener('click', async () => {
        const patientId = document.getElementById('pharmacy-patient-id').textContent;
        const txs = await API.getTransactions({ patientId, type: 'medication' });
        const deliverable = txs.filter(t => t.status==='paid' && t.delivery_status!=='delivered');
        for (const t of deliverable) {
            try { await apiCall(() => API.deliverMedication(t.id)); } catch(e) { break; }
        }
        toast('Médicaments délivrés!');
        document.getElementById('search-pharmacy-patient').click();
        await updateMedicationStockDisplay();
        state.medications = await API.getMedications().catch(()=>[]);
    });

    document.getElementById('add-new-medication').addEventListener('click', () => {
        document.getElementById('new-medication-form').style.display = 'block';
    });
    document.getElementById('cancel-new-medication').addEventListener('click', () => {
        document.getElementById('new-medication-form').style.display = 'none';
    });
    document.getElementById('save-new-medication').addEventListener('click', async () => {
        const name    = document.getElementById('new-med-name').value.trim();
        const generic = document.getElementById('new-med-generic').value.trim();
        const form    = document.getElementById('new-med-form').value;
        const unit    = document.getElementById('new-med-unit').value.trim();
        const qty     = parseInt(document.getElementById('new-med-quantity').value);
        const alert   = parseInt(document.getElementById('new-med-alert').value);
        const price   = parseFloat(document.getElementById('new-med-price').value);
        if (!name || !form || !unit || isNaN(qty) || isNaN(alert) || isNaN(price)) { toast('Remplir tous les champs', 'error'); return; }
        try {
            const med = await apiCall(() => API.addMedication({ name, genericName: generic, form, unit, quantity: qty, alertThreshold: alert, price }));
            state.medications.push(med);
            toast('Médicament ajouté!');
            document.getElementById('new-medication-form').style.display = 'none';
            updateMedicationStockDisplay();
        } catch(e) {}
    });
});

async function deliverMed(txId) {
    try {
        await apiCall(() => API.deliverMedication(txId));
        toast('Médicament délivré!');
        document.getElementById('search-pharmacy-patient').click();
        state.medications = await API.getMedications().catch(()=>[]);
    } catch(e) {}
}

// ─── MESSAGERIE ──────────────────────────────────────────────
let currentConversationPartner = null;

async function checkUnreadMessages() {
    try {
        const data = await API.getUnreadCount();
        const badge = document.getElementById('message-badge');
        if (data.count > 0) { badge.textContent = data.count; badge.classList.remove('hidden'); }
        else { badge.classList.add('hidden'); }
    } catch(e) {}
}

async function loadConversations() {
    const messages = await API.getMessages().catch(()=>[]);
    // Regrouper par expéditeur
    const convMap = {};
    messages.forEach(m => {
        const partner = m.sender === state.currentUser.username ? m.recipient : m.sender;
        if (!convMap[partner]) convMap[partner] = { messages: [], unread: 0 };
        convMap[partner].messages.push(m);
        if (!m.read && m.recipient === state.currentUser.username) convMap[partner].unread++;
    });
    const list = document.getElementById('conversation-list');
    list.innerHTML = Object.entries(convMap).map(([partner, data]) => `
        <div class="conversation-item d-flex ${partner===currentConversationPartner?'active':''}" onclick="openConversation('${partner}')">
            <div class="conversation-avatar">${partner[0].toUpperCase()}</div>
            <div class="conversation-info">
                <strong>${partner}</strong>
                ${data.unread>0?`<span class="notification-badge" style="position:static;display:inline-flex;">${data.unread}</span>`:''}
                <p class="conversation-last-message">${data.messages[data.messages.length-1]?.subject||''}</p>
            </div>
        </div>`).join('') || '<p>Aucune conversation.</p>';
}

async function openConversation(partner) {
    currentConversationPartner = partner;
    document.getElementById('compose-panel').classList.add('hidden');
    document.getElementById('chat-panel').style.display = 'block';
    const messages = await API.getMessages().catch(()=>[]);
    const conv = messages.filter(m => m.sender === partner || m.recipient === partner);
    // Marquer comme lus
    for (const m of conv.filter(m => !m.read && m.recipient === state.currentUser.username)) {
        await API.markRead(m.id).catch(()=>{});
    }
    checkUnreadMessages();
    const chatEl = document.getElementById('chat-messages');
    chatEl.innerHTML = conv.map(m => {
        const sent = m.sender === state.currentUser.username;
        return `<div class="message-bubble ${sent?'sent':'received'}">
            <div class="message-bubble-content">
                ${m.subject?`<strong>${m.subject}</strong><br>`:''}${m.content}
            </div>
            <div class="message-bubble-time">${new Date(m.created_at).toLocaleString('fr-FR')}</div>
        </div>`;
    }).join('');
    chatEl.scrollTop = chatEl.scrollHeight;
    loadConversations();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('compose-message').addEventListener('click', async () => {
        document.getElementById('compose-panel').classList.remove('hidden');
        document.getElementById('chat-panel').style.display = 'none';
        const users = await API.getUsers().catch(()=>[]);
        const sel = document.getElementById('message-recipient');
        sel.innerHTML = '<option value="">Destinataire...</option>';
        users.filter(u => u.username !== state.currentUser.username && u.active).forEach(u => {
            sel.innerHTML += `<option value="${u.username}" data-role="${u.role}">${u.name} (${u.role})</option>`;
        });
    });

    document.getElementById('cancel-compose').addEventListener('click', () => {
        document.getElementById('compose-panel').classList.add('hidden');
    });

    document.getElementById('send-message').addEventListener('click', async () => {
        const sel     = document.getElementById('message-recipient');
        const recip   = sel.value;
        const role    = sel.options[sel.selectedIndex]?.dataset.role;
        const subject = document.getElementById('message-subject').value;
        const content = document.getElementById('message-content').value;
        if (!recip || !content) { toast('Remplir tous les champs', 'error'); return; }
        try {
            await apiCall(() => API.sendMessage({ recipient: recip, recipientRole: role, subject, content, type: 'message' }));
            toast('Message envoyé!');
            document.getElementById('compose-panel').classList.add('hidden');
            document.getElementById('message-subject').value = '';
            document.getElementById('message-content').value = '';
            loadConversations();
        } catch(e) {}
    });

    document.getElementById('send-chat').addEventListener('click', async () => {
        const content = document.getElementById('chat-input').value.trim();
        if (!content || !currentConversationPartner) return;
        try {
            await apiCall(() => API.sendMessage({ recipient: currentConversationPartner, recipientRole: '', subject: '', content, type: 'message' }));
            document.getElementById('chat-input').value = '';
            openConversation(currentConversationPartner);
        } catch(e) {}
    });

    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('send-chat').click();
    });
});

// ─── ADMINISTRATION ──────────────────────────────────────────
async function updateAdminStats() {
    try {
        const stats = await apiCall(() => API.getStats());
        document.getElementById('admin-total-revenue').textContent = stats.totalRevenue.toLocaleString('fr-FR') + ' Gdes';
        const total = stats.totalPatients;
        const paid  = stats.recentTransactions.filter(t=>t.status==='paid').length;
        const unpaid= stats.recentTransactions.filter(t=>t.status==='unpaid').length;
        const sum   = paid + unpaid || 1;
        const pPct  = Math.round(paid/sum*100);
        const uPct  = Math.round(unpaid/sum*100);
        document.getElementById('paid-percentage').textContent   = pPct + '%';
        document.getElementById('unpaid-percentage').textContent = uPct + '%';
        document.getElementById('paid-chart-bar').style.width   = pPct + '%';
        document.getElementById('unpaid-chart-bar').style.width = uPct + '%';

        // Répartition par type (depuis les transactions récentes)
        const txs = stats.recentTransactions;
        const cCount = txs.filter(t=>t.type==='consultation').length;
        const lCount = txs.filter(t=>t.type==='lab').length;
        const mCount = txs.filter(t=>t.type==='medication').length;
        const eCount = txs.filter(t=>t.type==='external').length;
        const tCount = cCount+lCount+mCount+eCount||1;
        document.getElementById('total-services-count').textContent    = tCount;
        document.getElementById('consultations-percentage').textContent = Math.round(cCount/tCount*100)+'%';
        document.getElementById('analyses-percentage').textContent      = Math.round(lCount/tCount*100)+'%';
        document.getElementById('medications-percentage').textContent   = Math.round(mCount/tCount*100)+'%';
        document.getElementById('external-percentage').textContent      = Math.round(eCount/tCount*100)+'%';
        // Pie chart CSS (données réelles)
        const c1 = Math.round(cCount/tCount*100), c2 = c1+Math.round(lCount/tCount*100),
              c3 = c2+Math.round(mCount/tCount*100);
        document.getElementById('pie-chart-visual').style.background =
            `conic-gradient(#1a6bca 0% ${c1}%, #28a745 ${c1}% ${c2}%, #ffc107 ${c2}% ${c3}%, #17a2b8 ${c3}% 100%)`;

        updateRecentTransactionsTable(stats.recentTransactions);
    } catch(e) {}
}

function updateRecentTransactionsTable(txs) {
    document.getElementById('recent-transactions-list').innerHTML = txs.map(t => `
        <tr>
            <td>${t.date} ${t.time||''}</td>
            <td>${t.patient_name}<br><small>${t.patient_id}</small></td>
            <td>${t.service}</td>
            <td>${t.amount} Gdes</td>
            <td>${t.payment_method||'-'}</td>
            <td>${t.created_by||'-'}</td>
            <td><span class="${t.status==='paid'?'status-paid':'status-unpaid'}">${t.status==='paid'?'Payé':'Non payé'}</span></td>
        </tr>`).join('');
}

// Recherche admin (patient avec privilèges)
function setupAdminSearch() {
    document.getElementById('search-admin-patient').addEventListener('click', searchAdminPatient);
}

async function searchAdminPatient() {
    const search = document.getElementById('admin-patient-search').value.trim();
    try {
        const patients = await apiCall(() => API.getPatients({ search }));
        const container = document.getElementById('admin-patient-result');
        if (!patients.length) { container.innerHTML = '<div class="alert alert-danger">Patient non trouvé</div>'; container.classList.remove('hidden'); return; }
        const p = patients[0];
        container.innerHTML = `
            <div class="card">
                <h4>${p.full_name} — ${p.id}</h4>
                <p>Type: ${p.type} | ${p.vip?'<span class="vip-tag">VIP</span>':p.sponsored?`Sponsorisé ${p.discount_percentage}%`:''}</p>
                <div class="privilege-container mt-3">
                    <h5>Modifier les privilèges</h5>
                    <select id="privilege-type" class="form-control" style="width:200px;display:inline-block;">
                        <option value="">Aucun</option>
                        <option value="vip" ${p.vip?'selected':''}>VIP (gratuit)</option>
                        <option value="sponsored" ${p.sponsored?'selected':''}>Sponsorisé (réduction)</option>
                    </select>
                    <div class="sponsored-discount mt-2">
                        <label>Réduction %: <input type="number" id="discount-percentage" class="form-control" style="width:100px;display:inline-block;" value="${p.discount_percentage||0}" min="0" max="100"></label>
                    </div>
                    <button class="btn btn-success mt-2" onclick="savePrivileges('${p.id}')">Enregistrer</button>
                </div>
            </div>`;
        container.classList.remove('hidden');
    } catch(e) {}
}

async function savePrivileges(patientId) {
    const privilegeType      = document.getElementById('privilege-type').value;
    const discountPercentage = parseInt(document.getElementById('discount-percentage').value)||0;
    try {
        await apiCall(() => API.updatePrivilege(patientId, { privilegeType, discountPercentage }));
        toast('Privilèges mis à jour!');
        searchAdminPatient();
    } catch(e) {}
}

// ─── PARAMÈTRES ──────────────────────────────────────────────
async function updateSettingsDisplay() {
    // Types de consultation
    document.getElementById('consultation-types-list').innerHTML = `
        <table><thead><tr><th>Nom</th><th>Prix</th><th>Description</th><th>Actif</th><th>Actions</th></tr></thead><tbody>
        ${state.consultationTypes.map(ct=>`<tr>
            <td>${ct.name}</td>
            <td><input type="number" class="form-control" id="ct-price-${ct.id}" value="${ct.price}" style="width:100px;"></td>
            <td><input type="text" class="form-control" id="ct-desc-${ct.id}" value="${ct.description||''}" style="width:200px;"></td>
            <td><input type="checkbox" ${ct.active?'checked':''} onchange="toggleConsultationType(${ct.id},this.checked)"></td>
            <td>
                <button class="btn btn-sm btn-success" onclick="saveConsultationType(${ct.id})">Sauver</button>
                <button class="btn btn-sm btn-danger" onclick="deleteConsultationType(${ct.id})">Supprimer</button>
            </td>
        </tr>`).join('')}
        </tbody></table>`;

    // Types de signes vitaux
    document.getElementById('vitals-types-list').innerHTML = `
        <table><thead><tr><th>Nom</th><th>Unité</th><th>Min</th><th>Max</th><th>Actif</th><th>Actions</th></tr></thead><tbody>
        ${state.vitalTypes.map(v=>`<tr>
            <td>${v.name}</td><td>${v.unit}</td><td>${v.min}</td><td>${v.max}</td>
            <td><input type="checkbox" ${v.active?'checked':''} onchange="toggleVitalType(${v.id},this.checked)"></td>
            <td><button class="btn btn-sm btn-danger" onclick="deleteVitalType(${v.id})">Supprimer</button></td>
        </tr>`).join('')}
        </tbody></table>`;

    // Types d'analyses
    document.getElementById('lab-analyses-types-list').innerHTML = `
        <table><thead><tr><th>Nom</th><th>Prix</th><th>Type</th><th>Actif</th><th>Actions</th></tr></thead><tbody>
        ${state.labAnalysisTypes.map(a=>`<tr>
            <td>${a.name}</td>
            <td><input type="number" class="form-control" id="la-price-${a.id}" value="${a.price}" style="width:100px;"></td>
            <td>${a.result_type==='image'?'Image':'Texte'}</td>
            <td><input type="checkbox" ${a.active?'checked':''} onchange="toggleLabAnalysisType(${a.id},this.checked)"></td>
            <td>
                <button class="btn btn-sm btn-success" onclick="saveLabAnalysisType(${a.id})">Sauver</button>
                <button class="btn btn-sm btn-danger" onclick="deleteLabAnalysisType(${a.id})">Supprimer</button>
            </td>
        </tr>`).join('')}
        </tbody></table>`;

    // Services externes
    document.getElementById('external-services-types-list').innerHTML = `
        <table><thead><tr><th>Nom</th><th>Prix</th><th>Actif</th><th>Actions</th></tr></thead><tbody>
        ${state.externalServiceTypes.map(s=>`<tr>
            <td>${s.name}</td><td>${s.price} Gdes</td>
            <td><input type="checkbox" ${s.active?'checked':''} onchange="toggleExternalServiceType(${s.id},this.checked)"></td>
            <td><button class="btn btn-sm btn-danger" onclick="deleteExternalServiceType(${s.id})">Supprimer</button></td>
        </tr>`).join('')}
        </tbody></table>`;
}

async function updateMedicationsSettingsList() {
    const meds = await API.getMedications().catch(()=>[]);
    document.getElementById('medications-settings-list').innerHTML = meds.map(m=>`
        <tr>
            <td>${m.name}</td><td>${m.price} Gdes</td><td>${m.quantity}</td><td>${m.alert_threshold}</td>
            <td><button class="btn btn-sm btn-danger" onclick="deleteMedicationSettings('${m.id}')">Supprimer</button></td>
        </tr>`).join('');
    // Userslist
    if (state.currentRole === 'admin') {
        const users = await API.getUsers().catch(()=>[]);
        document.getElementById('users-list').innerHTML = users.map(u=>`
            <tr>
                <td>${u.name}</td><td>${u.role}</td><td>${u.username}</td>
                <td>${u.active?'✅':'❌'}</td>
                <td>
                    <button class="btn btn-sm ${u.active?'btn-warning':'btn-success'}" onclick="toggleUser(${u.id},${!u.active},'${u.name}')">${u.active?'Désactiver':'Activer'}</button>
                </td>
            </tr>`).join('');
    }
}

// Fonctions paramètres
async function saveConsultationType(id) {
    const price = parseFloat(document.getElementById(`ct-price-${id}`).value);
    const desc  = document.getElementById(`ct-desc-${id}`).value;
    const ct    = state.consultationTypes.find(c=>c.id===id);
    await apiCall(() => API.updateConsultationType(id, { name: ct.name, price, description: desc, active: ct.active }));
    Object.assign(ct, { price, description: desc });
    toast('Type de consultation sauvegardé');
}
async function toggleConsultationType(id, active) {
    const ct = state.consultationTypes.find(c=>c.id===id);
    await apiCall(() => API.updateConsultationType(id, { ...ct, active }));
    ct.active = active;
}
async function deleteConsultationType(id) {
    if (!confirm('Supprimer ce type?')) return;
    await apiCall(() => API.deleteConsultationType(id));
    state.consultationTypes = state.consultationTypes.filter(c=>c.id!==id);
    updateSettingsDisplay();
    toast('Type supprimé');
}
async function toggleVitalType(id, active) {
    const vt = state.vitalTypes.find(v=>v.id===id);
    await apiCall(() => API.updateVitalType(id, { ...vt, active }));
    vt.active = active;
    updateVitalsInputs();
}
async function deleteVitalType(id) {
    if (!confirm('Supprimer ce signe vital?')) return;
    await apiCall(() => API.deleteVitalType(id));
    state.vitalTypes = state.vitalTypes.filter(v=>v.id!==id);
    updateSettingsDisplay();
    updateVitalsInputs();
    toast('Signe vital supprimé');
}
async function saveLabAnalysisType(id) {
    const price = parseFloat(document.getElementById(`la-price-${id}`).value);
    const at = state.labAnalysisTypes.find(a=>a.id===id);
    await apiCall(() => API.updateLabAnalysisType(id, { ...at, price }));
    at.price = price;
    toast('Analyse sauvegardée');
}
async function toggleLabAnalysisType(id, active) {
    const at = state.labAnalysisTypes.find(a=>a.id===id);
    await apiCall(() => API.updateLabAnalysisType(id, { ...at, active }));
    at.active = active;
    updateLabAnalysesSelect();
}
async function deleteLabAnalysisType(id) {
    if (!confirm('Supprimer cette analyse?')) return;
    await apiCall(() => API.deleteLabAnalysisType(id));
    state.labAnalysisTypes = state.labAnalysisTypes.filter(a=>a.id!==id);
    updateSettingsDisplay(); updateLabAnalysesSelect();
    toast('Analyse supprimée');
}
async function toggleExternalServiceType(id, active) {
    const st = state.externalServiceTypes.find(s=>s.id===id);
    await apiCall(() => API.updateExternalServiceType(id, { ...st, active }));
    st.active = active;
    updateExternalServicesOptions(); updateExternalServicesSelect();
}
async function deleteExternalServiceType(id) {
    if (!confirm('Supprimer ce service?')) return;
    await apiCall(() => API.deleteExternalServiceType(id));
    state.externalServiceTypes = state.externalServiceTypes.filter(s=>s.id!==id);
    updateSettingsDisplay(); updateExternalServicesOptions(); updateExternalServicesSelect();
    toast('Service supprimé');
}
async function deleteMedicationSettings(id) {
    if (!confirm('Supprimer ce médicament?')) return;
    await apiCall(() => API.deleteMedication(id));
    state.medications = state.medications.filter(m=>m.id!==id);
    updateMedicationsSettingsList();
    toast('Médicament supprimé');
}
async function toggleUser(id, active, name) {
    await apiCall(() => API.updateUser(id, { name, active }));
    toast(`Utilisateur ${active?'activé':'désactivé'}`);
    updateMedicationsSettingsList();
}

document.addEventListener('DOMContentLoaded', () => {
    // Boutons ajout dans paramètres
    document.getElementById('add-consultation-type').addEventListener('click', async () => {
        const name  = document.getElementById('new-consultation-type-name').value.trim();
        const price = parseFloat(document.getElementById('new-consultation-type-price').value);
        const desc  = document.getElementById('new-consultation-type-description').value;
        if (!name || isNaN(price)) { toast('Remplir nom et prix', 'error'); return; }
        const ct = await apiCall(() => API.addConsultationType({ name, price, description: desc }));
        state.consultationTypes.push(ct);
        updateSettingsDisplay(); updateConsultationTypesSelect(); updateDoctorConsultationTypes();
        document.getElementById('new-consultation-type-name').value = '';
        document.getElementById('new-consultation-type-price').value = '';
        document.getElementById('new-consultation-type-description').value = '';
        toast('Type de consultation ajouté!');
    });

    document.getElementById('add-vital-type').addEventListener('click', async () => {
        const name = document.getElementById('new-vital-name').value.trim();
        const unit = document.getElementById('new-vital-unit').value.trim();
        const min  = parseFloat(document.getElementById('new-vital-min').value);
        const max  = parseFloat(document.getElementById('new-vital-max').value);
        if (!name || !unit || isNaN(min) || isNaN(max)) { toast('Remplir tous les champs', 'error'); return; }
        const vt = await apiCall(() => API.addVitalType({ name, unit, min, max }));
        state.vitalTypes.push(vt);
        updateSettingsDisplay(); updateVitalsInputs();
        toast('Signe vital ajouté!');
    });

    document.getElementById('add-lab-analysis-type').addEventListener('click', async () => {
        const name  = document.getElementById('new-lab-analysis-name').value.trim();
        const price = parseFloat(document.getElementById('new-lab-analysis-price').value);
        const resultType = document.getElementById('new-lab-analysis-type').value;
        if (!name || isNaN(price)) { toast('Remplir nom et prix', 'error'); return; }
        const at = await apiCall(() => API.addLabAnalysisType({ name, price, resultType }));
        state.labAnalysisTypes.push(at);
        updateSettingsDisplay(); updateLabAnalysesSelect();
        toast('Analyse ajoutée!');
    });

    document.getElementById('add-external-service-type').addEventListener('click', async () => {
        const name  = document.getElementById('new-external-service-type-name').value.trim();
        const price = parseFloat(document.getElementById('new-external-service-type-price').value);
        if (!name || isNaN(price)) { toast('Remplir nom et prix', 'error'); return; }
        const st = await apiCall(() => API.addExternalServiceType({ name, price }));
        state.externalServiceTypes.push(st);
        updateSettingsDisplay(); updateExternalServicesOptions(); updateExternalServicesSelect();
        toast('Service externe ajouté!');
    });

    document.getElementById('add-medication-settings').addEventListener('click', async () => {
        const name  = document.getElementById('new-medication-name').value.trim();
        const price = parseFloat(document.getElementById('new-medication-price').value);
        const qty   = parseInt(document.getElementById('new-medication-quantity').value);
        const alert = parseInt(document.getElementById('new-medication-alert').value);
        if (!name || isNaN(price) || isNaN(qty) || isNaN(alert)) { toast('Remplir tous les champs', 'error'); return; }
        const med = await apiCall(() => API.addMedication({ name, genericName: name, form: 'Comprimé', unit: 'comprimés', quantity: qty, alertThreshold: alert, price }));
        state.medications.push(med);
        updateMedicationsSettingsList();
        document.getElementById('new-medication-name').value = '';
        document.getElementById('new-medication-price').value = '';
        document.getElementById('new-medication-quantity').value = '';
        document.getElementById('new-medication-alert').value = '';
        toast('Médicament ajouté!');
    });

    document.getElementById('add-user').addEventListener('click', async () => {
        const name     = document.getElementById('new-user-name').value.trim();
        const role     = document.getElementById('new-user-role').value;
        const username = document.getElementById('new-user-username').value.trim();
        const password = document.getElementById('new-user-password').value;
        if (!name || !role || !username || !password) { toast('Remplir tous les champs', 'error'); return; }
        try {
            await apiCall(() => API.addUser({ name, role, username, password }));
            toast(`Utilisateur ${username} créé!`);
            updateMedicationsSettingsList();
            document.getElementById('new-user-name').value = '';
            document.getElementById('new-user-username').value = '';
            document.getElementById('new-user-password').value = '';
        } catch(e) {}
    });

    // Infos hôpital
    document.getElementById('hospital-logo').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('logo-preview').src = e.target.result;
            document.getElementById('logo-preview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('save-hospital-info-btn').addEventListener('click', async () => {
        const name    = document.getElementById('hospital-name').value;
        const address = document.getElementById('hospital-address').value;
        const phone   = document.getElementById('hospital-phone').value;
        const logo    = document.getElementById('logo-preview').src || null;
        try {
            await apiCall(() => API.saveSettings({ name, address, phone, logo }));
            Object.assign(state.hospitalSettings, { name, address, phone, logo });
            applyHospitalSettings();
            toast('Paramètres sauvegardés!');
        } catch(e) {}
    });

    // Fermer modale transaction
    document.getElementById('close-transaction-details')?.addEventListener('click', () => {
        document.getElementById('transaction-details-modal').classList.add('hidden');
    });

    // Init setup type patient
    setupPatientTypeChange();
    setupAdminSearch();

    // Rafraîchir messages toutes les 30s
    setInterval(() => {
        if (state.currentUser) checkUnreadMessages();
    }, 30000);
});
