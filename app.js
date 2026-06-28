// ============================================================
//  APP.JS v2 — Système de Gestion Hospitalier
//  Fonctionnalités: double monnaie, notifications améliorées,
//  sous-admin configurable, notifications cross-département
// ============================================================

// ─── État global ─────────────────────────────────────────────
const state = {
    currentUser:   null,
    currentRole:   null,
    consultationTypes:    [],
    vitalTypes:           [],
    labAnalysisTypes:     [],
    externalServiceTypes: [],
    medications:          [],
    hospitalSettings:     {},
    currentModifiedConsultation: null,
    currentModifiedAnalysis:     null,
    currentCashierPatient:       null,
    selectedServices:            [],
    currentDoctorPatient:        null,
    // Devise caisse
    cashierCurrency: 'HTG',  // 'HTG' ou 'USD'
    reportCurrency:  'HTG',
    exchangeRate:    130,     // HTG par USD (taux par défaut)
    // Permissions sous-admin
    subAdminPermissions: {
        secretary: true, cashier: true, nurse: true, doctor: true,
        laboratory: true, pharmacy: true, messaging: true,
        administration: true, settings: false, users: false, exchangeRate: false,
    },
    // Notifications locales
    localNotifications: [],
};

// ─── Utilitaires monnaie ─────────────────────────────────────
function htgToUsd(htg)  { return (htg / state.exchangeRate).toFixed(2); }
function usdToHtg(usd)  { return (usd * state.exchangeRate).toFixed(2); }
function formatHTG(val) { return parseFloat(val).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' HTG'; }
function formatUSD(val) { return '$' + parseFloat(val).toFixed(2); }
function formatAmount(htgAmount) {
    return `${formatHTG(htgAmount)} <span class="currency-tag usd">${formatUSD(htgToUsd(htgAmount))}</span>`;
}

// ─── Utilitaires UI ─────────────────────────────────────────
function showSpinner()  { document.getElementById('spinner-overlay').classList.remove('hidden'); }
function hideSpinner()  { document.getElementById('spinner-overlay').classList.add('hidden'); }

function toast(msg, type = 'success', title = null) {
    const icons = { success:'fa-check-circle', error:'fa-times-circle', info:'fa-info-circle', warning:'fa-exclamation-triangle' };
    const titles = { success:'Succès', error:'Erreur', info:'Information', warning:'Attention' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
        <i class="fas ${icons[type]||icons.success} toast-icon"></i>
        <div class="toast-body">
            <div class="toast-title">${title || titles[type]}</div>
            <div class="toast-message">${msg}</div>
        </div>
        <button class="toast-close" onclick="this.closest('.toast').remove()"><i class="fas fa-times"></i></button>
        <div class="toast-progress"></div>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => {
        el.classList.add('removing');
        setTimeout(() => el.remove(), 300);
    }, 3200);
}

async function apiCall(fn, errorMsg = 'Erreur') {
    showSpinner();
    try { return await fn(); }
    catch (err) { toast(err.message || errorMsg, 'error'); throw err; }
    finally { hideSpinner(); }
}

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('fr-FR');
}

// ─── Notification locale cross-département ───────────────────
function addLocalNotification(title, body, icon = 'fas fa-bell', color = '#1a6bca') {
    const n = { id: Date.now(), title, body, icon, color, time: new Date(), read: false };
    state.localNotifications.unshift(n);
    if (state.localNotifications.length > 50) state.localNotifications.pop();
    updateNotifPanel();
    updateNotifBadge();
}

function updateNotifPanel() {
    const list = document.getElementById('notif-list');
    if (!list) return;
    const notifs = state.localNotifications;
    if (!notifs.length) {
        list.innerHTML = '<div class="notif-empty"><i class="fas fa-check-circle" style="font-size:1.5rem;color:#28a745;display:block;margin-bottom:6px;"></i>Aucune notification</div>';
        return;
    }
    list.innerHTML = notifs.slice(0, 20).map(n => `
        <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead(${n.id})">
            <div class="notif-icon" style="background:${n.color};"><i class="${n.icon}"></i></div>
            <div class="notif-content">
                <div class="notif-title">${n.title}</div>
                <div class="notif-body">${n.body}</div>
                <div class="notif-time">${n.time.toLocaleTimeString('fr-FR')}</div>
            </div>
            ${n.read ? '' : '<div class="notif-dot"></div>'}
        </div>`).join('');
}

function updateNotifBadge() {
    const unread = state.localNotifications.filter(n => !n.read).length;
    const badge = document.getElementById('notif-count-badge');
    if (!badge) return;
    if (unread > 0) { badge.textContent = unread; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
}

function markNotifRead(id) {
    const n = state.localNotifications.find(x => x.id === id);
    if (n) n.read = true;
    updateNotifPanel();
    updateNotifBadge();
}

// Notifications spécifiques par action
function notifyDepartment(role, title, body, color) {
    // Envoie message API + notif locale si la personne est dans ce rôle ou admin
    const icons = {
        cashier: 'fas fa-cash-register', pharmacy: 'fas fa-pills',
        doctor: 'fas fa-user-md', lab: 'fas fa-flask',
        nurse: 'fas fa-user-nurse', secretary: 'fas fa-user-tie',
    };
    const icon = icons[role] || 'fas fa-bell';
    if (state.currentRole === role || state.currentRole === 'admin' || state.currentRole === 'sub_admin') {
        addLocalNotification(title, body, icon, color || '#1a6bca');
    }
    return API.sendMessage({
        recipient: role, recipientRole: role,
        subject: title, content: body, type: 'notification',
    }).catch(() => {});
}

// ─── UTILITAIRES UI SUPPLÉMENTAIRES ─────────────────────────
function togglePasswordView() {
    var input = document.getElementById('password');
    var icon  = document.getElementById('eye-icon');
    if (!input || !icon) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// Ripple effect sur tous les boutons
document.addEventListener('click', function(e) {
    var btn = e.target.closest('.btn');
    if (!btn) return;
    btn.classList.remove('ripple');
    void btn.offsetWidth; // reflow
    btn.classList.add('ripple');
    setTimeout(function() { btn.classList.remove('ripple'); }, 500);
});

// ─── CAISSE: Modal + Reset après paiement ────────────────────
function showPrintModal(totalHTG, givenHTG, payCurrency, method) {
    const change = givenHTG - totalHTG;
    const nom = state.currentCashierPatient ? state.currentCashierPatient.full_name : '';
    var old = document.getElementById('print-modal');
    if (old) old.remove();
    var modal = document.createElement('div');
    modal.id = 'print-modal';
    modal.className = 'transaction-details-modal';
    modal.innerHTML =
        '<div class="transaction-details-content" style="max-width:400px;text-align:center;">' +
        '<div style="width:70px;height:70px;background:#d4edda;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">' +
        '<i class="fas fa-check-circle" style="font-size:2.2rem;color:#28a745;"></i></div>' +
        '<h3 style="color:#28a745;margin-bottom:6px;">Paiement confirmé !</h3>' +
        '<p style="color:#6c757d;margin-bottom:18px;">' + nom + '</p>' +
        '<div style="background:#f8f9fa;border-radius:10px;padding:16px;margin-bottom:20px;text-align:left;">' +
        '<div style="display:flex;justify-content:space-between;padding:5px 0;"><span>Total HTG</span><strong>' + totalHTG.toFixed(2) + ' HTG</strong></div>' +
        '<div style="display:flex;justify-content:space-between;padding:5px 0;"><span>Total USD</span><strong>$' + htgToUsd(totalHTG) + '</strong></div>' +
        '<div style="display:flex;justify-content:space-between;padding:5px 0;"><span>Reçu (' + payCurrency + ')</span><strong>' + givenHTG.toFixed(2) + ' HTG</strong></div>' +
        '<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #dee2e6;margin-top:6px;">' +
        '<span><strong>Monnaie rendue</strong></span>' +
        '<strong style="color:#28a745;font-size:1.1rem;">' + change.toFixed(2) + ' HTG ≈ $' + htgToUsd(change) + '</strong></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
        '<button onclick="doPrint()" class="btn btn-warning" style="padding:14px;"><i class="fas fa-print"></i><br><small>Imprimer reçu</small></button>' +
        '<button onclick="skipPrint()" class="btn btn-success" style="padding:14px;"><i class="fas fa-arrow-right"></i><br><small>Suivant</small></button>' +
        '</div></div>';
    document.body.appendChild(modal);
}

function doPrint() {
    var modal = document.getElementById('print-modal');
    if (modal) modal.remove();
    window.print();
    setTimeout(function() { retourCaisse(); }, 800);
}

function skipPrint() {
    var modal = document.getElementById('print-modal');
    if (modal) modal.remove();
    retourCaisse();
}

function retourCaisse() {
    state.currentCashierPatient = null;
    state.selectedServices = [];
    var fields = {
        'cashier-patient-search': function(el) { el.value = ''; },
        'amount-given':           function(el) { el.value = ''; },
        'change-result':          function(el) { el.textContent = 'Monnaie: 0.00'; el.style.color = ''; },
        'total-to-pay':           function(el) { el.textContent = '0.00'; },
        'total-to-pay-usd':       function(el) { el.textContent = '$0.00'; },
        'services-to-pay-list':   function(el) { el.innerHTML = ''; },
    };
    Object.keys(fields).forEach(function(id) {
        var el = document.getElementById(id);
        if (el) fields[id](el);
    });
    ['cashier-patient-details','invoice-container'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('.payment-method').forEach(function(m) { m.classList.remove('active'); });
    var cash = document.querySelector('.payment-method[data-method="cash"]');
    if (cash) cash.classList.add('active');
    setTimeout(function() {
        var f = document.getElementById('cashier-patient-search');
        if (f) f.focus();
    }, 150);
    toast('Prêt pour le prochain patient', 'success', 'Caisse réinitialisée');
}

// ─── NOTIFICATION ADMIN ───────────────────────────────────────
function notifyAdmin(title, body) {
    if (state.currentRole === 'admin' || state.currentRole === 'sub_admin') {
        addLocalNotification(title, body, 'fas fa-money-bill-wave', '#28a745');
    }
    return Promise.all([
        API.sendMessage({ recipient: 'admin',     recipientRole: 'admin',     subject: title, content: body, type: 'notification' }).catch(function(){}),
        API.sendMessage({ recipient: 'sub_admin', recipientRole: 'sub_admin', subject: title, content: body, type: 'notification' }).catch(function(){}),
    ]);
}

// ─── INITIALISATION ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupLogin();
    setupNavigation();
    setupCurrencyHandlers();
    setupNotifBell();
    setupExchangeRateSettings();

    // Rafraîchir messages et notifs toutes les 30s
    setInterval(() => {
        if (state.currentUser) {
            checkUnreadMessages();
        }
    }, 30000);
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
            state.currentUser  = data.user;
            state.currentRole  = role;
            state.currentRoles = data.user.roles || [role]; // tous les rôles si compte multi

            document.getElementById('current-username').textContent = data.user.name;
            // Afficher tous les rôles si compte multi
            var roleDisplay = state.currentRoles.length > 1
                ? state.currentRoles.map(function(r) { return getRoleLabel(r); }).join(' + ')
                : getRoleLabel(role);
            document.getElementById('current-user-role').textContent = roleDisplay;
            document.getElementById('dashboard-role').textContent    = roleDisplay;

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
            state.currentUser = null;
            state.currentRole = null;
            state.localNotifications = [];
            document.getElementById('main-app').classList.add('hidden');
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
            // Reset role buttons
            document.querySelectorAll('.login-role-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.login-role-btn[data-role="admin"]').classList.add('active');
        }
    });
}

function getRoleLabel(role) {
    const labels = {
        admin:     'Administrateur Principal',
        sub_admin: 'Sous-Administrateur',
        multi:     'Multi-Rôle',
        secretary: 'Secrétariat',
        cashier:   'Caissier',
        nurse:     'Infirmier',
        doctor:    'Médecin',
        lab:       'Laboratoire',
        pharmacy:  'Pharmacie',
    };
    return labels[role] || role;
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

        // Charger taux de change depuis les paramètres
        if (settings.exchangeRate) {
            state.exchangeRate = parseFloat(settings.exchangeRate) || 130;
        }

        // Charger permissions sous-admin
        if (settings.subAdminPermissions) {
            state.subAdminPermissions = { ...state.subAdminPermissions, ...settings.subAdminPermissions };
        }

        applyHospitalSettings();
        updateConsultationTypesSelect();
        updateVitalsInputs();
        updateLabAnalysesSelect();
        updateExternalServicesSelect();
        updateExternalServicesOptions();
        updateDoctorConsultationTypes();
        updateExchangeRateDisplay();
    } catch (err) {
        toast('Erreur chargement des données', 'error');
    }
}

function applyHospitalSettings() {
    const s = state.hospitalSettings;
    if (s.name) {
        document.getElementById('hospital-name-login').textContent = s.name;
        document.getElementById('hospital-name-header').textContent = s.name;
        const hn = document.getElementById('hospital-name');
        if (hn) hn.value = s.name;
    }
    if (s.address) {
        document.getElementById('hospital-address-header').textContent = s.address;
        const ha = document.getElementById('hospital-address');
        if (ha) ha.value = s.address;
    }
    const hp = document.getElementById('hospital-phone');
    if (s.phone && hp) hp.value = s.phone;
    if (s.logo) {
        ['header-logo','login-logo','card-logo','certificate-logo','invoice-logo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.src = s.logo; el.style.display = 'block'; }
        });
        const hi = document.getElementById('header-icon');
        const li = document.getElementById('login-icon');
        if (hi) hi.style.display = 'none';
        if (li) li.style.display = 'none';
    }
    // Exchange rate field
    const eri = document.getElementById('exchange-rate-input');
    if (eri) eri.value = state.exchangeRate;
    updateExchangeRateDisplay();
}

function updateExchangeRateDisplay() {
    const rate = state.exchangeRate;
    const displays = document.querySelectorAll('[id*="exchange-rate-display"]');
    displays.forEach(el => el.textContent = `${rate} HTG = 1 USD`);
    const preview = document.getElementById('exchange-preview');
    if (preview) preview.innerHTML = `<i class="fas fa-info-circle"></i> <span>Taux actuel : <strong>${rate} HTG = 1 USD</strong></span>`;
}

// ─── NAVIGATION ──────────────────────────────────────────────
function setupNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function () {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
            const target = this.dataset.target;
            document.getElementById(target).classList.add('active');

            if      (target === 'dashboard')      updateRoleDashboard();
            else if (target === 'secretary')      { updateTodayPatientsList(); updateConsultationTypesSelect(); loadAppointmentsList(); }
            else if (target === 'administration') updateAdminStats();
            else if (target === 'pharmacy')       updateMedicationStockDisplay();
            else if (target === 'messaging')      { loadConversations(); checkUnreadMessages(); }
            else if (target === 'doctor')         loadDoctorAppointments();
            else if (target === 'suppliers')      loadSuppliers();
            else if (target === 'settings')       { updateSettingsDisplay(); updateMedicationsSettingsList(); loadSubAdminPermissionsUI(); }
        });
    });
}

function setupRoleBasedNavigation() {
    const role = state.currentRole;
    const allSections = ['dashboard','secretary','cashier','nurse','doctor','laboratory','pharmacy','messaging','administration','suppliers','settings'];

    let allowed;
    if (role === 'admin') {
        allowed = allSections;
    } else if (role === 'sub_admin') {
        // Basé sur les permissions définies par l\'admin
        allowed = ['dashboard'];
        const perms = state.subAdminPermissions;
        if (perms.secretary)      allowed.push('secretary');
        if (perms.cashier)        allowed.push('cashier');
        if (perms.nurse)          allowed.push('nurse');
        if (perms.doctor)         allowed.push('doctor');
        if (perms.laboratory)     allowed.push('laboratory');
        if (perms.pharmacy)       allowed.push('pharmacy');
        if (perms.messaging)      allowed.push('messaging');
        if (perms.administration) allowed.push('administration');
        if (perms.settings)       allowed.push('settings');
    } else {
        const roleAccess = {
            secretary: ['dashboard','secretary','messaging'],
            cashier:   ['dashboard','cashier','messaging'],
            nurse:     ['dashboard','nurse','messaging'],
            doctor:    ['dashboard','doctor','messaging'],
            lab:       ['dashboard','laboratory','messaging'],
            pharmacy:  ['dashboard','pharmacy','messaging'],
        };

        // Compte multi-rôle : union des sections de tous ses rôles
        const roles = state.currentRoles || [role];
        if (roles.length > 1) {
            allowed = ['dashboard', 'messaging'];
            roles.forEach(function(r) {
                const sections = roleAccess[r] || [];
                sections.forEach(function(s) {
                    if (!allowed.includes(s)) allowed.push(s);
                });
            });
        } else {
            allowed = roleAccess[role] || ['dashboard'];
        }
    }

    document.querySelectorAll('.nav-tab').forEach(tab => {
        if (allowed.includes(tab.dataset.target)) tab.classList.remove('hidden');
        else tab.classList.add('hidden');
    });

    // Masquer/afficher la gestion des utilisateurs dans paramètres pour sous-admin
    const userCard = document.querySelector('#settings .card:last-child');
    const subAdminCard = document.getElementById('sub-admin-permissions-card');
    if (role !== 'admin') {
        if (subAdminCard) subAdminCard.classList.add('hidden');
        if (!state.subAdminPermissions.users) {
            // Masquer gestion users pour sous-admin si non autorisé
            const usersCard = document.getElementById('users-list')?.closest('.card');
            if (usersCard) usersCard.classList.add('hidden');
        }
    } else {
        if (subAdminCard) subAdminCard.classList.remove('hidden');
    }

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

// ─── CLOCHE NOTIFICATIONS ─────────────────────────────────────
function setupNotifBell() {
    const bell = document.getElementById('notif-bell-btn');
    const panel = document.getElementById('notif-panel');
    if (!bell || !panel) return;
    bell.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && e.target !== bell) {
            panel.classList.remove('open');
        }
    });
    document.getElementById('mark-all-read-btn')?.addEventListener('click', () => {
        state.localNotifications.forEach(n => n.read = true);
        updateNotifPanel();
        updateNotifBadge();
    });
}

// ─── TAUX DE CHANGE ──────────────────────────────────────────
function setupExchangeRateSettings() {
    document.getElementById('save-exchange-rate-btn')?.addEventListener('click', async () => {
        const rate = parseFloat(document.getElementById('exchange-rate-input').value);
        if (isNaN(rate) || rate <= 0) { toast('Taux invalide', 'error'); return; }
        state.exchangeRate = rate;
        updateExchangeRateDisplay();
        try {
            await apiCall(() => API.saveSettings({ ...state.hospitalSettings, exchangeRate: rate }));
            Object.assign(state.hospitalSettings, { exchangeRate: rate });
            toast(`Taux de change mis à jour: ${rate} HTG = 1 USD`);
        } catch(e) {}
    });
}

// ─── SÉLECTEUR DE DEVISE CAISSE ───────────────────────────────
function setupCurrencyHandlers() {
    document.getElementById('currency-gdes')?.addEventListener('click', () => {
        state.cashierCurrency = 'HTG';
        document.getElementById('currency-gdes').classList.add('active');
        document.getElementById('currency-usd').classList.remove('active');
        recalcCashierTotal();
    });
    document.getElementById('currency-usd')?.addEventListener('click', () => {
        state.cashierCurrency = 'USD';
        document.getElementById('currency-usd').classList.add('active');
        document.getElementById('currency-gdes').classList.remove('active');
        recalcCashierTotal();
    });
    document.getElementById('report-currency-gdes')?.addEventListener('click', () => {
        state.reportCurrency = 'HTG';
        document.getElementById('report-currency-gdes').classList.add('active');
        document.getElementById('report-currency-usd').classList.remove('active');
        updateAdminStats();
    });
    document.getElementById('report-currency-usd')?.addEventListener('click', () => {
        state.reportCurrency = 'USD';
        document.getElementById('report-currency-usd').classList.add('active');
        document.getElementById('report-currency-gdes').classList.remove('active');
        updateAdminStats();
    });
}

function recalcCashierTotal() {
    const totalHTG = state.selectedServices.reduce((s,x) => s + x.finalAmount, 0);
    const totalUSD = htgToUsd(totalHTG);
    document.getElementById('total-to-pay').textContent = totalHTG.toFixed(2);
    const usdEl = document.getElementById('total-to-pay-usd');
    if (usdEl) usdEl.textContent = `$${totalUSD}`;
    updateChangeCalc(totalHTG);
}

function updateChangeCalc(totalHTG) {
    const given = parseFloat(document.getElementById('amount-given').value);
    const currency = document.getElementById('payment-currency-select')?.value || 'HTG';
    const el = document.getElementById('change-result');
    if (isNaN(given)) { el.textContent = 'Monnaie: 0.00'; el.style.color = ''; return; }

    let givenHTG = currency === 'USD' ? given * state.exchangeRate : given;
    const change = givenHTG - totalHTG;
    if (change < 0) {
        el.textContent = `Manquant: ${Math.abs(change).toFixed(2)} HTG (${htgToUsd(Math.abs(change))} USD)`;
        el.style.color = '#dc3545';
    } else {
        el.textContent = `Monnaie: ${change.toFixed(2)} HTG ≈ $${htgToUsd(change)}`;
        el.style.color = '#28a745';
    }
}

// ─── TABLEAU DE BORD ADMIN ───────────────────────────────────
function renderAdminDashboard(stats, container) {
    const rev  = parseFloat(stats.totalRevenue  || 0);
    const tday = parseFloat(stats.todayRevenue  || 0);
    const week = parseFloat(stats.weekRevenue   || 0);

    // Calcul diagramme camembert par type
    const byType = stats.byType || [];
    const totalTx = byType.reduce(function(s,t){ return s + parseFloat(t.total); }, 0) || 1;
    const colors = { consultation:'#1a6bca', lab:'#ffc107', medication:'#28a745', external:'#6f42c1' };
    const labels = { consultation:'Consultations', lab:'Analyses', medication:'Médicaments', external:'Services ext.' };

    // Générer segments camembert SVG
    function pieSegments(data, total) {
        var segs = '', cumul = 0;
        var cx = 80, cy = 80, r = 70;
        data.forEach(function(item) {
            var pct   = parseFloat(item.total) / total;
            var start = cumul * 2 * Math.PI - Math.PI/2;
            var end   = (cumul + pct) * 2 * Math.PI - Math.PI/2;
            var x1 = cx + r * Math.cos(start);
            var y1 = cy + r * Math.sin(start);
            var x2 = cx + r * Math.cos(end);
            var y2 = cy + r * Math.sin(end);
            var large = pct > 0.5 ? 1 : 0;
            var color = colors[item.type] || '#aaa';
            if (pct > 0.001) {
                segs += '<path d="M'+cx+','+cy+' L'+x1.toFixed(1)+','+y1.toFixed(1)+' A'+r+','+r+' 0 '+large+',1 '+x2.toFixed(1)+','+y2.toFixed(1)+' Z" fill="'+color+'" stroke="#fff" stroke-width="2" opacity="0.9"/>';
            }
            cumul += pct;
        });
        return segs;
    }

    // Barres horizontales pour revenus semaine vs mois
    var maxBar = Math.max(tday, week, rev/4, 1);
    function bar(val, color) {
        var pct = Math.min(100, (val / maxBar) * 100).toFixed(1);
        return '<div style="background:#e9ecef;border-radius:6px;height:12px;margin:4px 0;overflow:hidden;">' +
               '<div style="width:'+pct+'%;height:100%;background:'+color+';border-radius:6px;transition:width .8s ease;"></div></div>';
    }

    // Diagramme barres par agent
    var byAgent = stats.byAgent || [];
    var maxAgent = byAgent.length ? Math.max.apply(null, byAgent.map(function(a){ return parseFloat(a.total); })) : 1;
    var agentBars = byAgent.slice(0,6).map(function(a) {
        var pct = Math.min(100, (parseFloat(a.total)/maxAgent*100)).toFixed(1);
        return '<div style="margin-bottom:10px;">'+
               '<div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:3px;">'+
               '<span><i class="fas fa-user" style="color:#1a6bca;"></i> '+a.payment_agent+'</span>'+
               '<strong>'+parseFloat(a.total).toLocaleString('fr-FR')+' HTG</strong></div>'+
               '<div style="background:#e9ecef;border-radius:6px;height:14px;overflow:hidden;">'+
               '<div style="width:'+pct+'%;height:100%;background:linear-gradient(90deg,#1a6bca,#2196F3);border-radius:6px;transition:width .8s ease;"></div></div></div>';
    }).join('') || '<p class="text-muted">Aucune donnée agent</p>';

    // Patients récents (dernières 10 lignes)
    var recentTx = stats.recentTransactions || [];
    // Grouper par patient pour avoir les 8 derniers patients uniques
    var seenPat = {}, recentPats = [];
    recentTx.forEach(function(t) {
        if (!seenPat[t.patient_id] && t.patient_id) {
            seenPat[t.patient_id] = true;
            recentPats.push(t);
        }
    });

    container.innerHTML =
        // ── Cartes stats cliquables ──
        '<div class="stats-container">' +
        // Patients total - cliquable
        '<div class="stat-card clickable-stat" onclick="showAdminDetailModal(\'patients\')" style="cursor:pointer;" title="Voir les patients">' +
        '<div class="stat-icon" style="background:#1a6bca"><i class="fas fa-users"></i></div>' +
        '<div class="stat-info"><h3>'+stats.totalPatients+'</h3><p>Patients <small style="color:#1a6bca;font-weight:600;">↗ Voir tout</small></p></div></div>' +
        // Revenus
        '<div class="stat-card clickable-stat" onclick="showAdminDetailModal(\'revenus\')" style="cursor:pointer;" title="Voir les revenus">' +
        '<div class="stat-icon" style="background:#28a745"><i class="fas fa-money-bill-wave"></i></div>' +
        '<div class="stat-info"><h3>'+rev.toLocaleString('fr-FR')+' HTG</h3>' +
        '<p>Revenus <span class="currency-tag usd">$'+htgToUsd(rev)+'</span> <small style="color:#28a745;font-weight:600;">↗ Voir tout</small></p></div></div>' +
        // Impayés
        '<div class="stat-card clickable-stat" onclick="showAdminDetailModal(\'impayes\')" style="cursor:pointer;" title="Voir les impayés">' +
        '<div class="stat-icon" style="background:#ffc107"><i class="fas fa-exclamation-triangle"></i></div>' +
        '<div class="stat-info"><h3>'+stats.unpaidCount+'</h3><p>Impayés <small style="color:#ffc107;font-weight:600;">↗ Voir tout</small></p></div></div>' +
        // Stock
        '<div class="stat-card clickable-stat" onclick="showAdminDetailModal(\'stock\')" style="cursor:pointer;" title="Voir le stock">' +
        '<div class="stat-icon" style="background:#dc3545"><i class="fas fa-pills"></i></div>' +
        '<div class="stat-info"><h3>'+stats.lowStock.length+'</h3><p>Alertes stock <small style="color:#dc3545;font-weight:600;">↗ Voir tout</small></p></div></div>' +
        // Aujourd\'hui
        '<div class="stat-card">' +
        '<div class="stat-icon" style="background:#17a2b8"><i class="fas fa-calendar-day"></i></div>' +
        '<div class="stat-info"><h3>'+tday.toLocaleString('fr-FR')+' HTG</h3><p>Encaissé aujourd\'hui <span class="currency-tag usd">$'+htgToUsd(tday)+'</span></p></div></div>' +
        // Cette semaine
        '<div class="stat-card">' +
        '<div class="stat-icon" style="background:#6f42c1"><i class="fas fa-calendar-week"></i></div>' +
        '<div class="stat-info"><h3>'+week.toLocaleString('fr-FR')+' HTG</h3><p>Cette semaine <span class="currency-tag usd">$'+htgToUsd(week)+'</span></p></div></div>' +
        '</div>' +

        // ── Diagrammes ──
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px;margin:20px 0;">' +

        // Camembert revenus par type
        '<div class="card">' +
        '<h3 style="margin-bottom:14px;"><i class="fas fa-chart-pie" style="color:#1a6bca;"></i> Répartition des services</h3>' +
        (byType.length > 0 ?
        '<div style="display:flex;align-items:center;gap:20px;">' +
        '<svg width="160" height="160" viewBox="0 0 160 160">' +
        pieSegments(byType, totalTx) +
        '<circle cx="80" cy="80" r="30" fill="white"/>' +
        '<text x="80" y="84" text-anchor="middle" font-size="11" font-weight="bold" fill="#2c3e50">Total</text>' +
        '</svg>' +
        '<div>'+byType.map(function(t){
            return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:.85rem;">'+
                   '<div style="width:12px;height:12px;border-radius:3px;background:'+(colors[t.type]||'#aaa')+'"></div>'+
                   '<span>'+(labels[t.type]||t.type)+'</span>' +
                   '<strong style="margin-left:auto;">'+parseFloat(t.total).toLocaleString('fr-FR')+' HTG</strong>' +
                   '</div>';
        }).join('')+'</div></div>'
        : '<p class="text-muted">Aucune donnée</p>') +
        '</div>' +

        // Barres revenus
        '<div class="card">' +
        '<h3 style="margin-bottom:14px;"><i class="fas fa-chart-bar" style="color:#28a745;"></i> Revenus comparatifs</h3>' +
        '<div style="font-size:.85rem;">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span>Aujourd\'hui</span><strong>'+tday.toLocaleString('fr-FR')+' HTG</strong></div>'+bar(tday,'#17a2b8')+
        '<div style="display:flex;justify-content:space-between;margin-bottom:3px;margin-top:8px;"><span>Cette semaine</span><strong>'+week.toLocaleString('fr-FR')+' HTG</strong></div>'+bar(week,'#1a6bca')+
        '<div style="display:flex;justify-content:space-between;margin-bottom:3px;margin-top:8px;"><span>Total</span><strong>'+rev.toLocaleString('fr-FR')+' HTG</strong></div>'+bar(rev,'#28a745')+
        '<p style="margin-top:12px;color:#6c757d;font-size:.78rem;">Taux: 1 USD = '+state.exchangeRate+' HTG</p>' +
        '</div></div>' +

        // Barres par agent
        '<div class="card" style="grid-column:1/-1;">' +
        '<h3 style="margin-bottom:14px;"><i class="fas fa-users" style="color:#6f42c1;"></i> Performance par agent</h3>' +
        agentBars +
        '</div>' +

        '</div>' +

        // ── Derniers patients (cliquables) ──
        '<div class="card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
        '<h3><i class="fas fa-user-clock" style="color:#1a6bca;"></i> Derniers patients enregistrés</h3>' +
        '<button class="btn btn-sm btn-outline" onclick="showAdminDetailModal(\'patients\')"><i class="fas fa-list"></i> Voir tous</button>' +
        '</div>' +
        '<div class="table-container"><table><thead><tr><th>ID</th><th>Nom</th><th>Type</th><th>Date</th><th>Montant dû</th><th>Détails</th></tr></thead><tbody>' +
        recentPats.slice(0,8).map(function(t){
            return '<tr style="cursor:pointer;" onclick="quickViewPatient(\'' + t.patient_id + '\',\'' + t.patient_name + '\')">' +
                '<td><strong>'+t.patient_id+'</strong></td>' +
                '<td>'+t.patient_name+'</td>' +
                '<td>'+t.type+'</td>' +
                '<td>'+t.date+'</td>' +
                '<td>'+parseFloat(t.amount).toLocaleString('fr-FR')+' HTG</td>' +
                '<td><button class="btn btn-xs btn-primary" onclick="event.stopPropagation();quickViewPatient(\'' + t.patient_id + '\',\'' + t.patient_name + '\')">'+
                '<i class="fas fa-eye"></i></button></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div></div>' +

        // ── Transactions récentes ──
        '<div class="card mt-3">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
        '<h3><i class="fas fa-receipt" style="color:#28a745;"></i> Transactions récentes</h3>' +
        '<button class="btn btn-sm btn-outline" onclick="showSection(\'administration\')"><i class="fas fa-chart-bar"></i> Administration</button>' +
        '</div>' +
        '<div class="table-container"><table><thead><tr><th>Date</th><th>Patient</th><th>Service</th><th>HTG</th><th>USD</th><th>Statut</th><th>Action</th></tr></thead><tbody>' +
        recentTx.slice(0,8).map(function(t){
            var amt = parseFloat(t.amount);
            return '<tr>' +
                '<td>'+t.date+'</td>' +
                '<td style="cursor:pointer;color:#1a6bca;" onclick="quickViewPatient(\'' + t.patient_id + '\',\'' + t.patient_name + '\')">'+t.patient_name+'</td>' +
                '<td>'+t.service+'</td>' +
                '<td>'+amt.toLocaleString('fr-FR')+'</td>' +
                '<td class="text-muted">$'+htgToUsd(amt)+'</td>' +
                '<td><span class="'+(t.status==='paid'?'status-paid':'status-unpaid')+'">'+(t.status==='paid'?'Payé':'Non payé')+'</span></td>' +
                '<td><button class="btn btn-xs btn-warning" onclick="adminEditTransaction(\'' + t.id + '\')"><i class="fas fa-edit"></i></button></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div></div>';

    // Stocker les stats pour les modals
    state._lastStats = stats;
}

// ── Modal détails rapides patient ───────────────────────────
function goToPatientProfile(pid) {
    var m = document.getElementById('quick-view-modal'); if(m) m.remove();
    var s = document.getElementById('admin-patient-search'); if(s) s.value = pid;
    showSection('administration');
    setTimeout(searchAdminPatient, 300);
}

async function quickViewPatient(patientId, patientName) {
    var modal = document.getElementById('quick-view-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'quick-view-modal';
    modal.className = 'transaction-details-modal';
    modal.innerHTML = '<div class="transaction-details-content" style="max-width:650px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<h4><i class="fas fa-user" style="color:#1a6bca;"></i> '+patientName+' <small class="text-muted">#'+patientId+'</small></h4>' +
        '<button class="btn btn-sm btn-secondary" onclick="document.getElementById(\'quick-view-modal\').remove()"><i class="fas fa-times"></i></button>' +
        '</div><div id="quick-view-body"><div style="text-align:center;padding:30px;"><i class="fas fa-spinner fa-spin fa-2x" style="color:#1a6bca;"></i></div></div>' +
        '<div class="mt-3 d-flex gap-10">' +
        '<button class="btn btn-primary" data-pid="' + patientId + '" onclick="goToPatientProfile(this.dataset.pid)"><i class="fas fa-external-link-alt"></i> Voir profil complet</button>' +
        '<button class="btn btn-secondary" onclick="document.getElementById(\'quick-view-modal\').remove()">Fermer</button>' +
        '</div></div>';
    document.body.appendChild(modal);
    try {
        var txs = await API.getTransactions({ patientId: patientId }).catch(function(){ return []; });
        var totalPaye   = txs.filter(function(t){ return t.status==='paid'; }).reduce(function(s,t){ return s+parseFloat(t.amount); }, 0);
        var totalImpaye = txs.filter(function(t){ return t.status==='unpaid'; }).reduce(function(s,t){ return s+parseFloat(t.amount); }, 0);
        document.getElementById('quick-view-body').innerHTML =
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">' +
            '<div style="background:#d4edda;padding:12px;border-radius:8px;text-align:center;">' +
            '<strong style="color:#155724;font-size:1.1rem;">'+totalPaye.toLocaleString('fr-FR')+' HTG</strong><br><small>Payé</small></div>' +
            '<div style="background:#f8d7da;padding:12px;border-radius:8px;text-align:center;">' +
            '<strong style="color:#721c24;font-size:1.1rem;">'+totalImpaye.toLocaleString('fr-FR')+' HTG</strong><br><small>Non payé</small></div>' +
            '</div>' +
            '<div class="table-container"><table><thead><tr><th>Date</th><th>Service</th><th>Montant</th><th>Statut</th></tr></thead><tbody>' +
            txs.slice(0,6).map(function(t){
                return '<tr><td>'+t.date+'</td><td>'+t.service+'</td>' +
                    '<td>'+parseFloat(t.amount).toLocaleString('fr-FR')+' HTG</td>' +
                    '<td><span class="'+(t.status==='paid'?'status-paid':'status-unpaid')+'">'+(t.status==='paid'?'Payé':'Non payé')+'</span></td></tr>';
            }).join('') +
            '</tbody></table></div>';
    } catch(e) {}
}

// ── Modal détails par catégorie ──────────────────────────────
async function showAdminDetailModal(type) {
    var modal = document.getElementById('admin-detail-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'admin-detail-modal';
    modal.className = 'transaction-details-modal';

    var titles = {
        patients: '<i class="fas fa-users" style="color:#1a6bca;"></i> Tous les patients',
        revenus:  '<i class="fas fa-money-bill-wave" style="color:#28a745;"></i> Détail des revenus',
        impayes:  '<i class="fas fa-exclamation-triangle" style="color:#ffc107;"></i> Services non payés',
        stock:    '<i class="fas fa-pills" style="color:#dc3545;"></i> Alertes de stock',
    };
    modal.innerHTML = '<div class="transaction-details-content" style="max-width:750px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<h4>'+titles[type]+'</h4>' +
        '<button class="btn btn-sm btn-secondary" onclick="document.getElementById(\'admin-detail-modal\').remove()"><i class="fas fa-times"></i></button>' +
        '</div><div id="admin-detail-body"><div style="text-align:center;padding:30px;"><i class="fas fa-spinner fa-spin fa-2x" style="color:#1a6bca;"></i></div></div></div>';
    document.body.appendChild(modal);

    try {
        var body = document.getElementById('admin-detail-body');
        if (type === 'patients') {
            var patients = await API.getPatients({}).catch(function(){ return []; });
            body.innerHTML = '<div class="table-container"><table><thead><tr><th>ID</th><th>Nom</th><th>Téléphone</th><th>Type</th><th>Date</th><th>Actions</th></tr></thead><tbody>' +
                patients.map(function(p){
                    return '<tr>' +
                        '<td><strong>'+p.id+'</strong></td><td>'+p.full_name+'</td>' +
                        '<td>'+(p.phone||'-')+'</td><td>'+p.type+'</td>' +
                        '<td>'+(p.registration_date||'-')+'</td>' +
                        '<td><button class="btn btn-xs btn-primary" data-pid="' + p.id + '" onclick="goToPatientProfile(this.dataset.pid)"><i class="fas fa-eye"></i></button></td></tr>';
                        '<i class="fas fa-eye"></i></button></td></tr>';
                }).join('') +
                '</tbody></table></div>';
        } else if (type === 'revenus') {
            var txsPaid = await API.getTransactions({ status: 'paid' }).catch(function(){ return []; });
            var tot = txsPaid.reduce(function(s,t){ return s+parseFloat(t.amount); }, 0);
            body.innerHTML = '<div class="exchange-banner mb-3"><i class="fas fa-money-bill-wave"></i>' +
                '<span>Total encaissé: <strong>'+tot.toLocaleString('fr-FR')+' HTG</strong> ≈ <strong>$'+htgToUsd(tot)+'</strong></span></div>' +
                '<div class="table-container"><table><thead><tr><th>Date</th><th>Patient</th><th>Service</th><th>HTG</th><th>USD</th><th>Méthode</th></tr></thead><tbody>' +
                txsPaid.slice(0,30).map(function(t){
                    var a = parseFloat(t.amount);
                    return '<tr><td>'+t.date+'</td><td>'+t.patient_name+'</td><td>'+t.service+'</td>' +
                        '<td>'+a.toLocaleString('fr-FR')+'</td><td>$'+htgToUsd(a)+'</td><td>'+(t.payment_method||'-')+'</td></tr>';
                }).join('')+'</tbody></table></div>';
        } else if (type === 'impayes') {
            var txsUnpaid = await API.getTransactions({ status: 'unpaid' }).catch(function(){ return []; });
            var totU = txsUnpaid.reduce(function(s,t){ return s+parseFloat(t.amount); }, 0);
            body.innerHTML = '<div class="alert alert-warning mb-3"><strong>'+txsUnpaid.length+' services non payés</strong> — Total: '+totU.toLocaleString('fr-FR')+' HTG ($'+htgToUsd(totU)+')</div>' +
                '<div class="table-container"><table><thead><tr><th>Patient</th><th>Service</th><th>Montant</th><th>Date</th><th>Action</th></tr></thead><tbody>' +
                txsUnpaid.slice(0,30).map(function(t){
                    return '<tr><td>'+t.patient_name+'</td><td>'+t.service+'</td>' +
                        '<td>'+parseFloat(t.amount).toLocaleString('fr-FR')+' HTG</td><td>'+t.date+'</td>' +
                        '<td><button class="btn btn-xs btn-warning" onclick="adminEditTransaction(\'' + t.id + '\')"><i class="fas fa-edit"></i></button></td></tr>';
                }).join('')+'</tbody></table></div>';
        } else if (type === 'stock') {
            var meds = state._lastStats ? state._lastStats.lowStock : [];
            body.innerHTML = meds.length ?
                '<div class="table-container"><table><thead><tr><th>Médicament</th><th>Stock actuel</th><th>Seuil alerte</th><th>Emplacement</th></tr></thead><tbody>' +
                meds.map(function(m){
                    return '<tr class="'+(m.quantity===0?'out-of-stock':'low-stock')+'">' +
                        '<td><strong>'+m.name+'</strong></td>' +
                        '<td><strong style="color:'+(m.quantity===0?'#dc3545':'#856404')+';">'+m.quantity+'</strong></td>' +
                        '<td>'+m.alert_threshold+'</td>' +
                        '<td>'+(m.espace&&m.etagere?m.espace+' / '+m.etagere:m.espace||m.etagere||'-')+'</td></tr>';
                }).join('')+'</tbody></table></div>'
                : '<div class="alert alert-success"><i class="fas fa-check-circle"></i> Aucun médicament en rupture ou alerte.</div>';
        }
    } catch(e) { document.getElementById('admin-detail-body').innerHTML = '<p class="text-muted">Erreur chargement</p>'; }
}

// ─── TABLEAU DE BORD ─────────────────────────────────────────
async function updateRoleDashboard() {
    const container = document.getElementById('role-dashboard-content');
    const role = state.currentRole;
    const today = new Date().toISOString().split('T')[0];

    try {
        if (role === 'admin' || role === 'sub_admin') {
            const stats = await apiCall(() => API.getStats());
            renderAdminDashboard(stats, container);
        } else if (role === 'secretary') {
            const patients = await apiCall(() => API.getPatients({ date: today }));
            const unread = await API.getUnreadCount().catch(() => ({ count: 0 }));
            container.innerHTML = `
                <div class="stats-container">
                    <div class="stat-card">
                        <div class="stat-icon" style="background:#1a6bca"><i class="fas fa-user-plus"></i></div>
                        <div class="stat-info"><h3>${patients.length}</h3><p>Patients aujourd\'hui</p></div>
                    </div>
                    <div class="stat-card clickable-stat" onclick="showSection(\'messaging\')">
                        <div class="stat-icon" style="background:#17a2b8"><i class="fas fa-comments"></i></div>
                        <div class="stat-info"><h3>${unread.count}</h3><p>Messages non lus</p></div>
                    </div>
                </div>
                <div class="card mt-3"><h3>Patients du jour</h3>
                    <div class="table-container"><table><thead><tr><th>ID</th><th>Nom</th><th>Type</th><th>Heure</th></tr></thead>
                    <tbody>${patients.slice(0,8).map(p=>`<tr><td>${p.id}</td><td>${p.full_name}</td><td>${p.type}</td><td>${p.registration_time||'-'}</td></tr>`).join('')}
                    </tbody></table></div></div>`;
        } else if (role === 'cashier') {
            const txs = await apiCall(() => API.getTransactions({ status: 'paid' }));
            const todayTxs = txs.filter(t => t.payment_date === today);
            const revenueHTG = todayTxs.reduce((s,t) => s + parseFloat(t.amount), 0);
            const unread = await API.getUnreadCount().catch(() => ({ count: 0 }));
            container.innerHTML = `
                <div class="stats-container">
                    <div class="stat-card">
                        <div class="stat-icon" style="background:#28a745"><i class="fas fa-money-bill-wave"></i></div>
                        <div class="stat-info">
                            <h3>${revenueHTG.toLocaleString('fr-FR')} HTG</h3>
                            <p>Encaissements aujourd\'hui <span class="currency-tag usd">$${htgToUsd(revenueHTG)}</span></p>
                        </div>
                    </div>
                    <div class="stat-card clickable-stat" onclick="showSection(\'messaging\')">
                        <div class="stat-icon" style="background:#17a2b8"><i class="fas fa-comments"></i></div>
                        <div class="stat-info"><h3>${unread.count}</h3><p>Messages non lus</p></div>
                    </div>
                </div>`;
        } else if (role === 'nurse') {
            const unread = await API.getUnreadCount().catch(() => ({ count: 0 }));
            container.innerHTML = `
                <div class="stats-container">
                    <div class="stat-card clickable-stat" onclick="showSection(\'messaging\')">
                        <div class="stat-icon" style="background:#17a2b8"><i class="fas fa-comments"></i></div>
                        <div class="stat-info"><h3>${unread.count}</h3><p>Messages non lus</p></div>
                    </div>
                </div>
                <div class="alert alert-info mt-3"><i class="fas fa-info-circle"></i> Utilisez l\'onglet <strong>Infirmier</strong> pour saisir les signes vitaux.</div>`;
        } else if (role === 'doctor') {
            const apps = await apiCall(() => API.getAppointments({ doctor: state.currentUser.username, fromDate: today }));
            const unread = await API.getUnreadCount().catch(() => ({ count: 0 }));
            container.innerHTML = `
                <div class="stats-container">
                    <div class="stat-card">
                        <div class="stat-icon" style="background:#1a6bca"><i class="fas fa-calendar-alt"></i></div>
                        <div class="stat-info"><h3>${apps.length}</h3><p>Rendez-vous à venir</p></div>
                    </div>
                    <div class="stat-card clickable-stat" onclick="showSection(\'messaging\')">
                        <div class="stat-icon" style="background:#17a2b8"><i class="fas fa-comments"></i></div>
                        <div class="stat-info"><h3>${unread.count}</h3><p>Messages non lus</p></div>
                    </div>
                </div>`;
        } else if (role === 'pharmacy') {
            const meds = state.medications.filter(m => m.quantity <= m.alert_threshold);
            const unread = await API.getUnreadCount().catch(() => ({ count: 0 }));
            container.innerHTML = `
                <div class="stats-container">
                    <div class="stat-card">
                        <div class="stat-icon" style="background:#dc3545"><i class="fas fa-pills"></i></div>
                        <div class="stat-info"><h3>${meds.length}</h3><p>Médicaments en alerte</p></div>
                    </div>
                    <div class="stat-card clickable-stat" onclick="showSection(\'messaging\')">
                        <div class="stat-icon" style="background:#17a2b8"><i class="fas fa-comments"></i></div>
                        <div class="stat-info"><h3>${unread.count}</h3><p>Messages non lus</p></div>
                    </div>
                </div>`;
        } else if (role === 'lab') {
            const txs = await apiCall(() => API.getTransactions({ type: 'lab' }));
            const pending = txs.filter(t => t.status === 'paid' && t.lab_status !== 'completed');
            const unread = await API.getUnreadCount().catch(() => ({ count: 0 }));
            container.innerHTML = `
                <div class="stats-container">
                    <div class="stat-card">
                        <div class="stat-icon" style="background:#ffc107"><i class="fas fa-flask"></i></div>
                        <div class="stat-info"><h3>${pending.length}</h3><p>Analyses en attente</p></div>
                    </div>
                    <div class="stat-card clickable-stat" onclick="showSection(\'messaging\')">
                        <div class="stat-icon" style="background:#17a2b8"><i class="fas fa-comments"></i></div>
                        <div class="stat-info"><h3>${unread.count}</h3><p>Messages non lus</p></div>
                    </div>
                </div>`;
        }
    } catch(e) {
        container.innerHTML = `<div class="alert alert-danger">Erreur chargement du tableau de bord</div>`;
    }
}

// ─── SECRÉTARIAT ─────────────────────────────────────────────
function updateConsultationTypesSelect() {
    const sel = document.getElementById('consultation-type-secretary');
    if (!sel) return;
    sel.innerHTML = '<option value="">Sélectionner...</option>';
    state.consultationTypes.filter(ct => ct.active).forEach(ct => {
        sel.innerHTML += `<option value="${ct.id}">${ct.name} — ${ct.price} Gdes ($${htgToUsd(ct.price)})</option>`;
    });
}

function updateExternalServicesOptions() {
    const container = document.getElementById('external-services-options');
    if (!container) return;
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
    if (!sel) return;
    sel.innerHTML = '<option value="">Choisir un service</option>';
    state.externalServiceTypes.filter(s => s.active).forEach(s => {
        sel.innerHTML += `<option value="${s.id}" data-price="${s.price}">${s.name} — ${s.price} Gdes</option>`;
    });
}

function setupPatientTypeChange() {
    document.querySelectorAll('input[name="patient-type"]').forEach(radio => {
        radio.addEventListener('change', syncExternalUI);
    });
    document.getElementById('external-only')?.addEventListener('change', syncExternalUI);
}

function syncExternalUI() {
    const type    = document.querySelector('input[name="patient-type"]:checked')?.value;
    const extOnly = document.getElementById('external-only')?.checked;
    const isExt   = type === 'externe' || extOnly;
    document.getElementById('consultation-type-container')?.classList.toggle('hidden', isExt);
    document.getElementById('external-services-selection')?.classList.toggle('hidden', !isExt);
    const ctSel = document.getElementById('consultation-type-secretary');
    if (ctSel) ctSel.required = !isExt;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('add-external-service-registration')?.addEventListener('click', () => {
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

    document.getElementById('consultation-type-secretary')?.addEventListener('change', function () {
        document.getElementById('modify-consultation-type-btn')?.classList.toggle('hidden', !this.value);
    });
    document.getElementById('modify-consultation-type-btn')?.addEventListener('click', () => {
        const id = parseInt(document.getElementById('consultation-type-secretary').value);
        const ct = state.consultationTypes.find(c => c.id === id);
        if (!ct) return;
        document.getElementById('modified-consultation-name').value  = ct.name;
        document.getElementById('modified-consultation-price').value = ct.price;
        document.getElementById('consultation-modification-secretary')?.classList.remove('hidden');
    });
    document.getElementById('save-modified-consultation')?.addEventListener('click', () => {
        const name  = document.getElementById('modified-consultation-name').value;
        const price = parseFloat(document.getElementById('modified-consultation-price').value);
        if (!name || isNaN(price)) { toast('Remplir tous les champs', 'error'); return; }
        state.currentModifiedConsultation = { name, price };
        document.getElementById('consultation-modification-secretary')?.classList.add('hidden');
        toast('Modification enregistrée pour ce patient uniquement');
    });
    document.getElementById('cancel-consultation-modification')?.addEventListener('click', () => {
        state.currentModifiedConsultation = null;
        document.getElementById('consultation-modification-secretary')?.classList.add('hidden');
    });

    // Formulaire d\'enregistrement patient
    document.getElementById('patient-registration-form')?.addEventListener('submit', async (e) => {
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

        const externalServices = [];
        document.querySelectorAll('.external-service-option:checked').forEach(cb => {
            const svc = state.externalServiceTypes.find(s => s.id == cb.value);
            if (svc) externalServices.push({ name: svc.name, price: svc.price });
        });
        document.querySelectorAll('.external-service-custom').forEach((input, i) => {
            const name  = input.value.trim();
            const price = parseFloat(document.querySelectorAll('.external-service-price')[i]?.value);
            if (name && !isNaN(price)) externalServices.push({ name, price });
        });

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
            syncExternalUI();
            document.getElementById('modify-consultation-type-btn')?.classList.add('hidden');
            document.getElementById('consultation-modification-secretary')?.classList.add('hidden');
            state.currentModifiedConsultation = null;
            updateTodayPatientsList();
            // Notification → caisse
            notifyDepartment('cashier', 'Nouveau patient inscrit',
                `${fullName} (ID: ${result.id}) est enregistré. Type: ${type}`, '#28a745');
        } catch (err) {}
    });

    // Rendez-vous
    document.getElementById('search-appointment-patient')?.addEventListener('click', async () => {
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
            const users = await API.getUsers().catch(() => []);
            const doctors = users.filter(u => u.role === 'doctor' && u.active);
            const sel = document.getElementById('appointment-doctor');
            sel.innerHTML = '<option value="">Sélectionner un médecin</option>';
            doctors.forEach(d => sel.innerHTML += `<option value="${d.username}">${d.name}</option>`);
        } catch(e) {}
    });

    document.getElementById('schedule-appointment')?.addEventListener('click', async () => {
        const details = document.getElementById('appointment-patient-details');
        const patientId = details.dataset.patientId;
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
            // Notification → médecin
            notifyDepartment('doctor', 'Nouveau rendez-vous',
                `${patientName} — ${date} à ${time}. Motif: ${reason||'Non précisé'}`, '#6f42c1');
        } catch(e) {}
    });

    // Services externes
    document.getElementById('search-external-patient')?.addEventListener('click', async () => {
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

    document.getElementById('add-external-service')?.addEventListener('click', async () => {
        const patientId = document.getElementById('external-patient-name').dataset.patientId;
        const sel = document.getElementById('external-service-select');
        const svc = state.externalServiceTypes.find(s => s.id == sel.value);
        if (!svc) { toast('Sélectionner un service', 'error'); return; }
        try {
            await apiCall(() => API.addTransaction({
                patientId,
                patientName: document.getElementById('external-patient-name').textContent.split('(')[0].trim(),
                service: `Service externe: ${svc.name}`,
                amount: svc.price, type: 'external',
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
                <td>${p.vip?'<span class="vip-tag">VIP</span>':p.sponsored?`<span class="badge badge-primary">Sponsorisé ${p.discount_percentage}%</span>`:'-'}</td>
                <td><button class="btn btn-sm btn-secondary" onclick="printPatientCard('${p.id}')"><i class="fas fa-id-card"></i></button></td>
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
                        <small class="text-muted">Motif: ${a.reason||'-'} | Médecin: ${a.doctor||'-'}</small>
                    </div>
                    <span class="appointment-status status-${a.status==='scheduled'?'pending':a.status}">${a.status}</span>
                </div>
                <div class="appointment-actions">
                    <button class="btn btn-sm btn-success" onclick="updateApptStatus('${a.id}','confirmed')">Confirmer</button>
                    <button class="btn btn-sm btn-danger" onclick="updateApptStatus('${a.id}','cancelled')">Annuler</button>
                </div>
            </div>`).join('') || '<p class="text-muted">Aucun rendez-vous programmé.</p>';
    } catch(e) {}
}

async function updateApptStatus(id, status) {
    await apiCall(() => API.updateAppointment(id, { status }));
    toast('Statut mis à jour');
    loadAppointmentsList();
}

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
        const typeMap = { urgence:['URGENCE','emergency-patient-tag'], pediatrie:['PÉDIATRIE','pediatric-tag'], externe:['EXTERNE','external-patient-tag'] };
        const [txt,cls] = typeMap[p.type]||['STANDARD',''];
        typeEl.textContent = p.vip ? txt+' VIP' : p.sponsored ? txt+` SPONSORISÉ (${p.discount_percentage}%)` : txt;
        typeEl.className   = cls + (p.vip ? ' vip-tag' : '');
        document.getElementById('patient-card-container').classList.remove('hidden');
        setTimeout(() => { window.print(); document.getElementById('patient-card-container').classList.add('hidden'); }, 400);
    } catch(e) {}
}

// ─── RAPPORTS CAISSE ─────────────────────────────────────────
async function loadCashierReports(period) {
    const today = new Date();
    let fromDate, toDate = today.toISOString().split('T')[0];
    if (period === 'today') {
        fromDate = toDate;
    } else if (period === 'week') {
        const mon = new Date(today); mon.setDate(today.getDate() - today.getDay() + 1);
        fromDate = mon.toISOString().split('T')[0];
    } else {
        fromDate = document.getElementById('report-from-date')?.value || toDate;
        toDate   = document.getElementById('report-to-date')?.value   || toDate;
    }
    try {
        const txs = await apiCall(() => API.getTransactions({ fromDate, toDate, status: 'paid' }));
        const totalHTG = txs.reduce((s,t) => s + parseFloat(t.amount), 0);
        const byMethod = {};
        txs.forEach(t => {
            const m = t.payment_method || 'espèces';
            byMethod[m] = (byMethod[m] || 0) + parseFloat(t.amount);
        });
        const container = document.getElementById('cashier-report-result');
        container.innerHTML = `
            <div class="exchange-banner mb-3">
                <i class="fas fa-calendar"></i>
                <span>Période : <strong>${fromDate} → ${toDate}</strong> — ${txs.length} transaction(s)</span>
            </div>
            <div class="stats-container">
                <div class="stat-card">
                    <div class="stat-icon" style="background:#28a745;"><i class="fas fa-money-bill-wave"></i></div>
                    <div class="stat-info">
                        <h3>${totalHTG.toLocaleString('fr-FR', {minimumFractionDigits:2})} HTG</h3>
                        <p>Total encaissé <span class="currency-tag usd">$${htgToUsd(totalHTG)}</span></p>
                    </div>
                </div>
                ${Object.entries(byMethod).map(([m,v]) => `
                <div class="stat-card">
                    <div class="stat-icon" style="background:#1a6bca;"><i class="fas fa-wallet"></i></div>
                    <div class="stat-info"><h3>${v.toLocaleString('fr-FR', {minimumFractionDigits:2})} HTG</h3><p>${m}</p></div>
                </div>`).join('')}
            </div>
            <div class="table-container mt-3">
                <table>
                    <thead><tr><th>Date</th><th>Patient</th><th>Service</th><th>Montant HTG</th><th>USD</th><th>Méthode</th></tr></thead>
                    <tbody>${txs.map(t => `
                        <tr>
                            <td>${t.date} ${t.payment_time||''}</td>
                            <td>${t.patient_name}</td>
                            <td>${t.service}</td>
                            <td>${parseFloat(t.amount).toLocaleString('fr-FR', {minimumFractionDigits:2})}</td>
                            <td class="text-muted">$${htgToUsd(t.amount)}</td>
                            <td>${t.payment_method||'-'}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch(e) {}
}

// ─── CAISSE ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('search-cashier-patient')?.addEventListener('click', async () => {
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

    document.getElementById('amount-given')?.addEventListener('input', function () {
        const totalHTG = parseFloat(document.getElementById('total-to-pay').textContent);
        updateChangeCalc(totalHTG);
    });
    document.getElementById('payment-currency-select')?.addEventListener('change', function () {
        const totalHTG = parseFloat(document.getElementById('total-to-pay').textContent);
        updateChangeCalc(totalHTG);
    });

    document.querySelectorAll('.payment-method').forEach(m => {
        m.addEventListener('click', function () {
            document.querySelectorAll('.payment-method').forEach(x => x.classList.remove('active'));
            this.classList.add('active');
        });
    });

    document.getElementById('mark-as-paid')?.addEventListener('click', async () => {
        if (!state.selectedServices.length) { toast('Aucun service sélectionné', 'error'); return; }
        const given    = parseFloat(document.getElementById('amount-given').value);
        const totalHTG = parseFloat(document.getElementById('total-to-pay').textContent);
        const payCurrency = document.getElementById('payment-currency-select')?.value || 'HTG';
        const givenHTG = payCurrency === 'USD' ? given * state.exchangeRate : given;
        if (isNaN(givenHTG) || givenHTG < totalHTG) { toast('Montant insuffisant', 'error'); return; }
        const method = document.querySelector('.payment-method.active')?.dataset.method;
        const ids = state.selectedServices.map(s => s.id);
        try {
            await apiCall(() => API.payTransactions(ids, method));
            generateInvoice(totalHTG, givenHTG, payCurrency, method);

            // ── Notifications cross-département ciblées ──
            const txTypes = state.selectedServices.map(s => s.type);
            const patientName = state.currentCashierPatient.full_name;
            if (txTypes.includes('medication')) {
                await notifyDepartment('pharmacy', '💊 Médicaments payés',
                    `${patientName} a payé ses médicaments. Prêt pour la délivrance.`, '#28a745');
            }
            if (txTypes.includes('lab')) {
                await notifyDepartment('lab', '🧪 Analyses payées',
                    `${patientName} a payé ses analyses. À traiter en priorité.`, '#ffc107');
            }
            if (txTypes.includes('consultation')) {
                await notifyDepartment('doctor', '🩺 Consultation payée',
                    `${patientName} a réglé sa consultation.`, '#6f42c1');
                await notifyDepartment('nurse', '📋 Patient à accueillir',
                    `${patientName} a payé sa consultation. Signes vitaux à prendre.`, '#17a2b8');
            }
            // Notification administration pour chaque transaction
            await notifyAdmin('💰 Paiement reçu',
                `${patientName} — ${totalHTG.toFixed(2)} HTG ($${htgToUsd(totalHTG)}) via ${method||'espèces'}. Agent: ${state.currentUser.name}`);

            // Afficher modal impression
            showPrintModal(totalHTG, givenHTG, payCurrency, method);
        } catch(e) {}
    });
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
                <input type="checkbox" class="service-checkbox" data-id="${t.id}" checked style="width:16px;height:16px;margin-right:8px;accent-color:var(--primary);">
                <strong>${t.service}</strong>
                ${patient.sponsored && patient.discount_percentage > 0 ?
                    `<br><small class="text-muted">Réduction ${patient.discount_percentage}%: ${t.amount} → ${amount.toFixed(2)} HTG</small>` : ''}
            </div>
            <div class="d-flex align-center gap-10">
                <span>${amount.toFixed(2)} HTG</span>
                <span class="currency-tag usd">$${htgToUsd(amount)}</span>
            </div>
        </div>`;
    });
    document.getElementById('services-to-pay-list').innerHTML = html || '<p class="text-muted">Aucun service à payer.</p>';
    document.getElementById('total-to-pay').textContent = total.toFixed(2);
    const usdEl = document.getElementById('total-to-pay-usd');
    if (usdEl) usdEl.textContent = `$${htgToUsd(total)}`;

    document.querySelectorAll('.service-checkbox').forEach(cb => {
        cb.addEventListener('change', function () {
            const id = this.dataset.id;
            if (this.checked) {
                const t = txs.find(x => x.id === id);
                if (t) { let a = parseFloat(t.amount); if (patient.sponsored) a *= (1-patient.discount_percentage/100); state.selectedServices.push({...t,finalAmount:a}); }
            } else {
                state.selectedServices = state.selectedServices.filter(x => x.id !== id);
            }
            recalcCashierTotal();
        });
    });
}

function generateInvoice(totalHTG, givenHTG, payCurrency, method) {
    const p = state.currentCashierPatient;
    const s = state.hospitalSettings;
    const change = givenHTG - totalHTG;
    document.getElementById('invoice-hospital-name').textContent    = s.name    || 'Hôpital';
    document.getElementById('invoice-hospital-address').textContent = s.address || '';
    document.getElementById('invoice-hospital-phone').textContent   = s.phone   || '';
    document.getElementById('invoice-patient-name').textContent     = p.full_name;
    document.getElementById('invoice-patient-id').textContent       = p.id;
    const now = new Date();
    document.getElementById('invoice-date').textContent   = now.toLocaleDateString('fr-FR');
    document.getElementById('invoice-time').textContent   = now.toLocaleTimeString('fr-FR');
    document.getElementById('invoice-total-amount').textContent = totalHTG.toFixed(2);
    const usdEl = document.getElementById('invoice-total-usd');
    if (usdEl) usdEl.textContent = `$${htgToUsd(totalHTG)}`;
    document.getElementById('invoice-amount-given').textContent  = `${givenHTG.toFixed(2)} HTG (donné en ${payCurrency})`;
    document.getElementById('invoice-change').textContent        = `${change.toFixed(2)} HTG ≈ $${htgToUsd(change)}`;
    document.getElementById('invoice-payment-method').textContent = method;
    document.getElementById('invoice-number').textContent         = 'INV-' + Date.now();
    document.getElementById('invoice-services-list').innerHTML    = state.selectedServices.map(s =>
        `<div class="receipt-item"><span>${s.service}</span><span>${s.finalAmount.toFixed(2)} HTG</span></div>`
    ).join('');
    document.getElementById('invoice-container').classList.remove('hidden');
}

// ─── INFIRMIER ───────────────────────────────────────────────
function updateVitalsInputs() {
    const container = document.getElementById('vitals-inputs-container');
    if (!container) return;
    container.innerHTML = state.vitalTypes.filter(v => v.active).map(v => `
        <div class="vital-item">
            <label class="form-label">${v.name} (${v.unit})</label>
            <input type="text" class="form-control vital-input" data-id="${v.id}" placeholder="Valeur">
            <small class="text-muted">Norm: ${v.min} – ${v.max} ${v.unit}</small>
        </div>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('search-nurse-patient')?.addEventListener('click', async () => {
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

    document.getElementById('vitals-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const patientId = document.getElementById('nurse-patient-id').textContent;
        const patientName = document.getElementById('nurse-patient-name').textContent;
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
            await notifyDepartment('doctor', '❤️ Signes vitaux disponibles',
                `Signes vitaux de ${patientName} enregistrés. Patient prêt pour consultation.`, '#dc3545');
            await notifyAdmin('❤️ Signes vitaux enregistrés',
                `${state.currentUser.name} a pris les signes vitaux de ${patientName}.`);
        } catch(e) {}
    });
});

async function loadVitalsHistory(patientId) {
    const vitals = await API.getVitals(patientId);
    const container = document.getElementById('vitals-history');
    if (!vitals.length) { container.innerHTML = '<p class="text-muted">Aucun signe vital.</p>'; return; }
    const activeVitals = state.vitalTypes.filter(v => v.active);
    container.innerHTML = `<div class="table-container"><table><thead><tr><th>Date/Heure</th>${activeVitals.map(v=>`<th>${v.name}</th>`).join('')}<th>Par</th></tr></thead><tbody>
        ${vitals.map(r=>`<tr><td>${r.date} ${r.time}</td>${activeVitals.map(v=>{const val=r.values[v.name];return`<td>${val?val.value+' '+val.unit:'-'}</td>`;}).join('')}<td>${r.taken_by}</td></tr>`).join('')}
    </tbody></table></div>`;
}

// ─── MÉDECIN ─────────────────────────────────────────────────
function updateDoctorConsultationTypes() {
    const sel = document.getElementById('doctor-consultation-type');
    if (!sel) return;
    sel.innerHTML = '<option value="">Sélectionner...</option>';
    state.consultationTypes.filter(ct => ct.active).forEach(ct => {
        sel.innerHTML += `<option value="${ct.id}">${ct.name} — ${ct.price} Gdes</option>`;
    });
}

function updateLabAnalysesSelect() {
    const container = document.getElementById('lab-analyses-selection');
    if (!container) return;
    container.innerHTML = state.labAnalysisTypes.filter(a => a.active).map(a => `
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;">
            <input type="checkbox" value="${a.id}" data-price="${a.price}" style="accent-color:var(--primary);">
            ${a.name} <span class="badge badge-primary">${a.price} Gdes</span>
            <span class="result-type-badge ${a.result_type==='image'?'result-type-image':'result-type-text'}">${a.result_type==='image'?'Image':'Texte'}</span>
        </label>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('search-doctor-patient')?.addEventListener('click', async () => {
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
            const unpaid = txs.filter(t=>t.status==='unpaid').length;
            const paid   = txs.filter(t=>t.status==='paid').length;
            let statusText  = unpaid===0&&paid>0?'Tout payé':paid>0&&unpaid>0?'Partiel':'Non payé';
            let statusClass = unpaid===0&&paid>0?'status-paid':paid>0&&unpaid>0?'status-partial':'status-unpaid';
            document.getElementById('doctor-payment-status').textContent = statusText;
            document.getElementById('doctor-payment-status').className   = `patient-status-badge ${statusClass}`;
            const consult = txs.find(t=>t.type==='consultation');
            document.getElementById('current-consultation-info').innerHTML = consult ?
                `<p><strong>Type:</strong> ${consult.service} — <span class="${consult.status==='paid'?'status-paid':'status-unpaid'}">${consult.status==='paid'?'Payé':'Non payé'}</span></p>` :
                '<p class="text-muted">Aucune consultation enregistrée</p>';
            document.getElementById('consultation-modification-section')?.classList.remove('hidden');

            // Résultats d\'analyses du patient
            const labTxs = await API.getTransactions({ patientId: p.id, type: 'lab' }).catch(()=>[]);
            const labResults = labTxs.filter(t => t.result);
            const labResultsContainer = document.getElementById('doctor-lab-results');
            if (labResultsContainer) {
                if (labResults.length > 0) {
                    labResultsContainer.innerHTML = labResults.map(t => `
                        <div class="card mb-2" style="border-left-color:#17a2b8;">
                            <div class="d-flex justify-between align-center">
                                <div>
                                    <h5 style="color:#17a2b8;">${t.service}</h5>
                                    <small class="text-muted">${t.date} — ${t.lab_status === 'completed' ? '<span class="status-paid">Complété</span>' : 'En cours'}</small>
                                </div>
                            </div>
                            <div class="mt-2">
                                ${t.result && t.result.startsWith('data:') 
                                    ? `<img src="${t.result}" style="max-width:100%;max-height:300px;border-radius:8px;border:1px solid #e2ecf8;">` 
                                    : `<div class="alert alert-info" style="white-space:pre-wrap;font-size:.88rem;">${t.result}</div>`}
                            </div>
                        </div>`).join('');
                    labResultsContainer.closest('.card').classList.remove('hidden');
                } else {
                    labResultsContainer.innerHTML = '<p class="text-muted">Aucun résultat disponible.</p>';
                    labResultsContainer.closest('.card').classList.remove('hidden');
                }
            }

            // Signes vitaux récents
            const vitals = await API.getVitals(p.id).catch(()=>[]);
            const vDisplay = document.getElementById('current-vitals-display');
            if (vitals.length > 0) {
                const last = vitals[0];
                vDisplay.innerHTML = `<small class="text-muted">${last.date} ${last.time}</small><br>` +
                    Object.entries(last.values).map(([k,v])=>`<span class="badge badge-primary" style="margin:2px;">${k}: ${v.value} ${v.unit}</span>`).join('');
            } else {
                vDisplay.innerHTML = '<p class="text-muted">Aucun signe vital.</p>';
            }
            document.getElementById('doctor-patient-details').classList.remove('hidden');
        } catch(e) {}
    });

    document.getElementById('edit-vitals-btn')?.addEventListener('click', () => {
        const modSection = document.getElementById('doctor-vitals-modification');
        modSection.classList.toggle('hidden');
        const container = document.getElementById('vitals-modification-inputs');
        container.innerHTML = state.vitalTypes.filter(v=>v.active).map(v=>`
            <div class="vital-item">
                <label class="form-label">${v.name} (${v.unit})</label>
                <input type="text" class="form-control vital-mod-input" data-id="${v.id}" placeholder="Valeur">
            </div>`).join('');
        container.className = 'vitals-grid';
    });

    document.getElementById('cancel-vitals-modification')?.addEventListener('click', () => {
        document.getElementById('doctor-vitals-modification').classList.add('hidden');
    });

    document.getElementById('vitals-modification-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const patientId = document.getElementById('doctor-patient-id').textContent;
        const vitals = await API.getVitals(patientId).catch(()=>[]);
        const vitalId = vitals[0]?.id;
        const values = {};
        document.querySelectorAll('.vital-mod-input').forEach(input => {
            const vital = state.vitalTypes.find(v=>v.id==input.dataset.id);
            if (vital && input.value.trim()) values[vital.name] = { value: input.value, unit: vital.unit, normalRange: `${vital.min} – ${vital.max}` };
        });
        try {
            if (vitalId) await apiCall(() => API.updateVitals(vitalId, { values }));
            else         await apiCall(() => API.addVitals({ patientId, values }));
            toast('Signes vitaux modifiés!');
            document.getElementById('doctor-vitals-modification').classList.add('hidden');
            document.getElementById('search-doctor-patient').click();
        } catch(e) {}
    });

    document.getElementById('update-consultation-type')?.addEventListener('click', async () => {
        const typeId = parseInt(document.getElementById('doctor-consultation-type').value);
        if (!typeId) { toast('Sélectionner un type', 'error'); return; }
        const p = state.currentDoctorPatient;
        const txs = await API.getTransactions({ patientId: p.id, type: 'consultation' });
        if (!txs.length) { toast('Aucune consultation trouvée', 'error'); return; }
        try {
            await apiCall(() => API.updateTransactionConsultationType(txs[0].id, typeId));
            toast('Type de consultation modifié');
            document.getElementById('search-doctor-patient').click();
        } catch(e) {}
    });

    document.getElementById('modify-analyses-btn')?.addEventListener('click', () => {
        document.getElementById('lab-modification-panel')?.classList.toggle('hidden');
    });
    document.getElementById('save-modified-analysis')?.addEventListener('click', () => {
        const name  = document.getElementById('modified-analysis-name').value;
        const price = parseFloat(document.getElementById('modified-analysis-price').value);
        if (!name || isNaN(price)) { toast('Remplir tous les champs', 'error'); return; }
        state.currentModifiedAnalysis = { ...state.currentModifiedAnalysis, modifiedName: name, modifiedPrice: price };
        document.getElementById('lab-modification-panel')?.classList.add('hidden');
        toast('Analyse modifiée pour ce patient');
    });
    document.getElementById('cancel-analysis-modification')?.addEventListener('click', () => {
        document.getElementById('lab-modification-panel')?.classList.add('hidden');
        state.currentModifiedAnalysis = null;
    });

    document.getElementById('medication-search')?.addEventListener('input', function () {
        const q = this.value.toLowerCase();
        const sug = document.getElementById('medication-suggestions');
        if (q.length < 2) { sug.classList.add('hidden'); return; }
        const matches = state.medications.filter(m=>m.name.toLowerCase().includes(q)||(m.generic_name||'').toLowerCase().includes(q)).slice(0,5);
        if (matches.length) {
            sug.innerHTML = matches.map(m=>`<div class="suggestion-item" style="padding:8px 14px;cursor:pointer;border-bottom:1px solid #eee;font-size:.88rem;" onclick="addMedToPrescription('${m.id}')"><strong>${m.name}</strong> (${m.form}) — Stock: ${m.quantity} <span class="badge ${m.quantity>m.alert_threshold?'badge-success':'badge-danger'}">${m.quantity>0?'Disponible':'Rupture'}</span></div>`).join('');
            sug.classList.remove('hidden');
        } else { sug.classList.add('hidden'); }
    });

    document.getElementById('consultation-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.currentDoctorPatient) { toast('Sélectionner un patient', 'error'); return; }
        const p         = state.currentDoctorPatient;
        const diagnosis   = document.getElementById('consultation-diagnosis').value;
        const extraNote   = document.getElementById('consultation-extra-note').value;
        const followupDate = document.getElementById('followup-date').value;
        const followupTime = document.getElementById('followup-time').value;

        try {
            await apiCall(() => API.addConsultation({
                patientId: p.id, patientName: p.full_name,
                diagnosis: diagnosis + (extraNote ? '\n\n📝 Note supplémentaire: ' + extraNote : ''),
                followupDate, followupTime
            }));

            const checkedAnalyses = document.querySelectorAll('#lab-analyses-selection input:checked');
            for (const cb of checkedAnalyses) {
                const aId   = parseInt(cb.value);
                const aType = state.labAnalysisTypes.find(a=>a.id===aId);
                if (!aType) continue;
                let name  = state.currentModifiedAnalysis?.id===aId&&state.currentModifiedAnalysis.modifiedName?state.currentModifiedAnalysis.modifiedName:aType.name;
                let price = state.currentModifiedAnalysis?.id===aId&&state.currentModifiedAnalysis.modifiedPrice?state.currentModifiedAnalysis.modifiedPrice:aType.price;
                await API.addTransaction({ patientId:p.id, patientName:p.full_name, service:`Analyse: ${name}`, amount:price, type:'lab', analysisId:aId });
            }

            // Analyse personnalisée (hors liste)
            const customAnalysisName  = document.getElementById('custom-analysis-name').value.trim();
            const customAnalysisPrice = parseFloat(document.getElementById('custom-analysis-price').value);
            if (customAnalysisName && !isNaN(customAnalysisPrice) && customAnalysisPrice >= 0) {
                await API.addTransaction({ patientId:p.id, patientName:p.full_name,
                    service:`Analyse: ${customAnalysisName}`, amount:customAnalysisPrice, type:'lab' });
            }

            const medRows = document.querySelectorAll('#prescription-medications-list tr');
            for (const row of medRows) {
                const medId  = row.querySelector('.quantity-input').dataset.medId;
                const qty    = parseInt(row.querySelector('.quantity-input').value);
                const dosage = row.querySelectorAll('input')[1].value;
                const med    = state.medications.find(m=>m.id===medId);
                if (!med) continue;
                if (qty > med.quantity) { toast(`Stock insuffisant: ${med.name}`, 'error'); continue; }
                await API.addTransaction({ patientId:p.id, patientName:p.full_name, service:`Médicament: ${med.name}`, amount:med.price*qty, type:'medication', medicationId:med.id, dosage, quantity:qty });
            }

            toast('Consultation enregistrée!', 'success');
            state.currentModifiedAnalysis = null;
            e.target.reset();
            document.getElementById('prescription-medications-list').innerHTML = '';
            document.getElementById('custom-analysis-name').value = '';
            document.getElementById('custom-analysis-price').value = '';

            const totalAnalyses = checkedAnalyses.length + (customAnalysisName ? 1 : 0);

            // Notifications cross-département
            await notifyDepartment('cashier', '🩺 Nouvelle consultation',
                `${p.full_name} — nouvelle consultation avec analyses/médicaments. Paiement à encaisser.`, '#1a6bca');
            if (totalAnalyses > 0) {
                await notifyDepartment('lab', '🧪 Analyses prescrites',
                    `${p.full_name} — ${totalAnalyses} analyse(s) prescrite(s). En attente de paiement.`, '#ffc107');
            }
            if (medRows.length > 0) {
                await notifyDepartment('pharmacy', '💊 Médicaments prescrits',
                    `${p.full_name} — ${medRows.length} médicament(s) prescrit(s). En attente de paiement.`, '#28a745');
            }
            // Notification administration
            await notifyAdmin('🩺 Nouvelle consultation enregistrée',
                `Dr. ${state.currentUser.name} — Patient: ${p.full_name}. ${totalAnalyses} analyse(s), ${medRows.length} médicament(s).`);
        } catch(e) {}
    });
});

function addMedToPrescription(medId) {
    const med = state.medications.find(m=>m.id===medId);
    if (!med) return;
    const tbody = document.getElementById('prescription-medications-list');
    const row   = document.createElement('tr');
    row.innerHTML = `
        <td>${med.name}</td>
        <td><input type="text" class="form-control" value="1 comprimé 3x/jour" style="min-width:140px;"></td>
        <td><input type="number" class="form-control quantity-input" data-med-id="${med.id}" value="10" min="1" max="${med.quantity}" style="width:80px;"></td>
        <td>${med.quantity} <span class="badge ${med.quantity<=med.alert_threshold?'badge-danger':'badge-success'}">${med.quantity>0?'OK':'Rupture'}</span></td>
        <td><button class="btn btn-danger btn-sm" onclick="this.closest('tr').remove()"><i class="fas fa-trash"></i></button></td>`;
    tbody.appendChild(row);
    document.getElementById('medication-suggestions').classList.add('hidden');
    document.getElementById('medication-search').value = '';
}

async function loadDoctorAppointments() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const apps = await API.getAppointments({ doctor: state.currentUser.username, fromDate: today });
        const container = document.getElementById('doctor-appointments-list');
        container.innerHTML = apps.map(a=>`
            <div class="appointment-item">
                <strong>${a.patient_name}</strong> — ${a.date} à ${a.time}<br>
                <small class="text-muted">Motif: ${a.reason||'-'}</small>
                <span class="appointment-status status-${a.status==='scheduled'?'pending':a.status} ms-2">${a.status}</span>
                <div class="appointment-actions">
                    <button class="btn btn-sm btn-success" onclick="updateApptStatus('${a.id}','completed')">Terminé</button>
                </div>
            </div>`).join('') || '<p class="text-muted">Aucun rendez-vous.</p>';
    } catch(e) {}
}

// ─── LABORATOIRE ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('search-lab-patient')?.addEventListener('click', async () => {
        const search = document.getElementById('lab-patient-search').value.trim();
        try {
            const patients = await apiCall(() => API.getPatients({ search }));
            if (!patients.length) { toast('Patient non trouvé', 'error'); return; }
            const p = patients[0];
            document.getElementById('lab-patient-name').textContent = p.full_name;
            document.getElementById('lab-patient-id').textContent   = p.id;
            const txs = await API.getTransactions({ patientId: p.id, type: 'lab' });
            const unpaid = txs.filter(t=>t.status==='unpaid').length;
            const paid   = txs.filter(t=>t.status==='paid').length;
            let statusText  = unpaid===0&&paid>0?'Tout payé':paid>0&&unpaid>0?'Partiellement payé':unpaid>0?'Non payé':'Aucune analyse';
            let statusClass = unpaid===0&&paid>0?'status-paid':paid>0&&unpaid>0?'status-partial':unpaid>0?'status-unpaid':'';
            document.getElementById('lab-payment-status').textContent = statusText;
            document.getElementById('lab-payment-status').className   = `patient-status-badge ${statusClass}`;
            const labList = document.getElementById('lab-analyses-list');
            labList.innerHTML = txs.map(t=>`
                <div class="card mb-2">
                    <div class="d-flex justify-between align-center">
                        <div>
                            <h5>${t.service}</h5>
                            <p>Paiement: <span class="${t.status==='paid'?'status-paid':'status-unpaid'}">${t.status==='paid'?'Payé':'Non payé'}</span></p>
                            <p>Analyse: <span class="${t.lab_status==='completed'?'status-paid':'status-unpaid'}">${t.lab_status||'En attente'}</span></p>
                        </div>
                        <div class="d-flex gap-10">
                            ${t.status==='paid'&&t.lab_status!=='completed'?`<button class="btn btn-success btn-sm" onclick="enterLabResult('${t.id}')"><i class="fas fa-pen"></i> Saisir</button>`:''}
                            ${t.result?`<button class="btn btn-info btn-sm" onclick="viewLabResult('${t.id}')"><i class="fas fa-eye"></i> Voir</button>`:''}
                        </div>
                    </div>
                    ${t.result?`<div class="mt-2"><strong>Résultat:</strong><br>${t.result.startsWith('data:')?`<img src="${t.result}" class="image-preview">`:t.result}</div>`:''}
                </div>`).join('') || '<p class="text-muted">Aucune analyse.</p>';
            document.getElementById('lab-patient-details').classList.remove('hidden');
            updatePendingAnalysesList();
        } catch(e) {}
    });
});

async function updatePendingAnalysesList() {
    try {
        const txs = await API.getTransactions({ type: 'lab' });
        const pending = txs.filter(t=>t.status==='paid'&&t.lab_status!=='completed');
        const container = document.getElementById('pending-analyses-list');
        container.innerHTML = pending.length ?
            `<div class="table-container"><table><thead><tr><th>Patient</th><th>Analyse</th><th>Date</th><th>Action</th></tr></thead><tbody>
                ${pending.map(t=>`<tr><td>${t.patient_name}</td><td>${t.service}</td><td>${t.date}</td>
                <td><button class="btn btn-sm btn-success" onclick="enterLabResult('${t.id}')"><i class="fas fa-pen"></i> Saisir</button></td></tr>`).join('')}
            </tbody></table></div>` : '<p class="text-muted">Aucune analyse en attente.</p>';
    } catch(e) {}
}

function enterLabResult(txId) {
    const modal = document.createElement('div');
    modal.id = 'lab-result-modal';
    modal.className = 'transaction-details-modal';
    modal.innerHTML = `<div class="transaction-details-content" style="max-width:500px;">
        <h4><i class="fas fa-flask" style="color:var(--warning);"></i> Saisir résultat</h4>
        <div class="form-group mt-3">
            <label class="form-label">Résultat (texte)</label>
            <textarea id="lab-result-text" class="form-control" rows="5" placeholder="Résultat de l\'analyse..."></textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Ou image</label>
            <input type="file" id="lab-result-image" class="form-control" accept="image/*">
        </div>
        <div class="d-flex gap-10 mt-3">
            <button class="btn btn-success" onclick="saveLabResultFn('${txId}')"><i class="fas fa-save"></i> Enregistrer</button>
            <button class="btn btn-secondary" onclick="document.getElementById(\'lab-result-modal\').remove()">Annuler</button>
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
                // Notification → médecin
                await notifyDepartment('doctor', '🧪 Résultat d\'analyse disponible',
                    `Résultat d\'analyse (image) disponible. Référence: ${txId}`, '#17a2b8');
            };
            reader.readAsDataURL(fileInput.files[0]);
        } else {
            if (!textVal.trim()) { toast('Entrer un résultat', 'error'); return; }
            await apiCall(() => API.saveLabResult(txId, textVal));
            toast('Résultat enregistré!');
            document.getElementById('lab-result-modal').remove();
            updatePendingAnalysesList();
            await notifyDepartment('doctor', '🧪 Résultat d\'analyse disponible',
                `Nouveau résultat d\'analyse disponible. Référence: ${txId}`, '#17a2b8');
        }
    } catch(e) {}
}

function viewLabResult(txId) {
    API.getTransactions({}).then(txs => {
        const t = txs.find(x=>x.id===txId);
        if (!t||!t.result) return;
        const modal = document.createElement('div');
        modal.className = 'transaction-details-modal';
        modal.innerHTML = `<div class="transaction-details-content" style="max-width:600px;">
            <h4>${t.service}</h4>
            ${t.result.startsWith('data:')?`<img src="${t.result}" class="image-preview" style="max-width:100%;">`:
            `<div class="alert alert-info mt-2" style="white-space:pre-wrap;">${t.result}</div>`}
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
    container.innerHTML = '<table><thead><tr><th>Médicament</th><th>Forme</th><th>Stock</th><th>Prix</th><th>Emplacement</th><th>Statut</th></tr></thead><tbody>' +
        meds.map(function(m) {
            var statusBadge = m.quantity === 0
                ? '<span class="status-unpaid">Rupture</span>'
                : m.quantity <= m.alert_threshold
                    ? '<span class="status-partial">Faible</span>'
                    : '<span class="status-paid">OK</span>';
            var location = (m.espace ? m.espace : '') + (m.espace && m.etagere ? ' / ' : '') + (m.etagere ? m.etagere : '');
            return '<tr class="' + (m.quantity===0?'out-of-stock':m.quantity<=m.alert_threshold?'low-stock':'') + '">' +
                '<td><strong>' + m.name + '</strong>' + (m.generic_name&&m.generic_name!==m.name?'<br><small class="text-muted">'+m.generic_name+'</small>':'') + '</td>' +
                '<td>' + (m.form||'-') + '</td>' +
                '<td><strong>' + m.quantity + '</strong> ' + (m.unit||'') + '</td>' +
                '<td>' + m.price + ' HTG <span class="currency-tag usd">$' + htgToUsd(m.price) + '</span></td>' +
                '<td>' + (location ? '<span class="badge badge-primary">' + location + '</span>' : '<span class="text-muted">-</span>') + '</td>' +
            '<td>' + (m.supplier_id ?
                '<span class="badge" style="background:#e8f5e9;color:#2e7d32;"><i class="fas fa-truck" style="margin-right:4px;"></i>' +
                (function() {
                    return m.supplier_name || m.supplier_id;
                })() + '</span>' : '<span class="text-muted">-</span>') + '</td>' +
                '<td>' + statusBadge + '</td>' +
            '</tr>';
        }).join('') +
    '</tbody></table>';
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('search-pharmacy-patient')?.addEventListener('click', async () => {
        const search = document.getElementById('pharmacy-patient-search').value.trim();
        try {
            const patients = await apiCall(() => API.getPatients({ search }));
            if (!patients.length) { toast('Patient non trouvé', 'error'); return; }
            const p = patients[0];
            document.getElementById('pharmacy-patient-name').textContent = p.full_name;
            document.getElementById('pharmacy-patient-id').textContent   = p.id;
            const txs = await API.getTransactions({ patientId: p.id, type: 'medication' });
            const unpaid = txs.filter(t=>t.status==='unpaid').length;
            const paid   = txs.filter(t=>t.status==='paid').length;
            let statusText  = unpaid===0&&paid>0?'Tout payé':paid>0&&unpaid>0?'Partiellement payé':unpaid>0?'Non payé':'Aucun médicament';
            let statusClass = unpaid===0&&paid>0?'status-paid':paid>0&&unpaid>0?'status-partial':'status-unpaid';
            document.getElementById('pharmacy-payment-status').textContent = statusText;
            document.getElementById('pharmacy-payment-status').className   = `patient-status-badge ${statusClass}`;
            document.getElementById('pharmacy-prescriptions-list').innerHTML = txs.map(t=>`
                <div class="card mb-2">
                    <div class="d-flex justify-between align-center">
                        <div>
                            <h5>${t.service}</h5>
                            <p><strong>Dosage:</strong> ${t.dosage||'-'} | <strong>Qté:</strong> ${t.quantity||'-'}</p>
                            <p>Paiement: <span class="${t.status==='paid'?'status-paid':'status-unpaid'}">${t.status==='paid'?'Payé':'Non payé'}</span></p>
                            <p>Livraison: <span class="${t.delivery_status==='delivered'?'status-paid':'status-unpaid'}">${t.delivery_status||'En attente'}</span></p>
                        </div>
                        ${t.status==='paid'&&t.delivery_status!=='delivered'?
                            `<button class="btn btn-success btn-sm" onclick="deliverMed('${t.id}')"><i class="fas fa-pills"></i> Délivrer</button>`:''}
                    </div>
                </div>`).join('') || '<p class="text-muted">Aucun médicament prescrit.</p>';
            const hasDeliverable = txs.some(t=>t.status==='paid'&&t.delivery_status!=='delivered');
            document.getElementById('deliver-medications').disabled = !hasDeliverable;
            document.getElementById('pharmacy-patient-details').classList.remove('hidden');
        } catch(e) {}
    });

    document.getElementById('deliver-medications')?.addEventListener('click', async () => {
        const patientId = document.getElementById('pharmacy-patient-id').textContent;
        const patientName = document.getElementById('pharmacy-patient-name').textContent;
        const txs = await API.getTransactions({ patientId, type: 'medication' });
        const deliverable = txs.filter(t=>t.status==='paid'&&t.delivery_status!=='delivered');
        for (const t of deliverable) {
            try { await apiCall(() => API.deliverMedication(t.id)); } catch(e) { break; }
        }
        toast('Médicaments délivrés!', 'success');
        document.getElementById('search-pharmacy-patient').click();
        await updateMedicationStockDisplay();
        state.medications = await API.getMedications().catch(()=>[]);
        await notifyDepartment('nurse', '💊 Médicaments délivrés',
            `Médicaments de ${patientName} délivrés par la pharmacie.`, '#28a745');
        await notifyAdmin('💊 Médicaments délivrés',
            `${state.currentUser.name} a délivré les médicaments de ${patientName}.`);
    });

    document.getElementById('add-new-medication')?.addEventListener('click', () => {
        document.getElementById('new-medication-form').style.display = 'block';
    });
    document.getElementById('cancel-new-medication')?.addEventListener('click', () => {
        document.getElementById('new-medication-form').style.display = 'none';
    });
    document.getElementById('save-new-medication')?.addEventListener('click', async () => {
        const name    = document.getElementById('new-med-name').value.trim();
        const generic = document.getElementById('new-med-generic').value.trim();
        const form    = document.getElementById('new-med-form').value;
        const unit    = document.getElementById('new-med-unit').value.trim();
        const qty     = parseInt(document.getElementById('new-med-quantity').value);
        const alert   = parseInt(document.getElementById('new-med-alert').value);
        const price   = parseFloat(document.getElementById('new-med-price').value);
        if (!name || !form || !unit || isNaN(qty) || isNaN(alert) || isNaN(price)) { toast('Remplir tous les champs obligatoires', 'error'); return; }
        try {
            const med = await apiCall(() => API.addMedication({ name, genericName: generic, form, unit, quantity: qty, alertThreshold: alert, price }));
            state.medications.push(med);
            toast('Médicament ajouté!', 'success');
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
        if (!badge) return;
        if (data.count > 0) { badge.textContent = data.count; badge.classList.remove('hidden'); }
        else badge.classList.add('hidden');
    } catch(e) {}
}

async function loadConversations() {
    const messages = await API.getMessages().catch(()=>[]);
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
            <div class="conversation-avatar">${partner[0]?.toUpperCase()}</div>
            <div class="conversation-info">
                <div class="d-flex justify-between align-center">
                    <strong>${partner}</strong>
                    ${data.unread>0?`<span class="badge badge-danger" style="min-width:20px;justify-content:center;">${data.unread}</span>`:''}
                </div>
                <p class="conversation-last-message">${data.messages[data.messages.length-1]?.subject||data.messages[data.messages.length-1]?.content||''}</p>
            </div>
        </div>`).join('') || '<div class="notif-empty">Aucune conversation</div>';
}

async function openConversation(partner) {
    currentConversationPartner = partner;
    document.getElementById('compose-panel').classList.add('hidden');
    document.getElementById('chat-panel').style.display = 'block';
    const messages = await API.getMessages().catch(()=>[]);
    const conv = messages.filter(m=>m.sender===partner||m.recipient===partner);
    for (const m of conv.filter(m=>!m.read&&m.recipient===state.currentUser.username)) {
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
    document.getElementById('compose-message')?.addEventListener('click', async () => {
        document.getElementById('compose-panel').classList.remove('hidden');
        document.getElementById('chat-panel').style.display = 'none';
        const users = await API.getUsers().catch(()=>[]);
        const sel = document.getElementById('message-recipient');
        sel.innerHTML = '<option value="">Destinataire...</option>';
        users.filter(u=>u.username!==state.currentUser.username&&u.active).forEach(u => {
            sel.innerHTML += `<option value="${u.username}" data-role="${u.role}">${u.name} (${getRoleLabel(u.role)})</option>`;
        });
    });

    document.getElementById('cancel-compose')?.addEventListener('click', () => {
        document.getElementById('compose-panel').classList.add('hidden');
    });

    document.getElementById('send-message')?.addEventListener('click', async () => {
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

    document.getElementById('send-chat')?.addEventListener('click', async () => {
        const content = document.getElementById('chat-input').value.trim();
        if (!content || !currentConversationPartner) return;
        try {
            await apiCall(() => API.sendMessage({ recipient: currentConversationPartner, recipientRole: '', subject: '', content, type: 'message' }));
            document.getElementById('chat-input').value = '';
            openConversation(currentConversationPartner);
        } catch(e) {}
    });

    document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('send-chat').click();
    });
});

// ─── ADMINISTRATION ──────────────────────────────────────────
// ─── COMPTES DE CAISSE ───────────────────────────────────────
async function renderAccountsDashboard(stats) {
    var section = document.getElementById('accounts-dashboard-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'accounts-dashboard-section';
        section.className = 'card mt-3';
        var adminSection = document.getElementById('administration');
        if (adminSection) adminSection.appendChild(section);
    }

    var today = new Date().toISOString().split('T')[0];
    var rate  = state.exchangeRate || 130;

    // Charger toutes les transactions payées + petite caisse
    var [txAll, txToday, petiteCaisse, withdrawals] = await Promise.all([
        API.getTransactions({ status: 'paid' }).catch(function() { return []; }),
        API.getTransactions({ status: 'paid', date: today }).catch(function() { return []; }),
        API.getPetiteCaisse ? API.getPetiteCaisse().catch(function() { return []; }) : Promise.resolve([]),
        API.getCashWithdrawals ? API.getCashWithdrawals().catch(function() { return []; }) : Promise.resolve([]),
    ]);

    // Calcul par méthode de paiement (all time)
    var methods = ['cash', 'moncash', 'natcash', 'card', 'virement'];
    var methodLabels = { cash: 'Espèces', moncash: 'MonCash', natcash: 'NatCash', card: 'Carte', virement: 'Virement' };
    var methodIcons  = { cash: 'fa-money-bill-wave', moncash: 'fa-mobile-alt', natcash: 'fa-wallet', card: 'fa-credit-card', virement: 'fa-exchange-alt' };
    var methodColors = { cash: '#28a745', moncash: '#e91e63', natcash: '#ff5722', card: '#1a6bca', virement: '#9c27b0' };

    var accounts = {};
    methods.forEach(function(m) {
        var txMethod  = txAll.filter(function(t)   { return (t.payment_method||'').toLowerCase() === m; });
        var todayMeth = txToday.filter(function(t) { return (t.payment_method||'').toLowerCase() === m; });
        var wdMeth    = withdrawals.filter(function(w) { return true; }); // retraits globaux
        accounts[m] = {
            total: txMethod.reduce(function(s,t) { return s+parseFloat(t.amount); }, 0),
            today: todayMeth.reduce(function(s,t) { return s+parseFloat(t.amount); }, 0),
            count: txMethod.length,
        };
    });

    // Grande caisse = total tous paiements - retraits
    var grandTotal  = txAll.reduce(function(s,t) { return s+parseFloat(t.amount); }, 0);
    var todayTotal  = txToday.reduce(function(s,t) { return s+parseFloat(t.amount); }, 0);
    var totalWd     = withdrawals.reduce(function(s,w) { return s+parseFloat(w.amount); }, 0);
    var grandeCaisse = grandTotal - totalWd;

    // Petite caisse = somme des transferts 'in' - somme des dépenses 'out'
    var pcIn  = petiteCaisse.filter(function(p) { return p.direction === 'in'; })
                            .reduce(function(s,p) { return s+parseFloat(p.amount); }, 0);
    var pcOut = petiteCaisse.filter(function(p) { return p.direction === 'out'; })
                            .reduce(function(s,p) { return s+parseFloat(p.amount); }, 0);
    var pcSolde = pcIn - pcOut;

    section.innerHTML =
        '<h3><i class="fas fa-university" style="color:#1a6bca;"></i> Tableau des Comptes</h3>' +
        '<p class="text-muted" style="margin-bottom:16px;font-size:.85rem;">Vue en temps réel de tous vos comptes de caisse</p>' +

        // Grande caisse
        '<div style="background:linear-gradient(135deg,#1a6bca,#0d4d9c);color:#fff;border-radius:12px;padding:20px;margin-bottom:16px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">' +
        '<div>' +
        '<p style="opacity:.8;font-size:.85rem;margin-bottom:4px;"><i class="fas fa-landmark"></i> GRANDE CAISSE</p>' +
        '<h2 style="font-size:2rem;font-weight:700;margin-bottom:2px;">' + grandeCaisse.toLocaleString('fr-FR') + ' HTG</h2>' +
        '<p style="opacity:.75;font-size:.88rem;">≈ $' + (grandeCaisse/rate).toFixed(2) + ' USD</p>' +
        '</div>' +
        '<div style="text-align:right;">' +
        '<p style="opacity:.75;font-size:.82rem;">Aujourd\'hui</p>' +
        '<strong style="font-size:1.2rem;">' + todayTotal.toLocaleString('fr-FR') + ' HTG</strong>' +
        '</div></div>' +
        '<div style="display:flex;gap:20px;margin-top:14px;flex-wrap:wrap;">' +
        '<span style="opacity:.8;font-size:.82rem;"><i class="fas fa-arrow-down"></i> Encaissé: ' + grandTotal.toLocaleString('fr-FR') + ' HTG</span>' +
        '<span style="opacity:.8;font-size:.82rem;"><i class="fas fa-arrow-up"></i> Retraits: ' + totalWd.toLocaleString('fr-FR') + ' HTG</span>' +
        '</div></div>' +

        // Comptes par méthode
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-bottom:20px;">' +
        methods.map(function(m) {
            var acc = accounts[m];
            return '<div style="background:#fff;border-radius:10px;padding:16px;border:1px solid var(--border);border-left:4px solid ' + methodColors[m] + ';box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
                '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
                '<div style="width:36px;height:36px;border-radius:8px;background:' + methodColors[m] + ';display:flex;align-items:center;justify-content:center;color:#fff;">' +
                '<i class="fas ' + methodIcons[m] + '"></i></div>' +
                '<strong style="font-size:.9rem;">' + methodLabels[m] + '</strong></div>' +
                '<div style="font-size:1.2rem;font-weight:700;color:' + methodColors[m] + ';">' + acc.total.toLocaleString('fr-FR') + '</div>' +
                '<div style="font-size:.72rem;color:var(--muted);">HTG total (' + acc.count + ' tx)</div>' +
                '<div style="margin-top:6px;font-size:.8rem;color:var(--muted);">Aujourd\'hui: <strong>' + acc.today.toLocaleString('fr-FR') + '</strong></div>' +
                '</div>';
        }).join('') +

        // Petite caisse
        '<div style="background:#fff;border-radius:10px;padding:16px;border:1px solid var(--border);border-left:4px solid #ff9800;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
        '<div style="width:36px;height:36px;border-radius:8px;background:#ff9800;display:flex;align-items:center;justify-content:center;color:#fff;">' +
        '<i class="fas fa-piggy-bank"></i></div>' +
        '<strong style="font-size:.9rem;">Petite Caisse</strong></div>' +
        '<div style="font-size:1.2rem;font-weight:700;color:#ff9800;">' + pcSolde.toLocaleString('fr-FR') + '</div>' +
        '<div style="font-size:.72rem;color:var(--muted);">HTG disponible</div>' +
        '<div style="margin-top:6px;font-size:.8rem;color:var(--muted);">Reçu: ' + pcIn.toLocaleString('fr-FR') + ' | Dépensé: ' + pcOut.toLocaleString('fr-FR') + '</div>' +
        '</div>' +
        '</div>' +

        // Gestion petite caisse
        '<div class="card" style="background:#fff8e1;border-left-color:#ff9800;">' +
        '<h4><i class="fas fa-piggy-bank" style="color:#ff9800;"></i> Gérer la Petite Caisse</h4>' +
        '<div class="add-form-grid" style="margin-top:12px;">' +
        '<div><label class="form-label">Opération</label>' +
        '<select id="pc-direction" class="form-control">' +
        '<option value="in">Transfert depuis grande caisse (+)</option>' +
        '<option value="out">Dépense petite caisse (-)</option>' +
        '</select></div>' +
        '<div><label class="form-label">Montant (HTG) *</label>' +
        '<input type="number" id="pc-amount" class="form-control" placeholder="0.00" min="0"></div>' +
        '<div><label class="form-label">Note *</label>' +
        '<input type="text" id="pc-note" class="form-control" placeholder="Ex: Achat fournitures, Transfert..."></div>' +
        '<div style="display:flex;align-items:flex-end;">' +
        '<button class="btn btn-warning" style="width:100%;color:#212529;" onclick="addPetiteCaisse()">' +
        '<i class="fas fa-save"></i> Enregistrer</button></div>' +
        '</div>' +
        '</div>' +

        // Historique petite caisse
        (petiteCaisse.length ?
        '<h4 style="margin:16px 0 10px;"><i class="fas fa-history"></i> Historique Petite Caisse</h4>' +
        '<div class="table-container"><table><thead><tr><th>Date</th><th>Opération</th><th>Montant</th><th>Note</th><th>Par</th><th>Action</th></tr></thead><tbody>' +
        petiteCaisse.slice(0,20).map(function(p) {
            var isIn  = p.direction === 'in';
            var amt   = parseFloat(p.amount);
            return '<tr>' +
                '<td>' + (p.date || new Date(p.created_at).toLocaleDateString('fr-FR')) + '</td>' +
                '<td><span class="badge ' + (isIn ? 'badge-success' : 'badge-danger') + '">' +
                (isIn ? '⬆ Transfert reçu' : '⬇ Dépense') + '</span></td>' +
                '<td><strong style="color:' + (isIn?'#28a745':'#dc3545') + ';">' +
                (isIn?'+':'-') + amt.toLocaleString('fr-FR') + ' HTG</strong></td>' +
                '<td>' + (p.note||'-') + '</td>' +
                '<td>' + (p.created_by||'-') + '</td>' +
                '<td><button class="btn btn-xs btn-danger" data-pid="' + p.id + '" onclick="deletePetiteCaisseFn(this.dataset.pid)">' +
                '<i class="fas fa-trash"></i></button></td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>' : '');
}

async function addPetiteCaisse() {
    var direction = document.getElementById('pc-direction').value;
    var amount    = parseFloat(document.getElementById('pc-amount').value);
    var note      = document.getElementById('pc-note').value.trim();
    if (isNaN(amount) || amount <= 0) { toast('Entrer un montant valide', 'error'); return; }
    if (!note) { toast('La note est obligatoire', 'error'); return; }
    try {
        await apiCall(function() { return API.addPetiteCaisse({ amount, note, direction }); });
        var label = direction === 'in' ? '+' + amount.toLocaleString('fr-FR') + ' HTG transféré vers petite caisse' : amount.toLocaleString('fr-FR') + ' HTG dépensé depuis petite caisse';
        toast(label, 'success');
        document.getElementById('pc-amount').value = '';
        document.getElementById('pc-note').value   = '';
        updateAdminStats();
    } catch(e) {}
}

async function deletePetiteCaisseFn(id) {
    if (!confirm('Supprimer cette opération ?')) return;
    try {
        await apiCall(function() { return API.deletePetiteCaisse(id); });
        toast('Opération supprimée', 'warning');
        updateAdminStats();
    } catch(e) {}
}

// ─── GESTION DE CAISSE ───────────────────────────────────────
async function renderCashManagement(stats) {
    var section = document.getElementById('cash-management-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'cash-management-section';
        section.className = 'card mt-3';
        var adminSection = document.getElementById('administration');
        if (adminSection) adminSection.appendChild(section);
    }

    // Charger les retraits du jour
    var today = new Date().toISOString().split('T')[0];
    var withdrawals = await API.getCashWithdrawals({ fromDate: today }).catch(function() { return []; });
    var totalWithdrawals = withdrawals.reduce(function(s, w) { return s + parseFloat(w.amount); }, 0);

    // Calculer encaissements du jour
    var todayRevenue = parseFloat(stats.todayRevenue || 0);
    var netCaisse    = todayRevenue - totalWithdrawals;

    // Récupérer les agents (caissiers)
    var users = await API.getUsers().catch(function() { return []; });
    var cashiers = users.filter(function(u) {
        return u.active && (u.role === 'cashier' || (u.extra_roles && u.extra_roles.includes('cashier')));
    });

    // Encaissements par agent aujourd\'hui
    var byAgent = stats.byAgent || [];

    section.innerHTML =
        '<h3><i class="fas fa-cash-register" style="color:#28a745;"></i> Gestion de Caisse — ' + today + '</h3>' +

        // Résumé
        '<div class="stats-container" style="margin:16px 0;">' +
        '<div class="stat-card">' +
        '<div class="stat-icon" style="background:#28a745"><i class="fas fa-arrow-down"></i></div>' +
        '<div class="stat-info"><h3>' + todayRevenue.toLocaleString('fr-FR') + ' HTG</h3><p>Encaissé aujourd\'hui</p></div></div>' +
        '<div class="stat-card">' +
        '<div class="stat-icon" style="background:#dc3545"><i class="fas fa-arrow-up"></i></div>' +
        '<div class="stat-info"><h3>' + totalWithdrawals.toLocaleString('fr-FR') + ' HTG</h3><p>Retraits/Commissions</p></div></div>' +
        '<div class="stat-card">' +
        '<div class="stat-icon" style="background:#1a6bca"><i class="fas fa-wallet"></i></div>' +
        '<div class="stat-info"><h3 style="color:' + (netCaisse >= 0 ? '#28a745' : '#dc3545') + ';">' +
        netCaisse.toLocaleString('fr-FR') + ' HTG</h3><p>Caisse nette</p></div></div>' +
        '<div class="stat-card">' +
        '<div class="stat-icon" style="background:#17a2b8"><i class="fas fa-dollar-sign"></i></div>' +
        '<div class="stat-info"><h3>$' + (netCaisse / parseFloat(localStorage.getItem ? localStorage.getItem('nc_rate') || 130 : 130)).toFixed(2) + '</h3><p>Caisse nette (USD)</p></div></div>' +
        '</div>' +

        // Enregistrer un retrait/commission
        '<div class="card" style="background:#f8f9fa;margin-bottom:16px;">' +
        '<h4><i class="fas fa-minus-circle" style="color:#dc3545;"></i> Enregistrer un retrait / commission</h4>' +
        '<div class="add-form-grid" style="margin-top:12px;">' +
        '<div><label class="form-label">Agent *</label>' +
        '<select id="wd-agent" class="form-control">' +
        '<option value="">Sélectionner...</option>' +
        (byAgent.length ? byAgent.map(function(a) {
            var totalAgent = parseFloat(a.total);
            var wdAgent    = withdrawals.filter(function(w) { return w.agent_username === a.payment_agent; })
                                        .reduce(function(s,w) { return s+parseFloat(w.amount); }, 0);
            return '<option value="' + a.payment_agent + '" data-total="' + totalAgent + '" data-wd="' + wdAgent + '">' +
                   a.payment_agent + ' — Encaissé: ' + totalAgent.toLocaleString('fr-FR') + ' HTG' +
                   ' | Déjà retiré: ' + wdAgent.toLocaleString('fr-FR') + ' HTG' +
                   ' | Disponible: ' + (totalAgent - wdAgent).toLocaleString('fr-FR') + ' HTG' +
                   '</option>';
        }).join('') : '<option disabled>Aucun agent actif aujourd\'hui</option>') +
        '</select></div>' +
        '<div><label class="form-label">Montant (HTG) *</label>' +
        '<input type="number" id="wd-amount" class="form-control" placeholder="0.00" min="0" step="0.01"></div>' +
        '<div><label class="form-label">Note</label>' +
        '<input type="text" id="wd-note" class="form-control" placeholder="Ex: Commission journalière, avance..."></div>' +
        '<div style="display:flex;align-items:flex-end;">' +
        '<button class="btn btn-danger" style="width:100%;" onclick="enregistrerRetrait()">' +
        '<i class="fas fa-minus-circle"></i> Enregistrer</button></div>' +
        '</div>' +
        '<div id="wd-agent-info" style="margin-top:10px;"></div>' +
        '</div>' +

        // Liste des retraits du jour
        '<h4 style="margin-bottom:10px;"><i class="fas fa-list"></i> Retraits du jour</h4>' +
        (withdrawals.length ?
        '<div class="table-container"><table><thead><tr><th>Agent</th><th>Montant</th><th>USD</th><th>Note</th><th>Heure</th><th>Par</th><th>Action</th></tr></thead><tbody>' +
        withdrawals.map(function(w) {
            var amt = parseFloat(w.amount);
            var rate = 130;
            return '<tr>' +
                '<td><strong>' + w.agent_name + '</strong><br><small>' + w.agent_username + '</small></td>' +
                '<td><strong>' + amt.toLocaleString('fr-FR') + ' HTG</strong></td>' +
                '<td>$' + (amt/rate).toFixed(2) + '</td>' +
                '<td>' + (w.note || '-') + '</td>' +
                '<td>' + (w.created_at ? new Date(w.created_at).toLocaleTimeString('fr-FR') : '-') + '</td>' +
                '<td>' + (w.created_by || '-') + '</td>' +
                '<td><button class="btn btn-xs btn-danger" onclick="supprimerRetrait(\'' + w.id + '\') ">' +
                '<i class="fas fa-trash"></i></button></td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="alert alert-info"><i class="fas fa-info-circle"></i> Aucun retrait enregistré aujourd\'hui.</div>') +

        // Rapport par agent
        (byAgent.length ?
        '<h4 style="margin:16px 0 10px;"><i class="fas fa-users"></i> Bilan par agent</h4>' +
        '<div class="table-container"><table><thead><tr><th>Agent</th><th>Encaissé</th><th>Retraits</th><th>Net en caisse</th></tr></thead><tbody>' +
        byAgent.map(function(a) {
            var enc  = parseFloat(a.total);
            var wd   = withdrawals.filter(function(w) { return w.agent_username === a.payment_agent; })
                                   .reduce(function(s,w) { return s+parseFloat(w.amount); }, 0);
            var net  = enc - wd;
            return '<tr>' +
                '<td><strong>' + a.payment_agent + '</strong></td>' +
                '<td>' + enc.toLocaleString('fr-FR') + ' HTG</td>' +
                '<td style="color:#dc3545;">' + wd.toLocaleString('fr-FR') + ' HTG</td>' +
                '<td><strong style="color:' + (net>=0?'#28a745':'#dc3545') + ';">' + net.toLocaleString('fr-FR') + ' HTG</strong></td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>' : '');

    // Afficher infos agent au changement
    document.getElementById('wd-agent')?.addEventListener('change', function() {
        var opt = this.options[this.selectedIndex];
        var info = document.getElementById('wd-agent-info');
        if (!opt || !opt.dataset.total) { info.innerHTML = ''; return; }
        var total = parseFloat(opt.dataset.total);
        var wd    = parseFloat(opt.dataset.wd);
        var dispo = total - wd;
        info.innerHTML = '<div class="alert alert-info" style="font-size:.85rem;">' +
            '<i class="fas fa-info-circle"></i> ' +
            'Encaissé: <strong>' + total.toLocaleString('fr-FR') + ' HTG</strong> | ' +
            'Déjà retiré: <strong>' + wd.toLocaleString('fr-FR') + ' HTG</strong> | ' +
            'Disponible: <strong style="color:#155724;">' + dispo.toLocaleString('fr-FR') + ' HTG</strong>' +
            '</div>';
        document.getElementById('wd-amount').max = dispo;
    });
}

async function enregistrerRetrait() {
    var agentSel = document.getElementById('wd-agent');
    var agent    = agentSel.value;
    var agentName = agentSel.options[agentSel.selectedIndex]?.text?.split(' —')[0] || agent;
    var amount   = parseFloat(document.getElementById('wd-amount').value);
    var note     = document.getElementById('wd-note').value.trim();

    if (!agent) { toast('Sélectionner un agent', 'error'); return; }
    if (isNaN(amount) || amount <= 0) { toast('Montant invalide', 'error'); return; }

    // Vérifier disponible
    var opt   = agentSel.options[agentSel.selectedIndex];
    var total = parseFloat(opt.dataset.total || 0);
    var wd    = parseFloat(opt.dataset.wd    || 0);
    var dispo = total - wd;
    if (amount > dispo) {
        toast('Montant supérieur au disponible (' + dispo.toLocaleString('fr-FR') + ' HTG)', 'error');
        return;
    }

    try {
        await apiCall(function() {
            return API.addCashWithdrawal({
                agentUsername: agent,
                agentName:     agentName,
                amount:        amount,
                note:          note,
                date:          new Date().toISOString().split('T')[0]
            });
        });
        toast(agentName + ' — ' + amount.toLocaleString('fr-FR') + ' HTG retiré avec succès !', 'success');
        document.getElementById('wd-amount').value = '';
        document.getElementById('wd-note').value   = '';
        // Rafraîchir
        updateAdminStats();
    } catch(e) {}
}

async function supprimerRetrait(id) {
    if (!confirm('Supprimer ce retrait ?')) return;
    try {
        await apiCall(function() { return API.deleteCashWithdrawal(id); });
        toast('Retrait supprimé', 'warning');
        updateAdminStats();
    } catch(e) {}
}

async function updateAdminStats() {
    try {
        const stats = await apiCall(() => API.getStats());
        const isUSD = state.reportCurrency === 'USD';
        const rate  = state.exchangeRate;

        function fmtAmt(htg) {
            if (isUSD) return '$' + htgToUsd(htg);
            return parseFloat(htg).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' HTG';
        }

        // Cartes de stats principales
        const grid = document.getElementById('admin-stats-grid');
        if (grid) {
            grid.innerHTML =
                // Revenus totaux
                '<div class="admin-stat-card">' +
                '<h3><i class="fas fa-money-bill-wave"></i> Revenus Totaux</h3>' +
                '<h2>' + fmtAmt(stats.totalRevenue) + '</h2>' +
                '<p style="color:#2e7d32;font-weight:600;">≡ ' + (isUSD ? parseFloat(stats.totalRevenue).toLocaleString('fr-FR') + ' HTG' : '$' + htgToUsd(stats.totalRevenue) + ' USD') + '</p>' +
                '<div class="chart-bar-container mt-2"><div class="chart-bar-label"><span>Aujourd\'hui</span><strong>' + fmtAmt(stats.todayRevenue) + '</strong></div></div>' +
                '<div class="chart-bar-container"><div class="chart-bar-label"><span>Cette semaine</span><strong>' + fmtAmt(stats.weekRevenue) + '</strong></div></div>' +
                '</div>' +
                // Services non payés
                '<div class="admin-stat-card">' +
                '<h3><i class="fas fa-exclamation-triangle"></i> Non payés</h3>' +
                '<h2 style="color:#dc3545;">' + stats.unpaidCount + '</h2><p>services en attente</p>' +
                '</div>' +
                // Patients
                '<div class="admin-stat-card">' +
                '<h3><i class="fas fa-users"></i> Patients</h3>' +
                '<h2>' + stats.totalPatients + '</h2>' +
                '<p>' + stats.todayPatients + ' aujourd\'hui</p>' +
                '</div>' +
                // Alertes stock
                '<div class="admin-stat-card">' +
                '<h3><i class="fas fa-pills"></i> Alertes Stock</h3>' +
                '<h2 style="color:#dc3545;">' + stats.lowStock.length + '</h2>' +
                '<p>médicaments en rupture/alerte</p>' +
                (stats.lowStock.slice(0,3).map(m => '<small class="badge badge-danger" style="margin:2px;">' + m.name + ' (' + m.quantity + ')</small>').join('')) +
                '</div>';
        }

        // Rapports par poste (par agent)
        const byAgent = stats.byAgent || [];
        const byType  = stats.byType  || [];

        // Mettre à jour le tableau des transactions
        updateRecentTransactionsTable(stats.recentTransactions);

        // Mettre à jour section rapports par poste
        let agentSection = document.getElementById('admin-by-agent-section');
        if (!agentSection) {
            agentSection = document.createElement('div');
            agentSection.id = 'admin-by-agent-section';
            agentSection.className = 'card mt-3';
            const txCard = document.getElementById('recent-transactions-list');
            if (txCard && txCard.closest('.card')) {
                txCard.closest('.card').insertAdjacentElement('beforebegin', agentSection);
            }
        }
        agentSection.innerHTML =
            '<h3><i class="fas fa-chart-bar"></i> Rapports par Poste / Agent</h3>' +
            '<div class="admin-stats-grid" style="margin-top:14px;">' +
            (byAgent.length ? byAgent.map(a =>
                '<div class="admin-stat-card">' +
                '<h4>' + a.payment_agent + '</h4>' +
                '<strong>' + fmtAmt(a.total) + '</strong>' +
                '<p>' + a.count + ' transaction(s)</p>' +
                '</div>'
            ).join('') : '<p class="text-muted">Aucune donnée d\'agent disponible</p>') +
            '</div>' +
            '<h3 class="mt-3"><i class="fas fa-chart-pie"></i> Rapports par Type de Service</h3>' +
            '<div class="admin-stats-grid" style="margin-top:14px;">' +
            (byType.length ? byType.map(t => {
                const icons = { consultation:'fa-stethoscope', lab:'fa-flask', medication:'fa-pills', external:'fa-external-link-alt' };
                const colors = { consultation:'#1a6bca', lab:'#ffc107', medication:'#28a745', external:'#6f42c1' };
                return '<div class="admin-stat-card">' +
                    '<h4><i class="fas ' + (icons[t.type]||'fa-tag') + '" style="color:' + (colors[t.type]||'#6c757d') + ';"></i> ' + t.type + '</h4>' +
                    '<strong>' + fmtAmt(t.total) + '</strong>' +
                    '<p>' + t.count + ' transaction(s)</p>' +
                    '</div>';
            }).join('') : '<p class="text-muted">Aucune donnée</p>') +
            '</div>';

        // Section comptes multiples (try séparé pour ne pas bloquer les stats)
        try { await renderAccountsDashboard(stats); } catch(eAcc) { console.warn('Comptes:', eAcc.message); }
        // Section gestion de caisse
        try { await renderCashManagement(stats); } catch(eCash) { console.warn('Caisse:', eCash.message); }

        // Mettre à jour les anciens éléments si présents
        const revEl = document.getElementById('admin-total-revenue');
        if (revEl) revEl.textContent = fmtAmt(stats.totalRevenue);
        const pPct = stats.recentTransactions.length ? Math.round(stats.recentTransactions.filter(t=>t.status==='paid').length / stats.recentTransactions.length * 100) : 0;
        const ppEl = document.getElementById('paid-percentage');   if (ppEl) ppEl.textContent = pPct + '%';
        const pbEl = document.getElementById('paid-chart-bar');    if (pbEl) pbEl.style.width = pPct + '%';
        const upEl = document.getElementById('unpaid-percentage'); if (upEl) upEl.textContent = (100-pPct) + '%';
        const ubEl = document.getElementById('unpaid-chart-bar');  if (ubEl) ubEl.style.width = (100-pPct) + '%';

    } catch(e) { console.error('Admin stats error:', e); toast('Erreur chargement stats', 'error'); }
}

// ─── ADMIN: Modifier / Supprimer transaction ─────────────────
async function adminEditTransaction(txId) {
    const txs = await API.getTransactions({}).catch(()=>[]);
    const t = txs.find(x => x.id === txId);
    if (!t) return;
    const modal = document.createElement('div');
    modal.className = 'transaction-details-modal';
    modal.id = 'admin-edit-tx-modal';
    modal.innerHTML = `
        <div class="transaction-details-content" style="max-width:520px;">
            <h4><i class="fas fa-edit" style="color:var(--warning);"></i> Modifier la transaction <span class="badge badge-primary">${t.id}</span></h4>
            <div class="add-form-grid mt-3" style="margin-top:14px;">
                <div><label class="form-label">Service</label>
                    <input type="text" id="edit-tx-service" class="form-control" value="${t.service}"></div>
                <div><label class="form-label">Montant (HTG)</label>
                    <input type="number" id="edit-tx-amount" class="form-control" value="${t.amount}" min="0"></div>
                <div><label class="form-label">Statut</label>
                    <select id="edit-tx-status" class="form-control">
                        <option value="unpaid" ${t.status==='unpaid'?'selected':''}>Non payé</option>
                        <option value="paid" ${t.status==='paid'?'selected':''}>Payé</option>
                    </select></div>
                <div><label class="form-label">Méthode paiement</label>
                    <select id="edit-tx-method" class="form-control">
                        <option value="">—</option>
                        <option value="cash" ${t.payment_method==='cash'?'selected':''}>Espèces</option>
                        <option value="moncash" ${t.payment_method==='moncash'?'selected':''}>MonCash</option>
                        <option value="natcash" ${t.payment_method==='natcash'?'selected':''}>NatCash</option>
                        <option value="card" ${t.payment_method==='card'?'selected':''}>Carte</option>
                    </select></div>
            </div>
            <div class="d-flex gap-10 mt-3">
                <button class="btn btn-success" onclick="saveAdminTxEdit('${t.id}')"><i class="fas fa-save"></i> Enregistrer</button>
                <button class="btn btn-danger" onclick="deleteAdminTx('${t.id}')"><i class="fas fa-trash"></i> Supprimer</button>
                <button class="btn btn-secondary" onclick="document.getElementById(\'admin-edit-tx-modal\').remove()">Annuler</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

async function saveAdminTxEdit(txId) {
    const service = document.getElementById('edit-tx-service').value;
    const amount  = parseFloat(document.getElementById('edit-tx-amount').value);
    const status  = document.getElementById('edit-tx-status').value;
    const method  = document.getElementById('edit-tx-method').value;
    try {
        await apiCall(() => API.updateTransaction(txId, { service, amount, status, paymentMethod: method }));
        toast('Transaction modifiée!');
        document.getElementById('admin-edit-tx-modal').remove();
        updateAdminStats();
    } catch(e) {}
}

async function deleteAdminTx(txId) {
    if (!confirm(`Supprimer définitivement la transaction ${txId} ?`)) return;
    try {
        await apiCall(() => API.deleteTransaction(txId));
        toast('Transaction supprimée', 'warning');
        document.getElementById('admin-edit-tx-modal').remove();
        updateAdminStats();
    } catch(e) {}
}

function updateRecentTransactionsTable(txs) {
    document.getElementById('recent-transactions-list').innerHTML = txs.map(t => {
        const amtHTG = parseFloat(t.amount);
        return `<tr>
            <td>${t.date} ${t.time||''}</td>
            <td>${t.patient_name}<br><small class="text-muted">${t.patient_id}</small></td>
            <td>${t.service}</td>
            <td>${amtHTG.toLocaleString('fr-FR', {minimumFractionDigits:2})} HTG</td>
            <td class="text-muted">$${htgToUsd(amtHTG)}</td>
            <td>${t.payment_method||'-'}</td>
            <td>${t.created_by||'-'}</td>
            <td><span class="${t.status==='paid'?'status-paid':'status-unpaid'}">${t.status==='paid'?'Payé':'Non payé'}</span></td>
        <td><button class="btn btn-xs btn-warning" onclick="adminEditTransaction('${t.id}')"><i class="fas fa-edit"></i></button></td>
        </tr>`;
    }).join('');
}

function setupAdminSearch() {
    document.getElementById('search-admin-patient')?.addEventListener('click', searchAdminPatient);
}

async function searchAdminPatient() {
    const search = document.getElementById('admin-patient-search').value.trim();
    if (!search) return;
    try {
        const patients = await apiCall(() => API.getPatients({ search }));
        const container = document.getElementById('admin-patient-result');
        if (!patients.length) {
            container.innerHTML = '<div class="alert alert-danger">Patient non trouvé</div>';
            container.classList.remove('hidden');
            return;
        }
        const p = patients[0];
        // Charger le parcours complet
        const [txs, vitals, consultations] = await Promise.all([
            API.getTransactions({ patientId: p.id }).catch(() => []),
            API.getVitals(p.id).catch(() => []),
            API.getConsultations(p.id).catch(() => []),
        ]);
        const totalPaye   = txs.filter(t => t.status === 'paid').reduce((s, t) => s + parseFloat(t.amount), 0);
        const totalImpaye = txs.filter(t => t.status === 'unpaid').reduce((s, t) => s + parseFloat(t.amount), 0);

        let txRows = txs.map(t => {
            const amt = parseFloat(t.amount);
            return '<tr>' +
                '<td>' + (t.date||'-') + '</td>' +
                '<td>' + t.service + '</td>' +
                '<td>' + amt.toFixed(2) + ' HTG <small class="text-muted">$' + htgToUsd(amt) + '</small></td>' +
                '<td><span class="' + (t.status==='paid'?'status-paid':'status-unpaid') + '">' + (t.status==='paid'?'Payé':'Non payé') + '</span></td>' +
                '<td>' + (t.payment_method||'-') + '</td>' +
                '<td>' +
                  '<button class="btn btn-xs btn-warning" onclick="adminEditTransaction(\'' + t.id + '\')"><i class="fas fa-edit"></i></button> ' +
                  '<button class="btn btn-xs btn-danger" onclick="adminDeleteTxDirect(\'' + t.id + '\')" style="margin-left:4px;"><i class="fas fa-trash"></i></button>' +
                '</td>' +
            '</tr>';
        }).join('');

        let vitalRows = '';
        if (vitals.length > 0) {
            const last = vitals[0];
            vitalRows = Object.entries(last.values || {}).map(function(entry) {
                return '<span class="badge badge-primary" style="margin:2px;">' + entry[0] + ': ' + entry[1].value + ' ' + entry[1].unit + '</span>';
            }).join('');
        }

        let consultRows = consultations.map(c =>
            '<div class="card mb-2" style="padding:10px;">' +
            '<strong>' + (c.date||'-') + '</strong> — Dr. ' + (c.doctor||'-') + '<br>' +
            '<span style="font-size:.85rem;white-space:pre-wrap;">' + (c.diagnosis||'-') + '</span>' +
            '</div>'
        ).join('');

        container.innerHTML =
            '<div class="card">' +
            '<div class="d-flex justify-between align-center" style="flex-wrap:wrap;gap:10px;">' +
            '<div>' +
            '<h3>' + p.full_name + ' <small class="text-muted">#' + p.id + '</small></h3>' +
            '<p>Tél: ' + (p.phone||'-') + ' | Naissance: ' + formatDate(p.birth_date) + ' | Type: ' + p.type + '</p>' +
            (p.vip ? '<span class="vip-tag">VIP</span>' : p.sponsored ? '<span class="badge badge-primary">Sponsorisé ' + p.discount_percentage + '%</span>' : '') +
            '</div>' +
            '<div class="d-flex gap-10">' +
            '<div style="text-align:center;background:#d4edda;padding:10px 18px;border-radius:8px;">' +
            '<strong style="color:#155724;">' + totalPaye.toFixed(2) + ' HTG</strong><br><small>Payé</small></div>' +
            '<div style="text-align:center;background:#f8d7da;padding:10px 18px;border-radius:8px;">' +
            '<strong style="color:#721c24;">' + totalImpaye.toFixed(2) + ' HTG</strong><br><small>Non payé</small></div>' +
            '</div></div>' +

            // Modifier infos patient
            '<div class="card mt-3" style="background:#f8f9fa;">' +
            '<h4><i class="fas fa-user-edit"></i> Modifier les informations</h4>' +
            '<div class="add-form-grid" style="margin-top:10px;">' +
            '<div><label class="form-label">Nom complet</label><input type="text" id="edit-p-name" class="form-control" value="' + p.full_name + '"></div>' +
            '<div><label class="form-label">Téléphone</label><input type="text" id="edit-p-phone" class="form-control" value="' + (p.phone||'') + '"></div>' +
            '<div><label class="form-label">Adresse</label><input type="text" id="edit-p-address" class="form-control" value="' + (p.address||'') + '"></div>' +
            '<div><label class="form-label">Privilège</label>' +
            '<select id="privilege-type" class="form-control">' +
            '<option value="">Aucun</option>' +
            '<option value="vip"' + (p.vip?' selected':'') + '>VIP (gratuit)</option>' +
            '<option value="sponsored"' + (p.sponsored?' selected':'') + '>Sponsorisé</option>' +
            '</select></div>' +
            '<div><label class="form-label">Réduction %</label><input type="number" id="discount-percentage" class="form-control" value="' + (p.discount_percentage||0) + '" min="0" max="100"></div>' +
            '<div style="display:flex;align-items:flex-end;">' +
            '<button class="btn btn-success" style="width:100%;" onclick="saveAdminPatientEdit(\'' + p.id + '\')"><i class="fas fa-save"></i> Enregistrer</button>' +
            '</div></div></div>' +

            // Transactions
            '<div class="mt-3"><h4><i class="fas fa-receipt"></i> Transactions (' + txs.length + ')</h4>' +
            '<div class="table-container"><table><thead><tr><th>Date</th><th>Service</th><th>Montant</th><th>Statut</th><th>Méthode</th><th>Actions</th></tr></thead>' +
            '<tbody>' + (txRows || '<tr><td colspan="6">Aucune transaction</td></tr>') + '</tbody></table></div></div>' +

            // Signes vitaux
            '<div class="mt-3"><h4><i class="fas fa-heartbeat"></i> Derniers signes vitaux</h4>' +
            (vitalRows ? '<div>' + vitalRows + '</div>' : '<p class="text-muted">Aucun signe vital.</p>') + '</div>' +

            // Consultations
            '<div class="mt-3"><h4><i class="fas fa-stethoscope"></i> Consultations</h4>' +
            (consultRows || '<p class="text-muted">Aucune consultation.</p>') + '</div>' +

            '</div>';
        container.classList.remove('hidden');
    } catch(e) { console.error(e); toast('Erreur lors de la recherche', 'error'); }
}

// Créer / modifier compte patient (accès espace patient)
function openPatientAccountModal(patientId, patientName) {
    var old = document.getElementById('patient-acc-modal');
    if (old) old.remove();
    var modal = document.createElement('div');
    modal.id = 'patient-acc-modal';
    modal.className = 'transaction-details-modal';
    modal.innerHTML =
        '<div class="transaction-details-content" style="max-width:420px;">' +
        '<h4><i class="fas fa-key" style="color:#28a745;"></i> Compte Espace Patient</h4>' +
        '<p class="text-muted" style="margin-bottom:16px;">Patient: <strong>' + patientName + '</strong> — ID: <strong>' + patientId + '</strong></p>' +
        '<div class="alert alert-info" style="margin-bottom:14px;">' +
        '<i class="fas fa-info-circle"></i> Le patient utilisera son ID (<strong>' + patientId + '</strong>) comme identifiant de connexion sur la page patient.' +
        '</div>' +
        '<div class="form-group"><label class="form-label">Nouveau mot de passe</label>' +
        '<input type="password" id="pat-acc-pwd" class="form-control" placeholder="Minimum 6 caractères"></div>' +
        '<div class="form-group"><label class="form-label">Confirmer le mot de passe</label>' +
        '<input type="password" id="pat-acc-pwd2" class="form-control" placeholder="Répéter le mot de passe"></div>' +
        '<div class="d-flex gap-10 mt-3">' +
        '<button class="btn btn-success" onclick="savePatientAccount(\'' + patientId + '\') ">' +
        '<i class="fas fa-save"></i> Créer / Mettre à jour</button>' +
        '<button class="btn btn-danger" onclick="revokePatientAccount(\'' + patientId + '\',\'' + patientName + '\')"><i class="fas fa-ban"></i> Révoquer accès</button>' +
        '<i class="fas fa-ban"></i> Révoquer accès</button>' +
        '<button class="btn btn-secondary" onclick="document.getElementById(\'patient-acc-modal\').remove()">Annuler</button>' +
        '</div></div>';
    document.body.appendChild(modal);
    document.getElementById('pat-acc-pwd').focus();
}

async function savePatientAccount(patientId) {
    var pwd  = document.getElementById('pat-acc-pwd').value;
    var pwd2 = document.getElementById('pat-acc-pwd2').value;
    if (!pwd || pwd.length < 6)  { toast('Mot de passe trop court (min 6 caractères)', 'error'); return; }
    if (pwd !== pwd2) { toast('Les mots de passe ne correspondent pas', 'error'); return; }
    try {
        await apiCall(function() { return API.createPatientAccount(patientId, pwd); });
        toast('Compte patient créé/mis à jour !', 'success');
        document.getElementById('patient-acc-modal').remove();
        addLocalNotification('👤 Compte patient créé',
            'Accès espace patient activé pour ' + patientId, 'fas fa-user-circle', '#28a745');
    } catch(e) {}
}

async function revokePatientAccount(patientId, patientName) {
    if (!confirm('Révoquer l\'accès espace patient de ' + patientName + ' ?')) return;
    try {
        await apiCall(function() { return API.deletePatientAccount(patientId); });
        toast('Accès patient révoqué', 'warning');
        document.getElementById('patient-acc-modal').remove();
    } catch(e) {}
}

// Modifier infos patient depuis admin
async function saveAdminPatientEdit(patientId) {
    const name    = document.getElementById('edit-p-name').value.trim();
    const phone   = document.getElementById('edit-p-phone').value.trim();
    const address = document.getElementById('edit-p-address').value.trim();
    const priv    = document.getElementById('privilege-type').value;
    const disc    = parseInt(document.getElementById('discount-percentage').value) || 0;
    try {
        // On update les privilèges via API existante
        await apiCall(() => API.updatePrivilege(patientId, { privilegeType: priv, discountPercentage: disc }));
        toast('Patient mis à jour!', 'success');
        searchAdminPatient();
    } catch(e) {}
}

// Supprimer transaction directement depuis le parcours patient
async function adminDeleteTxDirect(txId) {
    if (!confirm('Supprimer cette transaction?')) return;
    try {
        await apiCall(() => API.deleteTransaction(txId));
        toast('Transaction supprimée', 'warning');
        searchAdminPatient();
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

// ─── FOURNISSEURS ────────────────────────────────────────────
var _currentSupplierId   = null;
var _currentSupplierName = null;

function toggleSupplierForm() {
    var f = document.getElementById('supplier-add-form');
    f.style.display = f.style.display === 'none' ? 'grid' : 'none';
}

async function loadSuppliers() {
    try {
        var suppliers = await apiCall(function() { return API.getSuppliers(); });
        var list = document.getElementById('suppliers-list');
        if (!suppliers.length) {
            list.innerHTML = '<div class="alert alert-info"><i class="fas fa-info-circle"></i> Aucun fournisseur enregistré.</div>';
            return;
        }
        list.innerHTML = '<div class="table-container"><table><thead><tr>' +
            '<th>Nom</th><th>Téléphone</th><th>Email</th><th>Dette totale</th><th>Actions</th>' +
            '</tr></thead><tbody>' +
            suppliers.map(function(s) {
                var debt = parseFloat(s.total_debt || 0);
                return '<tr>' +
                    '<td><strong>' + s.name + '</strong>' + (s.note ? '<br><small class="text-muted">' + s.note + '</small>' : '') + '</td>' +
                    '<td>' + (s.phone || '-') + '</td>' +
                    '<td>' + (s.email || '-') + '</td>' +
                    '<td><strong style="color:' + (debt > 0 ? '#dc3545' : '#28a745') + ';">' +
                        debt.toLocaleString('fr-FR') + ' HTG</strong>' +
                        (debt > 0 ? ' <span class="badge badge-danger">Dû</span>' : ' <span class="badge badge-success">OK</span>') +
                    '</td>' +
                    '<td><div class="d-flex gap-10">' +
                        '<button class="btn btn-sm btn-primary" data-sid="' + s.id + '" data-sname="' + s.name + '" onclick="openSupplierDetail(this.dataset.sid,this.dataset.sname)"><i class="fas fa-eye"></i> Détails</button>' +
                        '<i class="fas fa-eye"></i> Détails</button>' +
                        '<button class="btn btn-sm btn-warning" data-sid="' + s.id + '" onclick="editSupplier(this.dataset.sid)"><i class="fas fa-edit"></i></button>' +
                        '<i class="fas fa-edit"></i></button>' +
                        '<button class="btn btn-sm btn-danger" data-sid="' + s.id + '" data-sname="' + s.name + '" onclick="deleteSupplierFn(this.dataset.sid,this.dataset.sname)"><i class="fas fa-trash"></i></button>' +
                        '<i class="fas fa-trash"></i></button>' +
                    '</div></td>' +
                '</tr>';
            }).join('') + '</tbody></table></div>';
    } catch(e) {}
}

async function saveNewSupplier() {
    var name    = document.getElementById('sup-name').value.trim();
    var phone   = document.getElementById('sup-phone').value.trim();
    var email   = document.getElementById('sup-email').value.trim();
    var address = document.getElementById('sup-address').value.trim();
    var note    = document.getElementById('sup-note').value.trim();
    if (!name) { toast('Le nom est obligatoire', 'error'); return; }
    try {
        await apiCall(function() { return API.addSupplier({ name, phone, email, address, note }); });
        toast('Fournisseur ajouté !', 'success');
        toggleSupplierForm();
        ['sup-name','sup-phone','sup-email','sup-address','sup-note'].forEach(function(id) {
            var el = document.getElementById(id); if (el) el.value = '';
        });
        loadSuppliers();
    } catch(e) {}
}

async function deleteSupplierFn(id, name) {
    if (!confirm('Supprimer le fournisseur ' + name + ' ?')) return;
    try {
        await apiCall(function() { return API.deleteSupplier(id); });
        toast('Fournisseur supprimé', 'warning');
        loadSuppliers();
    } catch(e) {}
}

async function editSupplier(id) {
    var suppliers = await API.getSuppliers().catch(function() { return []; });
    var s = suppliers.find(function(x) { return x.id === id; });
    if (!s) return;
    var modal = document.createElement('div');
    modal.id = 'edit-supplier-modal';
    modal.className = 'transaction-details-modal';
    modal.innerHTML =
        '<div class="transaction-details-content" style="max-width:480px;">' +
        '<h4><i class="fas fa-edit" style="color:var(--warning);"></i> Modifier le fournisseur</h4>' +
        '<div class="add-form-grid" style="margin-top:14px;">' +
        '<div><label class="form-label">Nom *</label><input type="text" id="es-name" class="form-control" value="' + s.name + '"></div>' +
        '<div><label class="form-label">Téléphone</label><input type="text" id="es-phone" class="form-control" value="' + (s.phone||'') + '"></div>' +
        '<div><label class="form-label">Email</label><input type="email" id="es-email" class="form-control" value="' + (s.email||'') + '"></div>' +
        '<div><label class="form-label">Adresse</label><input type="text" id="es-address" class="form-control" value="' + (s.address||'') + '"></div>' +
        '<div style="grid-column:1/-1"><label class="form-label">Note</label><input type="text" id="es-note" class="form-control" value="' + (s.note||'') + '"></div>' +
        '</div>' +
        '<div class="d-flex gap-10 mt-3">' +
        '<button class="btn btn-success" data-sid="' + id + '" onclick="saveEditSupplier(this.dataset.sid)"><i class="fas fa-save"></i> Enregistrer</button>' +
        '<i class="fas fa-save"></i> Enregistrer</button>' +
        '<button class="btn btn-secondary" onclick="document.getElementById(\'edit-supplier-modal\').remove()">Annuler</button>' +
        '</div></div>';
    document.body.appendChild(modal);
}

async function saveEditSupplier(id) {
    var name    = document.getElementById('es-name').value.trim();
    var phone   = document.getElementById('es-phone').value.trim();
    var email   = document.getElementById('es-email').value.trim();
    var address = document.getElementById('es-address').value.trim();
    var note    = document.getElementById('es-note').value.trim();
    if (!name) { toast('Le nom est obligatoire', 'error'); return; }
    try {
        await apiCall(function() { return API.updateSupplier(id, { name, phone, email, address, note }); });
        toast('Fournisseur modifié !', 'success');
        document.getElementById('edit-supplier-modal').remove();
        loadSuppliers();
        if (_currentSupplierId === id) {
            _currentSupplierName = name;
            document.getElementById('selected-supplier-name').textContent = name;
        }
    } catch(e) {}
}

async function openSupplierDetail(id, name) {
    _currentSupplierId   = id;
    _currentSupplierName = name;
    document.getElementById('supplier-detail-card').style.display  = 'block';
    document.getElementById('selected-supplier-name').textContent   = name;
    document.getElementById('suppliers-list').closest('.card').style.display = 'none';
    // Reset form
    ['pur-desc','pur-total','pur-paid','pur-note','pur-qty'].forEach(function(i) {
        var el = document.getElementById(i); if (el) el.value = '';
    });
    document.getElementById('purchase-balance-preview').innerHTML = '';
    document.getElementById('pur-stock-info').textContent = '';
    // Charger les médicaments dans le select
    await loadMedicationsForPurchase();
    await loadSupplierPurchases();
}

async function loadMedicationsForPurchase() {
    var sel = document.getElementById('pur-medication');
    if (!sel) return;
    var meds = state.medications.length ? state.medications : await API.getMedications().catch(function(){return [];});
    sel.innerHTML = '<option value="">Aucun / Autre article</option>' +
        meds.map(function(m) {
            return '<option value="' + m.id + '" data-stock="' + m.quantity + '" data-unit="' + (m.unit||'unités') + '">' +
                m.name + ' (' + m.form + ') — Stock: ' + m.quantity + ' ' + (m.unit||'') + '</option>';
        }).join('');
}

function onMedicationSelect() {
    var sel = document.getElementById('pur-medication');
    var opt = sel.options[sel.selectedIndex];
    var info = document.getElementById('pur-stock-info');
    if (!opt || !opt.dataset.stock) { info.textContent = ''; return; }
    info.innerHTML = '<i class="fas fa-boxes" style="color:#1a6bca;"></i> Stock actuel: <strong>' +
        opt.dataset.stock + ' ' + (opt.dataset.unit||'unités') + '</strong>' +
        ' → après réception: <strong id="stock-after">?</strong>';
    document.getElementById('pur-qty').addEventListener('input', function() {
        var qty = parseInt(this.value) || 0;
        var current = parseInt(opt.dataset.stock) || 0;
        var afterEl = document.getElementById('stock-after');
        if (afterEl) afterEl.textContent = (current + qty) + ' ' + (opt.dataset.unit||'unités');
    });
}

function closeSupplierDetail() {
    _currentSupplierId = null;
    document.getElementById('supplier-detail-card').style.display  = 'none';
    document.getElementById('suppliers-list').closest('.card').style.display = 'block';
    loadSuppliers();
}

function updatePurchaseBalance() {
    var total = parseFloat(document.getElementById('pur-total').value) || 0;
    var paid  = parseFloat(document.getElementById('pur-paid').value)  || 0;
    var due   = total - paid;
    var preview = document.getElementById('purchase-balance-preview');
    if (!total) { preview.innerHTML = ''; return; }
    // Auto-set payment type
    var typeEl = document.getElementById('pur-type');
    if (paid === 0)    typeEl.value = 'credit';
    else if (paid >= total) { typeEl.value = 'cash'; }
    else               typeEl.value = 'partial';

    preview.innerHTML = '<div class="d-flex gap-15 flex-wrap mt-2">' +
        '<span class="badge badge-primary">Total: ' + total.toLocaleString('fr-FR') + ' HTG</span>' +
        '<span class="badge badge-success">Payé: ' + paid.toLocaleString('fr-FR') + ' HTG</span>' +
        '<span class="badge ' + (due > 0 ? 'badge-danger' : 'badge-success') + '">' +
        'Restant: ' + Math.max(0, due).toLocaleString('fr-FR') + ' HTG</span>' +
        '</div>';
}

async function savePurchase() {
    var desc   = document.getElementById('pur-desc').value.trim();
    var total  = parseFloat(document.getElementById('pur-total').value);
    var paid   = parseFloat(document.getElementById('pur-paid').value) || 0;
    var type   = document.getElementById('pur-type').value;
    var note   = document.getElementById('pur-note').value.trim();
    var medSel = document.getElementById('pur-medication');
    var medId  = medSel ? medSel.value : '';
    var qty    = parseInt(document.getElementById('pur-qty').value) || 0;
    var medName = medSel && medId ? medSel.options[medSel.selectedIndex].text.split(' (')[0] : '';

    if (!desc || isNaN(total) || total <= 0) { toast('Description et montant obligatoires', 'error'); return; }
    if (paid > total) { toast('Le montant payé ne peut pas dépasser le total', 'error'); return; }
    if (medId && qty <= 0) { toast('Entrer la quantité reçue', 'error'); return; }

    // Auto-compléter la description si médicament sélectionné
    if (medId && medName && !desc.includes(medName)) {
        var descEl = document.getElementById('pur-desc');
        if (!descEl.value.trim()) descEl.value = medName + (qty ? ' x ' + qty : '');
        desc = descEl.value.trim();
    }

    try {
        await apiCall(function() {
            return API.addSupplierPurchase({
                supplierId:        _currentSupplierId,
                description:       desc,
                totalAmount:       total,
                amountPaid:        paid,
                paymentType:       type,
                note:              note,
                medicationId:      medId || null,
                quantityReceived:  qty   || null,
            });
        });
        var due = total - paid;
        var stockMsg = medId && qty ? ' | Stock +' + qty + ' unités' : '';
        toast('Achat enregistré — ' + (due > 0 ? 'Dette: ' + due.toLocaleString('fr-FR') + ' HTG' : 'Payé intégralement') + stockMsg, 'success');
        ['pur-desc','pur-total','pur-paid','pur-note','pur-qty'].forEach(function(i) {
            var el = document.getElementById(i); if (el) el.value = '';
        });
        if (medSel) medSel.value = '';
        document.getElementById('purchase-balance-preview').innerHTML = '';
        document.getElementById('pur-stock-info').textContent = '';
        // Rafraîchir les médicaments en mémoire
        state.medications = await API.getMedications().catch(function(){return state.medications;});
        await loadSupplierPurchases();
        updateDebtSummary();
    } catch(e) {}
}

async function updateDebtSummary() {
    var suppliers = await API.getSuppliers().catch(function() { return []; });
    var s = suppliers.find(function(x) { return x.id === _currentSupplierId; });
    if (!s) return;
    var debt = parseFloat(s.total_debt || 0);
    document.getElementById('supplier-debt-summary').innerHTML =
        '<div class="d-flex gap-15 flex-wrap">' +
        '<div style="background:' + (debt>0?'#f8d7da':'#d4edda') + ';padding:14px 20px;border-radius:10px;text-align:center;">' +
        '<strong style="font-size:1.2rem;color:' + (debt>0?'#721c24':'#155724') + ';">' + debt.toLocaleString('fr-FR') + ' HTG</strong>' +
        '<br><small>Dette totale actuelle</small></div>' +
        '<div style="background:#d1ecf1;padding:14px 20px;border-radius:10px;text-align:center;">' +
        '<strong style="font-size:1.2rem;color:#0c5460;">$' + (debt/state.exchangeRate).toFixed(2) + '</strong>' +
        '<br><small>Équivalent USD</small></div>' +
        '</div>';
}

async function loadSupplierPurchases() {
    await updateDebtSummary();
    try {
        var purchases = await apiCall(function() {
            return API.getSupplierPurchases({ supplierId: _currentSupplierId });
        });
        var container = document.getElementById('supplier-purchases-list');
        if (!purchases.length) {
            container.innerHTML = '<div class="alert alert-info"><i class="fas fa-info-circle"></i> Aucun achat enregistré pour ce fournisseur.</div>';
            return;
        }
        container.innerHTML = purchases.map(function(p) {
            var total = parseFloat(p.total_amount);
            var paid  = parseFloat(p.amount_paid);
            var due   = parseFloat(p.amount_due);
            var isPaid = due <= 0;
            var statusColor = isPaid ? '#28a745' : p.payment_type === 'credit' ? '#dc3545' : '#856404';
            var statusLabel = isPaid ? 'Soldé' : p.payment_type === 'credit' ? 'À crédit' : 'Partiel';
            return '<div class="card mb-2" style="border-left-color:' + statusColor + ';">' +
                '<div class="d-flex justify-between align-center flex-wrap gap-10">' +
                '<div>' +
                '<h5 style="margin-bottom:4px;">' + p.description + '</h5>' +
                '<small class="text-muted">' + (p.date||'-') + (p.note ? ' — ' + p.note : '') + '</small>' +
                '</div>' +
                '<span class="badge" style="background:' + statusColor + ';color:#fff;font-size:.8rem;">' + statusLabel + '</span>' +
                '</div>' +
                (p.medication_id ?
                '<div class="alert alert-info mt-2" style="padding:8px 12px;font-size:.82rem;">' +
                '<i class="fas fa-pills"></i> Médicament: <strong>' +
                (function() {
                    var med = state.medications.find(function(m) { return m.id === p.medication_id; });
                    return med ? med.name : p.medication_id;
                })() +
                (p.quantity_received ? ' — Qté reçue: <strong>+' + p.quantity_received + '</strong>' : '') +
                '</div>' : '') +
                '<div class="d-flex gap-15 flex-wrap mt-2">' +
                '<span>Total: <strong>' + total.toLocaleString('fr-FR') + ' HTG</strong></span>' +
                '<span>Payé: <strong style="color:#28a745;">' + paid.toLocaleString('fr-FR') + ' HTG</strong></span>' +
                (due > 0 ? '<span>Restant: <strong style="color:#dc3545;">' + due.toLocaleString('fr-FR') + ' HTG</strong></span>' : '') +
                '</div>' +
                (due > 0 ?
                '<div class="d-flex gap-10 mt-2 align-center flex-wrap">' +
                '<input type="number" class="form-control" id="pay-' + p.id + '" placeholder="Montant à payer (HTG)" min="0" max="' + due + '" style="width:200px;font-size:.88rem;">' +
                '<input type="text" class="form-control" id="paynote-' + p.id + '" placeholder="Note paiement" style="width:180px;font-size:.88rem;">' +
                '<button class="btn btn-success btn-sm" data-pid="' + p.id + '" onclick="paySupplierDebt(this.dataset.pid)"><i class="fas fa-money-bill-wave"></i> Payer</button>' +
                '<i class="fas fa-money-bill-wave"></i> Payer</button>' +
                '</div>' : '') +
                '<div class="mt-2">' +
                '<button class="btn btn-xs btn-danger" data-pid="' + p.id + '" onclick="deleteSupplierPurchaseFn(this.dataset.pid)"><i class="fas fa-trash"></i> Supprimer</button>' +
                '<i class="fas fa-trash"></i> Supprimer</button>' +
                '</div></div>';
        }).join('');
    } catch(e) {}
}

async function paySupplierDebt(purchaseId) {
    var amountEl = document.getElementById('pay-' + purchaseId);
    var noteEl   = document.getElementById('paynote-' + purchaseId);
    var amount   = parseFloat(amountEl.value);
    var note     = noteEl ? noteEl.value.trim() : '';
    if (isNaN(amount) || amount <= 0) { toast('Entrer un montant valide', 'error'); return; }
    try {
        var result = await apiCall(function() {
            return API.addSupplierPayment({
                purchaseId:  purchaseId,
                supplierId:  _currentSupplierId,
                amount:      amount,
                note:        note,
            });
        });
        var remaining = parseFloat(result.remainingDue || 0);
        toast('Paiement enregistré ! ' + (remaining > 0 ?
            'Reste: ' + remaining.toLocaleString('fr-FR') + ' HTG' : 'Dette soldée !'), 'success');
        await loadSupplierPurchases();
    } catch(e) {}
}

async function deleteSupplierPurchaseFn(id) {
    if (!confirm('Supprimer cet achat ?')) return;
    try {
        await apiCall(function() { return API.deleteSupplierPurchase(id); });
        toast('Achat supprimé', 'warning');
        await loadSupplierPurchases();
    } catch(e) {}
}

// ─── COMPTES PATIENTS (Paramètres) ───────────────────────────
var _pacCurrentPatient = null;

function togglePacPwd() {
    var i = document.getElementById('pac-pwd');
    var e = document.getElementById('pac-eye');
    if (!i) return;
    if (i.type === 'password') { i.type = 'text'; e.className = 'fas fa-eye-slash'; }
    else { i.type = 'password'; e.className = 'fas fa-eye'; }
}

async function searchPatientForAccount() {
    var search = document.getElementById('pac-search').value.trim();
    if (!search) { toast('Entrer un ID ou nom de patient', 'error'); return; }
    try {
        var patients = await apiCall(function() { return API.getPatients({ search: search }); });
        if (!patients.length) { toast('Patient non trouvé', 'error'); return; }
        var p = patients[0];
        _pacCurrentPatient = p;
        document.getElementById('pac-patient-info').innerHTML =
            '<div class="d-flex align-center gap-15 mb-2">' +
            '<div class="stat-icon" style="background:#17a2b8;width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;">' +
            '<i class="fas fa-user"></i></div>' +
            '<div>' +
            '<strong style="font-size:1rem;">' + p.full_name + '</strong>' +
            '<br><span class="badge badge-primary">' + p.id + '</span>' +
            ' <span class="text-muted" style="font-size:.82rem;">Tél: ' + (p.phone||'-') + '</span>' +
            '</div></div>' +
            '<div class="alert alert-info" style="font-size:.82rem;margin-bottom:0;">' +
            '<i class="fas fa-info-circle"></i> Le patient se connectera avec l\'ID <strong>' + p.id + '</strong> et ce mot de passe sur <strong>/patient.html</strong>' +
            '</div>';
        document.getElementById('pac-result').style.display = 'block';
        document.getElementById('pac-pwd').value  = '';
        document.getElementById('pac-pwd2').value = '';
        document.getElementById('pac-pwd').focus();
    } catch(e) {}
}

async function createPatientAccountFromSettings() {
    if (!_pacCurrentPatient) { toast('Chercher un patient d\'abord', 'error'); return; }
    var pwd  = document.getElementById('pac-pwd').value;
    var pwd2 = document.getElementById('pac-pwd2').value;
    if (!pwd || pwd.length < 4) { toast('Mot de passe trop court (min 4 caractères)', 'error'); return; }
    if (pwd !== pwd2) { toast('Les mots de passe ne correspondent pas', 'error'); return; }
    try {
        await apiCall(function() { return API.createPatientAccount(_pacCurrentPatient.id, pwd); });
        toast('Compte créé pour ' + _pacCurrentPatient.full_name + ' ! ID: ' + _pacCurrentPatient.id, 'success');
        document.getElementById('pac-pwd').value  = '';
        document.getElementById('pac-pwd2').value = '';
        // Rafraîchir la liste si visible
        if (document.getElementById('pac-all-patients-list').children.length > 1) {
            loadAllPatientsAccounts();
        }
    } catch(e) {}
}

async function revokePatientAccountFromSettings() {
    if (!_pacCurrentPatient) return;
    if (!confirm('Révoquer l\'accès de ' + _pacCurrentPatient.full_name + ' ?')) return;
    try {
        await apiCall(function() { return API.deletePatientAccount(_pacCurrentPatient.id); });
        toast('Accès révoqué pour ' + _pacCurrentPatient.full_name, 'warning');
        document.getElementById('pac-result').style.display = 'none';
        _pacCurrentPatient = null;
        document.getElementById('pac-search').value = '';
        if (document.getElementById('pac-all-patients-list').children.length > 1) {
            loadAllPatientsAccounts();
        }
    } catch(e) {}
}

async function loadAllPatientsAccounts() {
    var container = document.getElementById('pac-all-patients-list');
    container.innerHTML = '<div style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin fa-2x" style="color:var(--primary);"></i></div>';
    try {
        var patients = await API.getPatients({}).catch(function() { return []; });
        var accounts = await API.getUsers().catch(function() { return []; }); // pour référence future

        if (!patients.length) {
            container.innerHTML = '<p class="text-muted">Aucun patient enregistré.</p>';
            return;
        }

        container.innerHTML =
            '<div class="table-container"><table><thead><tr>' +
            '<th>ID</th><th>Nom</th><th>Téléphone</th><th>Type</th><th>Action</th>' +
            '</tr></thead><tbody>' +
            patients.map(function(p) {
                return '<tr>' +
                    '<td><strong>' + p.id + '</strong></td>' +
                    '<td>' + p.full_name + '</td>' +
                    '<td>' + (p.phone||'-') + '</td>' +
                    '<td>' + p.type + (p.vip?' <span class="vip-tag">VIP</span>':'') + '</td>' +
                    '<td>' +
                    '<button class="btn btn-sm btn-info" data-pid="' + p.id + '" data-pname="' + p.full_name + '" ' +
                    'onclick="quickSetPassword(this.dataset.pid, this.dataset.pname)">' +
                    '<i class="fas fa-key"></i> Définir MDP</button>' +
                    '</td></tr>';
            }).join('') +
            '</tbody></table></div>' +
            '<p class="text-muted mt-2" style="font-size:.8rem;"><i class="fas fa-info-circle"></i> ' +
            patients.length + ' patient(s) au total. Cliquez "Définir MDP" pour créer ou modifier le mot de passe.</p>';
    } catch(e) {
        container.innerHTML = '<div class="alert alert-danger">Erreur chargement</div>';
    }
}

function quickSetPassword(patientId, patientName) {
    // Remplir le formulaire de recherche avec ce patient
    document.getElementById('pac-search').value = patientId;
    _pacCurrentPatient = { id: patientId, full_name: patientName };
    document.getElementById('pac-patient-info').innerHTML =
        '<div class="d-flex align-center gap-15 mb-2">' +
        '<div class="stat-icon" style="background:#17a2b8;width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;">' +
        '<i class="fas fa-user"></i></div>' +
        '<div><strong style="font-size:1rem;">' + patientName + '</strong>' +
        '<br><span class="badge badge-primary">' + patientId + '</span></div></div>' +
        '<div class="alert alert-info" style="font-size:.82rem;margin-bottom:0;">' +
        '<i class="fas fa-info-circle"></i> ID de connexion: <strong>' + patientId + '</strong>' +
        '</div>';
    document.getElementById('pac-result').style.display = 'block';
    document.getElementById('pac-pwd').value  = '';
    document.getElementById('pac-pwd2').value = '';
    // Scroll vers le formulaire
    document.getElementById('pac-result').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('pac-pwd').focus();
}

// ─── PARAMÈTRES ──────────────────────────────────────────────
async function updateSettingsDisplay() {
    // Types de consultation
    document.getElementById('consultation-types-list').innerHTML =
        '<div class="table-container"><table><thead><tr><th>Nom</th><th>Prix (Gdes)</th><th>Description</th><th>Actif</th><th>Actions</th></tr></thead><tbody>' +
        state.consultationTypes.map(function(ct) {
            return '<tr>' +
                '<td><strong>' + ct.name + '</strong></td>' +
                '<td>' + ct.price + ' HTG</td>' +
                '<td>' + (ct.description||'-') + '</td>' +
                '<td><input type="checkbox" ' + (ct.active?'checked':'') + ' onchange="toggleConsultationType(' + ct.id + ',this.checked)" style="width:18px;height:18px;accent-color:var(--primary);"></td>' +
                '<td><div class="d-flex gap-10">' +
                    '<button class="btn btn-sm btn-warning" onclick=\"openEditModal(\'consultation_type\',' + ct.id + ')" title="Modifier"><i class="fas fa-edit"></i></button>' +
                    '<button class="btn btn-sm btn-danger" onclick="deleteConsultationType(' + ct.id + ')" title="Supprimer"><i class="fas fa-trash"></i></button>' +
                '</div></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';

    // Types signes vitaux
    document.getElementById('vitals-types-list').innerHTML =
        '<div class="table-container"><table><thead><tr><th>Nom</th><th>Unité</th><th>Min</th><th>Max</th><th>Actif</th><th>Actions</th></tr></thead><tbody>' +
        state.vitalTypes.map(function(v) {
            return '<tr>' +
                '<td>' + v.name + '</td><td>' + v.unit + '</td><td>' + v.min + '</td><td>' + v.max + '</td>' +
                '<td><input type="checkbox" ' + (v.active?'checked':'') + ' onchange="toggleVitalType(' + v.id + ',this.checked)" style="width:18px;height:18px;accent-color:var(--primary);"></td>' +
                '<td><div class="d-flex gap-10">' +
                    '<button class="btn btn-sm btn-warning" onclick=\"openEditModal(\'vital_type\',' + v.id + ')" title="Modifier"><i class="fas fa-edit"></i></button>' +
                    '<button class="btn btn-sm btn-danger" onclick="deleteVitalType(' + v.id + ')" title="Supprimer"><i class="fas fa-trash"></i></button>' +
                '</div></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';

    // Types analyses labo
    document.getElementById('lab-analyses-types-list').innerHTML =
        '<div class="table-container"><table><thead><tr><th>Nom</th><th>Prix</th><th>Type</th><th>Actif</th><th>Actions</th></tr></thead><tbody>' +
        state.labAnalysisTypes.map(function(a) {
            return '<tr>' +
                '<td>' + a.name + '</td>' +
                '<td>' + a.price + ' HTG</td>' +
                '<td><span class="result-type-badge ' + (a.result_type==='image'?'result-type-image':'result-type-text') + '">' + (a.result_type==='image'?'Image':'Texte') + '</span></td>' +
                '<td><input type="checkbox" ' + (a.active?'checked':'') + ' onchange="toggleLabAnalysisType(' + a.id + ',this.checked)" style="width:18px;height:18px;accent-color:var(--primary);"></td>' +
                '<td><div class="d-flex gap-10">' +
                    '<button class="btn btn-sm btn-warning" onclick=\"openEditModal(\'lab_analysis_type\',' + a.id + ')" title="Modifier"><i class="fas fa-edit"></i></button>' +
                    '<button class="btn btn-sm btn-danger" onclick="deleteLabAnalysisType(' + a.id + ')" title="Supprimer"><i class="fas fa-trash"></i></button>' +
                '</div></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';

    // Services externes
    document.getElementById('external-services-types-list').innerHTML =
        '<div class="table-container"><table><thead><tr><th>Nom</th><th>Prix (Gdes)</th><th>Actif</th><th>Actions</th></tr></thead><tbody>' +
        state.externalServiceTypes.map(function(s) {
            return '<tr>' +
                '<td>' + s.name + '</td>' +
                '<td>' + s.price + ' Gdes</td>' +
                '<td><input type="checkbox" ' + (s.active?'checked':'') + ' onchange="toggleExternalServiceType(' + s.id + ',this.checked)" style="width:18px;height:18px;accent-color:var(--primary);"></td>' +
                '<td><div class="d-flex gap-10">' +
                    '<button class="btn btn-sm btn-warning" onclick=\"openEditModal(\'external_service_type\',' + s.id + ')" title="Modifier"><i class="fas fa-edit"></i></button>' +
                    '<button class="btn btn-sm btn-danger" onclick="deleteExternalServiceType(' + s.id + ')" title="Supprimer"><i class="fas fa-trash"></i></button>' +
                '</div></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';
}

// ─── MODAL MODIFICATION UNIVERSELLE ──────────────────────────
function openEditModal(type, id) {
    var item, fields, title, saveFn;
    if (type === 'consultation_type') {
        item  = state.consultationTypes.find(function(c) { return c.id === id; });
        title = 'Modifier le type de consultation';
        fields = [
            { id:'em-ct-name',  label:'Nom',          value: item.name,             type:'text'   },
            { id:'em-ct-price', label:'Prix (Gdes)',   value: item.price,            type:'number' },
            { id:'em-ct-desc',  label:'Description',   value: item.description||'',  type:'text'   },
        ];
        saveFn = 'saveEditConsultationType(' + id + ')';
    } else if (type === 'vital_type') {
        item  = state.vitalTypes.find(function(v) { return v.id === id; });
        title = 'Modifier le signe vital';
        fields = [
            { id:'em-vt-name', label:'Nom',   value: item.name, type:'text'   },
            { id:'em-vt-unit', label:'Unité', value: item.unit, type:'text'   },
            { id:'em-vt-min',  label:'Min',   value: item.min,  type:'number' },
            { id:'em-vt-max',  label:'Max',   value: item.max,  type:'number' },
        ];
        saveFn = 'saveEditVitalType(' + id + ')';
    } else if (type === 'lab_analysis_type') {
        item  = state.labAnalysisTypes.find(function(a) { return a.id === id; });
        title = "Modifier l\'analyse";
        fields = [
            { id:'em-la-name',  label:'Nom',          value: item.name,        type:'text'   },
            { id:'em-la-price', label:'Prix (Gdes)',   value: item.price,       type:'number' },
        ];
        saveFn = 'saveEditLabAnalysisType(' + id + ')';
    } else if (type === 'external_service_type') {
        item  = state.externalServiceTypes.find(function(s) { return s.id === id; });
        title = 'Modifier le service externe';
        fields = [
            { id:'em-es-name',  label:'Nom',         value: item.name,  type:'text'   },
            { id:'em-es-price', label:'Prix (Gdes)',  value: item.price, type:'number' },
        ];
        saveFn = 'saveEditExternalServiceType(' + id + ')';
    } else if (type === 'medication') {
        item  = state.medications.find(function(m) { return m.id === id; });
        title = 'Modifier le médicament';
        fields = [
            { id:'em-med-name',    label:'Nom',          value: item.name,            type:'text'   },
            { id:'em-med-price',   label:'Prix (Gdes)',   value: item.price,           type:'number' },
            { id:'em-med-qty',     label:'Quantité',      value: item.quantity,        type:'number' },
            { id:'em-med-alert',   label:'Seuil alerte',  value: item.alert_threshold, type:'number' },
            { id:'em-med-espace',  label:'Espace',        value: item.espace||'',      type:'text'   },
            { id:'em-med-etagere', label:'Étagère',       value: item.etagere||'',     type:'text'   },
        ];
        saveFn = "saveEditMedication(\'" + id + "\')";
    }
    if (!item) return;

    var existing = document.getElementById('universal-edit-modal');
    if (existing) existing.remove();

    var fieldsHTML = fields.map(function(f) {
        return '<div><label class="form-label">' + f.label + '</label>' +
               '<input type="' + f.type + '" id="' + f.id + '" class="form-control" value="' + f.value + '"></div>';
    }).join('');

    var modal = document.createElement('div');
    modal.id = 'universal-edit-modal';
    modal.className = 'transaction-details-modal';
    modal.innerHTML =
        '<div class="transaction-details-content" style="max-width:500px;">' +
        '<h4><i class="fas fa-edit" style="color:var(--warning);"></i> ' + title + '</h4>' +
        '<div class="add-form-grid" style="margin-top:16px;">' + fieldsHTML + '</div>' +
        '<div class="d-flex gap-10 mt-3">' +
        '<button class="btn btn-success" onclick="' + saveFn + '"><i class="fas fa-save"></i> Enregistrer</button>' +
        '<button class="btn btn-secondary" onclick="document.getElementById(\'universal-edit-modal\').remove()">Annuler</button>' +
        '</div></div>';
    document.body.appendChild(modal);
}

async function saveEditConsultationType(id) {
    var name  = document.getElementById('em-ct-name').value.trim();
    var price = parseFloat(document.getElementById('em-ct-price').value);
    var desc  = document.getElementById('em-ct-desc').value;
    if (!name || isNaN(price)) { toast('Remplir tous les champs', 'error'); return; }
    var ct = state.consultationTypes.find(function(c) { return c.id === id; });
    try {
        await apiCall(function() { return API.updateConsultationType(id, { name:name, price:price, description:desc, active:ct.active }); });
        Object.assign(ct, { name:name, price:price, description:desc });
        document.getElementById('universal-edit-modal').remove();
        updateSettingsDisplay(); updateConsultationTypesSelect();
        toast('Type de consultation modifié!');
    } catch(e) {}
}

async function saveEditVitalType(id) {
    var name = document.getElementById('em-vt-name').value.trim();
    var unit = document.getElementById('em-vt-unit').value.trim();
    var min  = parseFloat(document.getElementById('em-vt-min').value);
    var max  = parseFloat(document.getElementById('em-vt-max').value);
    if (!name || !unit) { toast('Remplir tous les champs', 'error'); return; }
    var vt = state.vitalTypes.find(function(v) { return v.id === id; });
    try {
        await apiCall(function() { return API.updateVitalType(id, { name:name, unit:unit, min:min, max:max, active:vt.active }); });
        Object.assign(vt, { name:name, unit:unit, min:min, max:max });
        document.getElementById('universal-edit-modal').remove();
        updateSettingsDisplay(); updateVitalsInputs();
        toast('Signe vital modifié!');
    } catch(e) {}
}

async function saveEditLabAnalysisType(id) {
    var name  = document.getElementById('em-la-name').value.trim();
    var price = parseFloat(document.getElementById('em-la-price').value);
    var at    = state.labAnalysisTypes.find(function(a) { return a.id === id; });
    try {
        await apiCall(function() { return API.updateLabAnalysisType(id, { name:name, price:price, active:at.active }); });
        Object.assign(at, { name:name, price:price });
        document.getElementById('universal-edit-modal').remove();
        updateSettingsDisplay(); updateLabAnalysesSelect();
        toast('Analyse modifiée!');
    } catch(e) {}
}

async function saveEditExternalServiceType(id) {
    var name  = document.getElementById('em-es-name').value.trim();
    var price = parseFloat(document.getElementById('em-es-price').value);
    var st    = state.externalServiceTypes.find(function(s) { return s.id === id; });
    try {
        await apiCall(function() { return API.updateExternalServiceType(id, { name:name, price:price, active:st.active }); });
        Object.assign(st, { name:name, price:price });
        document.getElementById('universal-edit-modal').remove();
        updateSettingsDisplay(); updateExternalServicesOptions(); updateExternalServicesSelect();
        toast('Service modifié!');
    } catch(e) {}
}

async function saveEditMedication(id) {
    var name    = document.getElementById('em-med-name').value.trim();
    var price   = parseFloat(document.getElementById('em-med-price').value);
    var qty     = parseInt(document.getElementById('em-med-qty').value);
    var alert   = parseInt(document.getElementById('em-med-alert').value);
    var espace  = document.getElementById('em-med-espace').value;
    var etagere = document.getElementById('em-med-etagere').value;
    try {
        await apiCall(function() { return API.updateMedication(id, { name:name, price:price, quantity:qty, alertThreshold:alert, espace:espace, etagere:etagere }); });
        var med = state.medications.find(function(m) { return m.id === id; });
        if (med) Object.assign(med, { name:name, price:price, quantity:qty, alert_threshold:alert, espace:espace, etagere:etagere });
        document.getElementById('universal-edit-modal').remove();
        updateMedicationsSettingsList(); updateMedicationStockDisplay();
        toast('Médicament modifié!');
    } catch(e) {}
}

async function updateMedicationsSettingsList() {
    var meds = await API.getMedications().catch(function() { return []; });
    state.medications = meds;
    document.getElementById('medications-settings-list').innerHTML = meds.map(function(m) {
        return '<tr class="' + (m.quantity === 0 ? 'out-of-stock' : m.quantity <= m.alert_threshold ? 'low-stock' : '') + '">' +
            '<td><strong>' + m.name + '</strong>' + (m.generic_name && m.generic_name !== m.name ? '<br><small class="text-muted">' + m.generic_name + '</small>' : '') + '</td>' +
            '<td>' + (m.form||'-') + '</td>' +
            '<td>' + m.price + ' HTG</td>' +
            '<td>' + m.quantity + '</td>' +
            '<td>' + m.alert_threshold + '</td>' +
            '<td>' + (m.espace ? '<span class="badge badge-primary">' + m.espace + '</span>' : '-') + '</td>' +
            '<td>' + (m.etagere ? '<span class="badge" style="background:#e8e0ff;color:#6f42c1;">' + m.etagere + '</span>' : '-') + '</td>' +
            '<td><div class="d-flex gap-10">' +
                '<button class="btn btn-sm btn-warning" onclick="openEditModal(\'medication\',\'' + m.id + '\')" title="Modifier"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-danger" onclick="deleteMedicationSettings(\'' + m.id + '\') " title="Supprimer"><i class="fas fa-trash"></i></button>' +
            '</div></td>' +
        '</tr>';
    }).join('');

    if (state.currentRole === 'admin' || (state.currentRole === 'sub_admin' && state.subAdminPermissions.users)) {
        var users = await API.getUsers().catch(function() { return []; });
        document.getElementById('users-list').innerHTML = users.map(function(u) {
            var extraRolesLabel = u.extra_roles
                ? u.extra_roles.split(',').map(function(r) {
                    return '<span class="badge badge-info" style="margin:1px;font-size:.7rem;">' + getRoleLabel(r.trim()) + '</span>';
                  }).join('')
                : '';
            return '<tr>' +
                '<td><strong>' + u.name + '</strong></td>' +
                '<td><span class="badge badge-primary">' + getRoleLabel(u.role) + '</span>' + extraRolesLabel + '</td>' +
                '<td><code>' + u.username + '</code></td>' +
                '<td>' + (u.active
                    ? '<span class="badge badge-success"><i class="fas fa-check"></i> Actif</span>'
                    : '<span class="badge badge-danger"><i class="fas fa-times"></i> Inactif</span>') + '</td>' +
                '<td><div class="d-flex gap-10">' +
                    '<button class="btn btn-sm btn-warning" onclick="openEditUserModal(\'' + u.id + '\' )" title="Modifier"><i class="fas fa-edit"></i></button>' +
                    '<button class="btn btn-sm ' + (u.active ? 'btn-secondary' : 'btn-success') + '" onclick="toggleUser(\'' + u.id + '\' ,' + !u.active + ',\'' + u.name + '\' )" title="' + (u.active ? 'Désactiver' : 'Activer') + '"><i class="fas fa-' + (u.active ? 'ban' : 'check') + '"></i></button>' +
                    '<button class="btn btn-sm btn-danger" onclick="deleteUser(\'' + u.id + '\' ,\'' + u.name + '\' )" title="Supprimer"><i class="fas fa-trash"></i></button>' +
                '</div></td>' +
            '</tr>';
        }).join('');
    }
}

// Fonctions paramètres CRUD
async function saveConsultationType(id) {
    const price = parseFloat(document.getElementById(`ct-price-${id}`).value);
    const desc  = document.getElementById(`ct-desc-${id}`).value;
    const ct    = state.consultationTypes.find(c=>c.id===id);
    await apiCall(() => API.updateConsultationType(id, { name:ct.name, price, description:desc, active:ct.active }));
    Object.assign(ct, { price, description:desc });
    updateConsultationTypesSelect();
    toast('Type de consultation sauvegardé');
}
async function toggleConsultationType(id, active) {
    const ct = state.consultationTypes.find(c=>c.id===id);
    await apiCall(() => API.updateConsultationType(id, { ...ct, active }));
    ct.active = active;
    updateConsultationTypesSelect();
}
async function deleteConsultationType(id) {
    if (!confirm('Supprimer ce type?')) return;
    await apiCall(() => API.deleteConsultationType(id));
    state.consultationTypes = state.consultationTypes.filter(c=>c.id!==id);
    updateSettingsDisplay(); updateConsultationTypesSelect();
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
    updateSettingsDisplay(); updateVitalsInputs();
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
// ─── MODIFIER UTILISATEUR ────────────────────────────────────
function openEditUserModal(userId) {
    // Chercher l\'utilisateur dans le DOM (on recharge depuis l\'API)
    API.getUsers().then(function(users) {
        var u = users.find(function(x) { return String(x.id) === String(userId); });
        if (!u) { toast('Utilisateur introuvable', 'error'); return; }

        var existing = document.getElementById('edit-user-modal');
        if (existing) existing.remove();

        var extraChecks = ['secretary','cashier','nurse','doctor','lab','pharmacy'].map(function(r) {
            var checked = u.extra_roles && u.extra_roles.split(',').map(function(s){return s.trim();}).includes(r) ? 'checked' : '';
            return '<div class="permission-item"><input type="checkbox" id="eu-mr-'+r+'" value="'+r+'" '+checked+'>' +
                   '<label for="eu-mr-'+r+'">'+getRoleLabel(r)+'</label></div>';
        }).join('');

        var modal = document.createElement('div');
        modal.id = 'edit-user-modal';
        modal.className = 'transaction-details-modal';
        modal.innerHTML =
            '<div class="transaction-details-content" style="max-width:520px;">' +
            '<h4><i class="fas fa-user-edit" style="color:var(--warning);"></i> Modifier l\'utilisateur</h4>' +
            '<div class="add-form-grid" style="margin-top:16px;">' +
                '<div><label class="form-label">Nom complet *</label>' +
                '<input type="text" id="eu-name" class="form-control" value="' + u.name + '"></div>' +
                '<div><label class="form-label">Identifiant *</label>' +
                '<input type="text" id="eu-username" class="form-control" value="' + u.username + '"></div>' +
                '<div><label class="form-label">Rôle *</label>' +
                '<select id="eu-role" class="form-control" onchange="document.getElementById(\'eu-multi-section\').style.display=this.value===\'multi\'?\'block\':\'none\'">' +
                    '<option value="sub_admin"' + (u.role==='sub_admin'?' selected':'') + '>Sous-Administrateur</option>' +
                    '<option value="secretary"' + (u.role==='secretary'?' selected':'') + '>Secrétariat</option>' +
                    '<option value="cashier"'   + (u.role==='cashier'  ?' selected':'') + '>Caisse</option>' +
                    '<option value="nurse"'     + (u.role==='nurse'    ?' selected':'') + '>Infirmier</option>' +
                    '<option value="doctor"'    + (u.role==='doctor'   ?' selected':'') + '>Médecin</option>' +
                    '<option value="lab"'       + (u.role==='lab'      ?' selected':'') + '>Laboratoire</option>' +
                    '<option value="pharmacy"'  + (u.role==='pharmacy' ?' selected':'') + '>Pharmacie</option>' +
                    '<option value="multi"'     + (u.role==='multi'    ?' selected':'') + '>Multi-Rôle</option>' +
                '</select></div>' +
                '<div><label class="form-label">Statut</label>' +
                '<select id="eu-active" class="form-control">' +
                    '<option value="true"'  + (u.active ?' selected':'') + '>Actif</option>' +
                    '<option value="false"' + (!u.active?' selected':'') + '>Inactif</option>' +
                '</select></div>' +
            '</div>' +
            '<div id="eu-multi-section" style="display:' + (u.role==='multi'?'block':'none') + ';margin-top:12px;">' +
                '<label class="form-label"><i class="fas fa-layer-group" style="color:#6f42c1;"></i> Rôles combinés</label>' +
                '<div class="permissions-grid" style="margin-top:8px;">' + extraChecks + '</div>' +
            '</div>' +
            '<hr style="margin:16px 0;border-color:var(--border);">' +
            '<h5 style="margin-bottom:10px;color:var(--text);"><i class="fas fa-key" style="color:#ffc107;"></i> Changer le mot de passe <small style="color:var(--muted);font-weight:400;">(laisser vide = pas de changement)</small></h5>' +
            '<div class="add-form-grid">' +
                '<div><label class="form-label">Nouveau mot de passe</label>' +
                '<input type="password" id="eu-pwd" class="form-control" placeholder="Laisser vide si inchang&#233;"></div>' +
                '<div><label class="form-label">Confirmer</label>' +
                '<input type="password" id="eu-pwd2" class="form-control" placeholder="Répéter le mot de passe"></div>' +
            '</div>' +
            '<div class="d-flex gap-10 mt-3">' +
                '<button class="btn btn-success" onclick="saveEditUser(\'' + userId + '\') "><i class="fas fa-save"></i> Enregistrer</button>' +
                '<button class="btn btn-secondary" onclick="document.getElementById(\'edit-user-modal\').remove()">Annuler</button>' +
            '</div></div>';
        document.body.appendChild(modal);
    }).catch(function() { toast('Erreur chargement utilisateur', 'error'); });
}

async function saveEditUser(userId) {
    var name     = document.getElementById('eu-name').value.trim();
    var username = document.getElementById('eu-username').value.trim();
    var role     = document.getElementById('eu-role').value;
    var active   = document.getElementById('eu-active').value === 'true';
    var pwd      = document.getElementById('eu-pwd').value;
    var pwd2     = document.getElementById('eu-pwd2').value;

    if (!name || !username || !role) { toast('Remplir les champs obligatoires', 'error'); return; }
    if (pwd && pwd !== pwd2) { toast('Les mots de passe ne correspondent pas', 'error'); return; }
    if (pwd && pwd.length < 4) { toast('Mot de passe trop court', 'error'); return; }

    var extraRoles = [];
    if (role === 'multi') {
        document.querySelectorAll('#eu-multi-section input[type=checkbox]:checked').forEach(function(cb) {
            extraRoles.push(cb.value);
        });
        if (extraRoles.length < 2) { toast('Sélectionner au moins 2 rôles', 'error'); return; }
    }

    var data = { name: name, username: username, role: role, active: active, extraRoles: extraRoles };
    if (pwd) data.password = pwd;

    try {
        await apiCall(function() { return API.updateUser(userId, data); });
        toast('Utilisateur modifié avec succès !', 'success');
        document.getElementById('edit-user-modal').remove();
        updateMedicationsSettingsList();
    } catch(e) {}
}

async function toggleUser(id, active, name) {
    await apiCall(function() { return API.updateUser(id, { name: name, active: active }); });
    toast('Utilisateur ' + (active ? 'activé' : 'désactivé'));
    updateMedicationsSettingsList();
}

async function deleteUser(id, name) {
    if (!confirm('Supprimer définitivement l\'utilisateur "' + name + '" ?\nCette action est irréversible.')) return;
    try {
        await apiCall(function() { return API.deleteUser(id); });
        toast('Utilisateur "' + name + '" supprimé', 'warning');
        updateMedicationsSettingsList();
    } catch(e) {}
}

function openEditUserModal(id) {
    // Récupérer les infos actuelles depuis le DOM
    API.getUsers().then(function(users) {
        var u = users.find(function(x) { return String(x.id) === String(id); });
        if (!u) { toast('Utilisateur introuvable', 'error'); return; }

        var existing = document.getElementById('edit-user-modal');
        if (existing) existing.remove();

        var rolesOptions = ['secretary','cashier','nurse','doctor','lab','pharmacy','sub_admin','multi'].map(function(r) {
            return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + getRoleLabel(r) + '</option>';
        }).join('');

        var multiRolesHtml = ['secretary','cashier','nurse','doctor','lab','pharmacy'].map(function(r) {
            var checked = u.extra_roles && u.extra_roles.includes(r) ? 'checked' : '';
            return '<div class="permission-item">' +
                '<input type="checkbox" id="eu-mr-' + r + '" value="' + r + '" ' + checked + '>' +
                '<label for="eu-mr-' + r + '">' + getRoleLabel(r) + '</label>' +
                '</div>';
        }).join('');

        var modal = document.createElement('div');
        modal.id = 'edit-user-modal';
        modal.className = 'transaction-details-modal';
        modal.innerHTML =
            '<div class="transaction-details-content" style="max-width:520px;">' +
            '<h4><i class="fas fa-user-edit" style="color:var(--warning);"></i> Modifier l\'utilisateur</h4>' +
            '<div class="add-form-grid" style="margin-top:16px;">' +
                '<div><label class="form-label">Nom complet *</label>' +
                '<input type="text" id="eu-name" class="form-control" value="' + u.name + '"></div>' +
                '<div><label class="form-label">Identifiant *</label>' +
                '<input type="text" id="eu-username" class="form-control" value="' + u.username + '"></div>' +
                '<div><label class="form-label">Rôle *</label>' +
                '<select id="eu-role" class="form-control" onchange="toggleEditUserMulti()">' +
                rolesOptions + '</select></div>' +
                '<div><label class="form-label">Statut</label>' +
                '<select id="eu-active" class="form-control">' +
                '<option value="true"' + (u.active ? ' selected' : '') + '>Actif</option>' +
                '<option value="false"' + (!u.active ? ' selected' : '') + '>Inactif</option>' +
                '</select></div>' +
            '</div>' +
            '<div id="eu-multi-container" style="display:' + (u.role === 'multi' ? 'block' : 'none') + ';margin-top:12px;">' +
            '<label class="form-label">Rôles combinés</label>' +
            '<div class="permissions-grid">' + multiRolesHtml + '</div></div>' +
            '<div class="card mt-3" style="background:#fff8e1;border-left-color:#ffc107;">' +
            '<h5 style="color:#856404;margin-bottom:10px;"><i class="fas fa-key"></i> Changer le mot de passe (optionnel)</h5>' +
            '<div class="add-form-grid">' +
                '<div><label class="form-label">Nouveau mot de passe</label>' +
                '<input type="password" id="eu-pwd" class="form-control" placeholder="Laisser vide pour ne pas changer"></div>' +
                '<div><label class="form-label">Confirmer</label>' +
                '<input type="password" id="eu-pwd2" class="form-control" placeholder="Répéter le nouveau mot de passe"></div>' +
            '</div></div>' +
            '<div class="d-flex gap-10 mt-3">' +
                '<button class="btn btn-success" onclick="saveEditUser(\'' + id + '\' )"><i class="fas fa-save"></i> Enregistrer</button>' +
                '<button class="btn btn-secondary" onclick="document.getElementById(\'edit-user-modal\').remove()">Annuler</button>' +
            '</div></div>';
        document.body.appendChild(modal);
    }).catch(function() { toast('Erreur chargement utilisateur', 'error'); });
}

function toggleEditUserMulti() {
    var role = document.getElementById('eu-role').value;
    var container = document.getElementById('eu-multi-container');
    if (container) container.style.display = role === 'multi' ? 'block' : 'none';
}

async function saveEditUser(id) {
    var name     = document.getElementById('eu-name').value.trim();
    var username = document.getElementById('eu-username').value.trim();
    var role     = document.getElementById('eu-role').value;
    var active   = document.getElementById('eu-active').value === 'true';
    var pwd      = document.getElementById('eu-pwd').value;
    var pwd2     = document.getElementById('eu-pwd2').value;

    if (!name || !username || !role) { toast('Remplir les champs obligatoires', 'error'); return; }
    if (pwd && pwd !== pwd2) { toast('Les mots de passe ne correspondent pas', 'error'); return; }
    if (pwd && pwd.length < 6) { toast('Mot de passe trop court (min 6 caractères)', 'error'); return; }

    var extraRoles = [];
    if (role === 'multi') {
        document.querySelectorAll('#eu-multi-container input[type=checkbox]:checked').forEach(function(cb) {
            extraRoles.push(cb.value);
        });
        if (extraRoles.length < 2) { toast('Sélectionner au moins 2 rôles pour un compte multi-rôle', 'error'); return; }
    }

    try {
        // Mettre à jour les infos de base
        await apiCall(function() {
            return API.updateUser(id, { name: name, active: active, username: username, role: role, extraRoles: extraRoles });
        });

        // Changer le mot de passe si fourni
        if (pwd) {
            await apiCall(function() {
                return API.updateUserPassword(id, pwd);
            });
        }

        toast('Utilisateur "' + name + '" mis à jour !', 'success');
        document.getElementById('edit-user-modal').remove();
        updateMedicationsSettingsList();
    } catch(e) {}
}

// ─── PERMISSIONS SOUS-ADMIN ──────────────────────────────────
function loadSubAdminPermissionsUI() {
    const perms = state.subAdminPermissions;
    Object.entries(perms).forEach(([key, val]) => {
        const el = document.getElementById(`perm-${key}`);
        if (el) el.checked = val;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('save-sub-admin-permissions')?.addEventListener('click', async () => {
        const perms = {};
        ['secretary','cashier','nurse','doctor','laboratory','pharmacy','messaging','administration','settings','users','exchangeRate'].forEach(key => {
            const el = document.getElementById(`perm-${key}`);
            if (el) perms[key] = el.checked;
        });
        state.subAdminPermissions = perms;
        try {
            await apiCall(() => API.saveSettings({ ...state.hospitalSettings, subAdminPermissions: perms }));
            Object.assign(state.hospitalSettings, { subAdminPermissions: perms });
            toast('Permissions sous-admin sauvegardées!', 'success');
        } catch(e) {}
    });

    // Boutons ajout dans paramètres
    document.getElementById('add-consultation-type')?.addEventListener('click', async () => {
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

    document.getElementById('add-vital-type')?.addEventListener('click', async () => {
        const name = document.getElementById('new-vital-name').value.trim();
        const unit = document.getElementById('new-vital-unit').value.trim();
        const min  = parseFloat(document.getElementById('new-vital-min').value);
        const max  = parseFloat(document.getElementById('new-vital-max').value);
        if (!name || !unit || isNaN(min) || isNaN(max)) { toast('Remplir tous les champs', 'error'); return; }
        const vt = await apiCall(() => API.addVitalType({ name, unit, min, max }));
        state.vitalTypes.push(vt);
        updateSettingsDisplay(); updateVitalsInputs();
        document.getElementById('new-vital-name').value = '';
        document.getElementById('new-vital-unit').value = '';
        document.getElementById('new-vital-min').value = '';
        document.getElementById('new-vital-max').value = '';
        toast('Signe vital ajouté!');
    });

    document.getElementById('add-lab-analysis-type')?.addEventListener('click', async () => {
        const name       = document.getElementById('new-lab-analysis-name').value.trim();
        const price      = parseFloat(document.getElementById('new-lab-analysis-price').value);
        const resultType = document.getElementById('new-lab-analysis-type').value;
        if (!name || isNaN(price)) { toast('Remplir nom et prix', 'error'); return; }
        const at = await apiCall(() => API.addLabAnalysisType({ name, price, resultType }));
        state.labAnalysisTypes.push(at);
        updateSettingsDisplay(); updateLabAnalysesSelect();
        document.getElementById('new-lab-analysis-name').value = '';
        document.getElementById('new-lab-analysis-price').value = '';
        toast('Analyse ajoutée!');
    });

    document.getElementById('add-external-service-type')?.addEventListener('click', async () => {
        const name  = document.getElementById('new-external-service-type-name').value.trim();
        const price = parseFloat(document.getElementById('new-external-service-type-price').value);
        if (!name || isNaN(price)) { toast('Remplir nom et prix', 'error'); return; }
        const st = await apiCall(() => API.addExternalServiceType({ name, price }));
        state.externalServiceTypes.push(st);
        updateSettingsDisplay(); updateExternalServicesOptions(); updateExternalServicesSelect();
        document.getElementById('new-external-service-type-name').value = '';
        document.getElementById('new-external-service-type-price').value = '';
        toast('Service externe ajouté!');
    });

    document.getElementById('add-medication-settings')?.addEventListener('click', async () => {
        var name    = document.getElementById('new-medication-name').value.trim();
        var generic = (document.getElementById('new-medication-generic')||{}).value || name;
        var form    = (document.getElementById('new-medication-form')||{}).value || 'Comprimé';
        var unit    = (document.getElementById('new-medication-unit')||{}).value || 'comprimés';
        var price   = parseFloat(document.getElementById('new-medication-price').value);
        var qty     = parseInt(document.getElementById('new-medication-quantity').value);
        var alert   = parseInt(document.getElementById('new-medication-alert').value);
        var espace  = (document.getElementById('new-medication-espace')||{}).value || '';
        var etagere = (document.getElementById('new-medication-etagere')||{}).value || '';
        if (!name || isNaN(price) || isNaN(qty) || isNaN(alert)) { toast('Remplir tous les champs obligatoires', 'error'); return; }
        try {
            var med = await apiCall(function() {
                return API.addMedication({ name:name, genericName:generic, form:form, unit:unit, quantity:qty, alertThreshold:alert, price:price, espace:espace, etagere:etagere });
            });
            state.medications.push(med);
            updateMedicationsSettingsList();
            ['new-medication-name','new-medication-generic','new-medication-price','new-medication-quantity','new-medication-alert'].forEach(function(id) {
                var el = document.getElementById(id); if (el) el.value = '';
            });
            ['new-medication-form','new-medication-espace','new-medication-etagere'].forEach(function(id) {
                var el = document.getElementById(id); if (el) el.value = '';
            });
            toast('Médicament ajouté avec succès!', 'success');
        } catch(e) {}
    });

    // Afficher/masquer sélection rôles combinés
    document.getElementById('new-user-role')?.addEventListener('change', function() {
        var container = document.getElementById('multi-roles-container');
        if (!container) return;
        container.style.display = this.value === 'multi' ? 'block' : 'none';
    });

    document.getElementById('add-user')?.addEventListener('click', async () => {
        const name     = document.getElementById('new-user-name').value.trim();
        const role     = document.getElementById('new-user-role').value;
        const username = document.getElementById('new-user-username').value.trim();
        const password = document.getElementById('new-user-password').value;
        if (!name || !role || !username || !password) { toast('Remplir tous les champs', 'error'); return; }

        // Collecter les rôles combinés si multi
        let extraRoles = [];
        if (role === 'multi') {
            document.querySelectorAll('#multi-roles-container input[type=checkbox]:checked').forEach(function(cb) {
                extraRoles.push(cb.value);
            });
            if (extraRoles.length < 2) { toast('Sélectionner au moins 2 rôles pour un compte multi-rôle', 'error'); return; }
        }

        try {
            await apiCall(() => API.addUser({ name, role, username, password, extraRoles }));
            const label = role === 'multi' ? 'Multi-Rôle (' + extraRoles.join('+') + ')' : role;
            toast('Utilisateur ' + username + ' créé — ' + label + ' !', 'success');
            updateMedicationsSettingsList();
            document.getElementById('new-user-name').value     = '';
            document.getElementById('new-user-username').value = '';
            document.getElementById('new-user-password').value = '';
            document.getElementById('new-user-role').value     = '';
            // Décocher les rôles
            document.querySelectorAll('#multi-roles-container input[type=checkbox]').forEach(function(cb) { cb.checked = false; });
            document.getElementById('multi-roles-container').style.display = 'none';
        } catch(e) {}
    });

    // Logo hôpital
    document.getElementById('hospital-logo')?.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('logo-preview').src = e.target.result;
            document.getElementById('logo-preview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('save-hospital-info-btn')?.addEventListener('click', async () => {
        const name    = document.getElementById('hospital-name').value;
        const address = document.getElementById('hospital-address').value;
        const phone   = document.getElementById('hospital-phone').value;
        const logo    = document.getElementById('logo-preview').src || null;
        try {
            await apiCall(() => API.saveSettings({ name, address, phone, logo, exchangeRate: state.exchangeRate, subAdminPermissions: state.subAdminPermissions }));
            Object.assign(state.hospitalSettings, { name, address, phone, logo });
            applyHospitalSettings();
            toast('Paramètres sauvegardés!');
        } catch(e) {}
    });

    // Fermer modal transaction
    document.getElementById('close-transaction-details')?.addEventListener('click', () => {
        document.getElementById('transaction-details-modal').classList.add('hidden');
    });

    setupPatientTypeChange();
    setupAdminSearch();
});
