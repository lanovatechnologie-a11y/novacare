// cashAccountsManager.js — Gestion des comptes de caisse dans l'administration
// Ajoute un onglet "Caisses" avec les 6 comptes, leurs soldes et l'historique des mouvements.
(function() {
    if (window.cashAccountsManagerReady) return;
    window.cashAccountsManagerReady = true;

    // ─── État local ──────────────────────────────────────────────────
    const state = {
        transactions: [],
        petiteMouvements: [],
        suppliers: [],
        exchangeRate: 130,
        filteredEntries: [],
        allEntries: [],
    };

    // ─── Utilitaires ──────────────────────────────────────────────────
    function getToken() {
        return localStorage.getItem('hopital_token') || '';
    }

    function getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        };
    }

    async function apiCall(method, path, body = null) {
        const opts = { method, headers: getHeaders() };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(window.location.origin + path, opts);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur ' + res.status);
        return data;
    }

    function toast(message, type = 'info') {
        const old = document.querySelector('.cash-toast');
        if (old) old.remove();
        const el = document.createElement('div');
        el.className = 'cash-toast';
        el.style.cssText = `
            position: fixed; bottom: 30px; right: 30px; background: #0d2b4e; color: #fff;
            padding: 14px 24px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.25);
            font-size: 0.92rem; z-index: 99999; display: flex; align-items: center; gap: 10px;
            max-width: 400px; animation: fadeInUp 0.3s ease;
        `;
        const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
        el.innerHTML = `<i class="fas ${icons[type] || icons.info}" style="color:${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'}"></i> ${message}`;
        document.body.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            setTimeout(() => el.remove(), 400);
        }, 4000);
    }

    function formatNumber(n) {
        return parseFloat(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function htgToUsd(htg) {
        return (parseFloat(htg || 0) / state.exchangeRate).toFixed(2);
    }

    function formatDate(d) {
        if (!d) return '-';
        const dt = new Date(d);
        return dt.toLocaleDateString('fr-FR') + ' ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    function getAccountLabel(account) {
        const map = {
            grande: 'Grande Caisse',
            natcash: 'NatCash',
            moncash: 'MonCash',
            petite: 'Petite Caisse',
            dette: 'Caisse Dette',
            bancaire: 'Caisse Bancaire',
        };
        return map[account] || account;
    }

    function getAccountBadge(account) {
        const colors = {
            grande: '#1a6bca',
            natcash: '#fd7e14',
            moncash: '#6f42c1',
            petite: '#17a2b8',
            dette: '#dc3545',
            bancaire: '#28a745',
        };
        return `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:0.7rem;font-weight:600;color:#fff;background:${colors[account] || '#6c7a8a'};">${getAccountLabel(account)}</span>`;
    }

    // ─── Chargement des données ──────────────────────────────────────

    async function loadExchangeRate() {
        try {
            const settings = await apiCall('GET', '/settings');
            if (settings.exchangeRate) {
                state.exchangeRate = parseFloat(settings.exchangeRate) || 130;
            }
        } catch (e) {
            console.warn('Taux de change par défaut 130');
        }
    }

    async function loadTransactions() {
        try {
            const txs = await apiCall('GET', '/transactions');
            state.transactions = txs;
            return txs;
        } catch (e) {
            toast('Erreur chargement transactions', 'error');
            return [];
        }
    }

    async function loadPetiteCaisse() {
        try {
            const stored = localStorage.getItem('petiteCaisseMouvements');
            state.petiteMouvements = stored ? JSON.parse(stored) : [];
            return state.petiteMouvements;
        } catch (e) {
            return [];
        }
    }

    async function loadSuppliers() {
        try {
            const sup = await apiCall('GET', '/suppliers');
            state.suppliers = sup;
            return sup;
        } catch (e) {
            return [];
        }
    }

    // ─── Calcul des soldes ──────────────────────────────────────────

    function computeBalances(txs, petiteMouvements, suppliers) {
        const paidTxs = txs.filter(t => t.status === 'paid');

        const grande = paidTxs.reduce((s, t) => s + parseFloat(t.amount || 0), 0);

        const natcash = paidTxs
            .filter(t => (t.payment_method || '').toLowerCase() === 'natcash')
            .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

        const moncash = paidTxs
            .filter(t => (t.payment_method || '').toLowerCase() === 'moncash')
            .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

        const bancaire = paidTxs
            .filter(t => (t.payment_method || '').toLowerCase() === 'card')
            .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

        const petite = petiteMouvements.reduce((s, m) => s + parseFloat(m.amount || 0), 0);

        const dette = suppliers.reduce((s, sup) => s + parseFloat(sup.total_debt || 0), 0);

        return { grande, natcash, moncash, petite, dette, bancaire, total: grande + petite };
    }

    // ─── Construction de l'historique ──────────────────────────────

    function buildHistory(txs, petiteMouvements, suppliers) {
        const entries = [];

        // Transactions payées
        const paidTxs = txs.filter(t => t.status === 'paid');
        for (const t of paidTxs) {
            let account = 'grande';
            const method = (t.payment_method || '').toLowerCase();
            if (method === 'natcash') account = 'natcash';
            else if (method === 'moncash') account = 'moncash';
            else if (method === 'card') account = 'bancaire';
            entries.push({
                date: t.payment_date || t.date || t.created_at,
                account,
                description: t.service || 'Transaction',
                amount: parseFloat(t.amount || 0),
                reference: t.id || '-',
                patient: t.patient_name || '',
            });
        }

        // Mouvements Petite Caisse
        for (const m of petiteMouvements) {
            entries.push({
                date: m.date || m.created_at || new Date().toISOString(),
                account: 'petite',
                description: m.note || 'Alimentation Petite Caisse',
                amount: parseFloat(m.amount || 0),
                reference: m.id || 'PT-' + Date.now(),
                patient: m.created_by || 'Admin',
            });
        }

        // Dettes fournisseurs (uniquement si > 0)
        for (const sup of suppliers) {
            const debt = parseFloat(sup.total_debt || 0);
            if (debt > 0) {
                entries.push({
                    date: sup.updated_at || sup.created_at || new Date().toISOString(),
                    account: 'dette',
                    description: 'Dette fournisseur : ' + sup.name,
                    amount: debt,
                    reference: sup.id || '-',
                    patient: sup.name,
                });
            }
        }

        entries.sort((a, b) => new Date(b.date) - new Date(a.date));
        return entries;
    }

    // ─── Rendu UI ────────────────────────────────────────────────────

    function renderBalances(balances) {
        document.getElementById('cash-balance-grande').innerHTML = formatNumber(balances.grande) + ' <small>HTG</small>';
        document.getElementById('cash-balance-natcash').innerHTML = formatNumber(balances.natcash) + ' <small>HTG</small>';
        document.getElementById('cash-balance-moncash').innerHTML = formatNumber(balances.moncash) + ' <small>HTG</small>';
        document.getElementById('cash-balance-petite').innerHTML = formatNumber(balances.petite) + ' <small>HTG</small>';
        document.getElementById('cash-balance-dette').innerHTML = formatNumber(balances.dette) + ' <small>HTG</small>';
        document.getElementById('cash-balance-bancaire').innerHTML = formatNumber(balances.bancaire) + ' <small>HTG</small>';

        document.getElementById('cash-total-all').textContent = formatNumber(balances.total) + ' HTG';

        document.getElementById('cash-sub-grande').textContent = formatNumber(balances.grande) + ' HTG encaissé';
        document.getElementById('cash-sub-natcash').textContent = formatNumber(balances.natcash) + ' HTG';
        document.getElementById('cash-sub-moncash').textContent = formatNumber(balances.moncash) + ' HTG';
        document.getElementById('cash-sub-petite').textContent = formatNumber(balances.petite) + ' HTG disponible';
        document.getElementById('cash-sub-dette').textContent = formatNumber(balances.dette) + ' HTG dû';
        document.getElementById('cash-sub-bancaire').textContent = formatNumber(balances.bancaire) + ' HTG';

        // Mettre à jour le solde dans le modal
        document.getElementById('cash-modal-grande-balance').textContent = formatNumber(balances.grande) + ' HTG';
    }

    function renderTransactions(entries, filterAccount = 'all', dateFrom = null, dateTo = null) {
        let filtered = entries;
        if (filterAccount !== 'all') {
            filtered = filtered.filter(e => e.account === filterAccount);
        }
        if (dateFrom) {
            const d = new Date(dateFrom);
            d.setHours(0, 0, 0, 0);
            filtered = filtered.filter(e => new Date(e.date) >= d);
        }
        if (dateTo) {
            const d = new Date(dateTo);
            d.setHours(23, 59, 59, 999);
            filtered = filtered.filter(e => new Date(e.date) <= d);
        }

        state.filteredEntries = filtered;

        const tbody = document.getElementById('cash-transactions-body');
        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#6c7a8a;padding:30px 0;"><i class="fas fa-inbox" style="font-size:1.2rem;display:block;margin-bottom:6px;"></i>Aucune transaction</td></tr>`;
            document.getElementById('cash-tx-count').textContent = '0 transaction(s)';
            return;
        }

        let html = '';
        for (const e of filtered) {
            const usd = htgToUsd(e.amount);
            const dateStr = formatDate(e.date);
            const badge = getAccountBadge(e.account);
            const desc = e.patient ? e.description + ' (' + e.patient + ')' : e.description;
            html += `<tr>
                <td>${dateStr}</td>
                <td>${badge}</td>
                <td>${desc}</td>
                <td><strong>${formatNumber(e.amount)}</strong></td>
                <td class="text-muted">$${usd}</td>
                <td class="text-muted" style="font-size:0.78rem;">${e.reference}</td>
            </tr>`;
        }
        tbody.innerHTML = html;
        document.getElementById('cash-tx-count').textContent = filtered.length + ' transaction(s)';
    }

    // ─── Rafraîchissement complet ──────────────────────────────────

    async function refreshData() {
        try {
            await loadExchangeRate();
            const [txs, petite, suppliers] = await Promise.all([
                loadTransactions(),
                loadPetiteCaisse(),
                loadSuppliers(),
            ]);

            const balances = computeBalances(txs, petite, suppliers);
            renderBalances(balances);

            const entries = buildHistory(txs, petite, suppliers);
            state.allEntries = entries;

            const filterAccount = document.getElementById('cash-filter-account').value;
            const dateFrom = document.getElementById('cash-filter-date-from').value;
            const dateTo = document.getElementById('cash-filter-date-to').value;
            renderTransactions(entries, filterAccount, dateFrom, dateTo);

            toast('Données actualisées', 'success');
        } catch (e) {
            console.error(e);
            toast('Erreur lors du rafraîchissement', 'error');
        }
    }

    // ─── Filtres ────────────────────────────────────────────────────

    function applyFilters() {
        const filterAccount = document.getElementById('cash-filter-account').value;
        const dateFrom = document.getElementById('cash-filter-date-from').value;
        const dateTo = document.getElementById('cash-filter-date-to').value;
        if (state.allEntries) {
            renderTransactions(state.allEntries, filterAccount, dateFrom, dateTo);
        } else {
            refreshData();
        }
    }

    function resetFilters() {
        document.getElementById('cash-filter-account').value = 'all';
        document.getElementById('cash-filter-date-from').value = '';
        document.getElementById('cash-filter-date-to').value = '';
        applyFilters();
    }

    function filterByAccount(account) {
        document.getElementById('cash-filter-account').value = account;
        applyFilters();
    }

    // ─── Modal Transfert ────────────────────────────────────────────

    function openTransferModal() {
        document.getElementById('cash-transfer-modal').classList.add('open');
        const balanceText = document.getElementById('cash-balance-grande').textContent;
        document.getElementById('cash-modal-grande-balance').textContent = balanceText;
        document.getElementById('cash-transfer-amount').value = '';
        document.getElementById('cash-transfer-note').value = '';
        document.getElementById('cash-transfer-amount').focus();
    }

    function closeTransferModal() {
        document.getElementById('cash-transfer-modal').classList.remove('open');
    }

    async function executeTransfer() {
        const amount = parseFloat(document.getElementById('cash-transfer-amount').value);
        const note = document.getElementById('cash-transfer-note').value.trim() || 'Alimentation Petite Caisse';

        if (isNaN(amount) || amount <= 0) {
            toast('Montant invalide', 'error');
            return;
        }

        const grandeBalance = parseFloat(document.getElementById('cash-balance-grande').textContent.replace(/[^0-9.,]/g, '').replace(',', '.'));
        if (amount > grandeBalance) {
            toast('Montant supérieur au solde de la Grande Caisse (' + formatNumber(grandeBalance) + ' HTG)', 'error');
            return;
        }

        try {
            const transfer = {
                amount,
                note,
                date: new Date().toISOString(),
                created_by: localStorage.getItem('hopital_user') || 'Admin',
                id: 'PT-' + Date.now(),
            };

            const stored = localStorage.getItem('petiteCaisseMouvements');
            const mouvements = stored ? JSON.parse(stored) : [];
            mouvements.push(transfer);
            localStorage.setItem('petiteCaisseMouvements', JSON.stringify(mouvements));
            state.petiteMouvements = mouvements;

            toast('Transfert de ' + formatNumber(amount) + ' HTG vers la Petite Caisse effectué !', 'success');
            closeTransferModal();
            await refreshData();

            // Notification interne (optionnelle)
            try {
                await apiCall('POST', '/messages', {
                    recipient: 'admin',
                    recipientRole: 'admin',
                    subject: '💰 Alimentation Petite Caisse',
                    content: 'Transfert de ' + formatNumber(amount) + ' HTG depuis la Grande Caisse. Motif : ' + note,
                    type: 'notification',
                });
            } catch (e) { /* ignore */ }

        } catch (e) {
            toast('Erreur lors du transfert', 'error');
            console.error(e);
        }
    }

    // ─── Création de l'UI ───────────────────────────────────────────

    function createUI() {
        // Vérifier si l'écran existe déjà
        if (document.getElementById('cash-accounts-screen')) return;

        const main = document.querySelector('.content-area');
        if (!main) {
            console.error('Élément .content-area introuvable');
            return;
        }

        // Écran des comptes de caisse
        const screen = document.createElement('section');
        screen.id = 'cash-accounts-screen';
        screen.className = 'screen';
        screen.innerHTML = `
            <div style="padding: 20px;">
                <h2 class="section-title"><i class="fas fa-cash-register"></i> Gestion des Caisses</h2>

                <!-- En-tête total -->
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:24px;background:#fff;padding:16px 24px;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
                    <div><strong style="font-size:1.1rem;">Total encaissé :</strong> <span id="cash-total-all" style="color:#1a6bca;font-weight:700;font-size:1.2rem;">0.00 HTG</span></div>
                    <button class="btn btn-secondary" onclick="refreshCashData()" style="padding:6px 18px;border-radius:8px;border:none;background:#e9ecef;color:#2c3e50;cursor:pointer;font-weight:500;">
                        <i class="fas fa-sync"></i> Rafraîchir
                    </button>
                </div>

                <!-- 6 comptes -->
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:30px;">
                    <div class="cash-account-card" style="background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 2px 10px rgba(0,0,0,0.05);border-left:5px solid #1a6bca;">
                        <div style="font-size:1.5rem;color:#1a6bca;"><i class="fas fa-warehouse"></i></div>
                        <div style="font-weight:600;font-size:0.92rem;color:#2c3e50;">Grande Caisse</div>
                        <div style="font-size:1.5rem;font-weight:700;color:#0d2b4e;margin-top:4px;" id="cash-balance-grande">0.00 <small>HTG</small></div>
                        <div style="font-size:0.78rem;color:#6c7a8a;" id="cash-sub-grande">0.00 HTG encaissé</div>
                        <div style="margin-top:12px;"><button onclick="filterByAccount('grande')" style="background:none;border:1px solid #dce3ed;border-radius:6px;padding:4px 12px;font-size:0.78rem;color:#2c3e50;cursor:pointer;">Voir</button></div>
                    </div>

                    <div class="cash-account-card" style="background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 2px 10px rgba(0,0,0,0.05);border-left:5px solid #fd7e14;">
                        <div style="font-size:1.5rem;color:#fd7e14;"><i class="fas fa-mobile-alt"></i></div>
                        <div style="font-weight:600;font-size:0.92rem;color:#2c3e50;">NatCash</div>
                        <div style="font-size:1.5rem;font-weight:700;color:#0d2b4e;margin-top:4px;" id="cash-balance-natcash">0.00 <small>HTG</small></div>
                        <div style="font-size:0.78rem;color:#6c7a8a;" id="cash-sub-natcash">0.00 HTG</div>
                        <div style="margin-top:12px;"><button onclick="filterByAccount('natcash')" style="background:none;border:1px solid #dce3ed;border-radius:6px;padding:4px 12px;font-size:0.78rem;color:#2c3e50;cursor:pointer;">Voir</button></div>
                    </div>

                    <div class="cash-account-card" style="background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 2px 10px rgba(0,0,0,0.05);border-left:5px solid #6f42c1;">
                        <div style="font-size:1.5rem;color:#6f42c1;"><i class="fas fa-wallet"></i></div>
                        <div style="font-weight:600;font-size:0.92rem;color:#2c3e50;">MonCash</div>
                        <div style="font-size:1.5rem;font-weight:700;color:#0d2b4e;margin-top:4px;" id="cash-balance-moncash">0.00 <small>HTG</small></div>
                        <div style="font-size:0.78rem;color:#6c7a8a;" id="cash-sub-moncash">0.00 HTG</div>
                        <div style="margin-top:12px;"><button onclick="filterByAccount('moncash')" style="background:none;border:1px solid #dce3ed;border-radius:6px;padding:4px 12px;font-size:0.78rem;color:#2c3e50;cursor:pointer;">Voir</button></div>
                    </div>

                    <div class="cash-account-card" style="background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 2px 10px rgba(0,0,0,0.05);border-left:5px solid #17a2b8;">
                        <div style="font-size:1.5rem;color:#17a2b8;"><i class="fas fa-coins"></i></div>
                        <div style="font-weight:600;font-size:0.92rem;color:#2c3e50;">Petite Caisse</div>
                        <div style="font-size:1.5rem;font-weight:700;color:#0d2b4e;margin-top:4px;" id="cash-balance-petite">0.00 <small>HTG</small></div>
                        <div style="font-size:0.78rem;color:#6c7a8a;" id="cash-sub-petite">0.00 HTG disponible</div>
                        <div style="margin-top:12px;">
                            <button onclick="openTransferModal()" style="background:#17a2b8;border:none;border-radius:6px;padding:4px 12px;font-size:0.78rem;color:#fff;cursor:pointer;margin-right:6px;">Alimenter</button>
                            <button onclick="filterByAccount('petite')" style="background:none;border:1px solid #dce3ed;border-radius:6px;padding:4px 12px;font-size:0.78rem;color:#2c3e50;cursor:pointer;">Voir</button>
                        </div>
                    </div>

                    <div class="cash-account-card" style="background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 2px 10px rgba(0,0,0,0.05);border-left:5px solid #dc3545;">
                        <div style="font-size:1.5rem;color:#dc3545;"><i class="fas fa-hand-holding-usd"></i></div>
                        <div style="font-weight:600;font-size:0.92rem;color:#2c3e50;">Caisse Dette</div>
                        <div style="font-size:1.5rem;font-weight:700;color:#0d2b4e;margin-top:4px;" id="cash-balance-dette">0.00 <small>HTG</small></div>
                        <div style="font-size:0.78rem;color:#6c7a8a;" id="cash-sub-dette">0.00 HTG dû</div>
                        <div style="margin-top:12px;"><button onclick="filterByAccount('dette')" style="background:none;border:1px solid #dce3ed;border-radius:6px;padding:4px 12px;font-size:0.78rem;color:#2c3e50;cursor:pointer;">Voir</button></div>
                    </div>

                    <div class="cash-account-card" style="background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 2px 10px rgba(0,0,0,0.05);border-left:5px solid #28a745;">
                        <div style="font-size:1.5rem;color:#28a745;"><i class="fas fa-credit-card"></i></div>
                        <div style="font-weight:600;font-size:0.92rem;color:#2c3e50;">Caisse Bancaire</div>
                        <div style="font-size:1.5rem;font-weight:700;color:#0d2b4e;margin-top:4px;" id="cash-balance-bancaire">0.00 <small>HTG</small></div>
                        <div style="font-size:0.78rem;color:#6c7a8a;" id="cash-sub-bancaire">0.00 HTG</div>
                        <div style="margin-top:12px;"><button onclick="filterByAccount('bancaire')" style="background:none;border:1px solid #dce3ed;border-radius:6px;padding:4px 12px;font-size:0.78rem;color:#2c3e50;cursor:pointer;">Voir</button></div>
                    </div>
                </div>

                <!-- Filtres -->
                <div style="display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;background:#fff;padding:14px 20px;border-radius:12px;margin-bottom:22px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                    <label style="font-size:0.85rem;font-weight:500;color:#2c3e50;">Compte :</label>
                    <select id="cash-filter-account" style="padding:6px 12px;border-radius:8px;border:1px solid #dce3ed;background:#fff;font-size:0.85rem;outline:none;">
                        <option value="all">Tous les comptes</option>
                        <option value="grande">Grande Caisse</option>
                        <option value="natcash">NatCash</option>
                        <option value="moncash">MonCash</option>
                        <option value="petite">Petite Caisse</option>
                        <option value="dette">Caisse Dette</option>
                        <option value="bancaire">Caisse Bancaire</option>
                    </select>
                    <label style="font-size:0.85rem;font-weight:500;color:#2c3e50;">Du</label>
                    <input type="date" id="cash-filter-date-from" style="padding:6px 12px;border-radius:8px;border:1px solid #dce3ed;background:#fff;font-size:0.85rem;outline:none;" />
                    <label style="font-size:0.85rem;font-weight:500;color:#2c3e50;">Au</label>
                    <input type="date" id="cash-filter-date-to" style="padding:6px 12px;border-radius:8px;border:1px solid #dce3ed;background:#fff;font-size:0.85rem;outline:none;" />
                    <button onclick="applyFilters()" style="padding:6px 18px;border-radius:8px;border:none;background:#1a6bca;color:#fff;font-weight:500;font-size:0.85rem;cursor:pointer;"><i class="fas fa-search"></i> Filtrer</button>
                    <button onclick="resetFilters()" style="padding:6px 18px;border-radius:8px;border:none;background:#e9ecef;color:#2c3e50;font-weight:500;font-size:0.85rem;cursor:pointer;"><i class="fas fa-undo"></i> Réinitialiser</button>
                </div>

                <!-- Historique -->
                <div style="background:#fff;border-radius:14px;padding:20px 20px 16px;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:16px;">
                        <h3 style="font-size:1.1rem;font-weight:600;color:#0d2b4e;"><i class="fas fa-history" style="color:#1a6bca;margin-right:8px;"></i> Historique des mouvements</h3>
                        <span style="font-size:0.82rem;color:#6c7a8a;" id="cash-tx-count">0 transaction(s)</span>
                    </div>
                    <div style="overflow-x:auto;">
                        <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
                            <thead>
                                <tr>
                                    <th style="text-align:left;padding:10px 10px 8px 0;font-weight:600;color:#4a5a6a;border-bottom:2px solid #e9ecef;">Date</th>
                                    <th style="text-align:left;padding:10px 10px 8px 0;font-weight:600;color:#4a5a6a;border-bottom:2px solid #e9ecef;">Compte</th>
                                    <th style="text-align:left;padding:10px 10px 8px 0;font-weight:600;color:#4a5a6a;border-bottom:2px solid #e9ecef;">Description</th>
                                    <th style="text-align:left;padding:10px 10px 8px 0;font-weight:600;color:#4a5a6a;border-bottom:2px solid #e9ecef;">Montant (HTG)</th>
                                    <th style="text-align:left;padding:10px 10px 8px 0;font-weight:600;color:#4a5a6a;border-bottom:2px solid #e9ecef;">USD</th>
                                    <th style="text-align:left;padding:10px 10px 8px 0;font-weight:600;color:#4a5a6a;border-bottom:2px solid #e9ecef;">Référence</th>
                                </tr>
                            </thead>
                            <tbody id="cash-transactions-body">
                                <tr><td colspan="6" style="text-align:center;color:#6c7a8a;padding:30px 0;"><i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i> Chargement...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        main.appendChild(screen);

        // Modal de transfert
        const modal = document.createElement('div');
        modal.id = 'cash-transfer-modal';
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
            display: none; align-items: center; justify-content: center; z-index: 10000; padding: 20px;
            animation: fadeIn 0.25s ease;
        `;
        modal.className = 'cash-modal-overlay';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:18px;max-width:520px;width:100%;padding:28px 30px 30px;box-shadow:0 20px 60px rgba(0,0,0,0.25);animation:slideUp 0.3s ease;">
                <h3 style="font-size:1.25rem;margin-bottom:6px;color:#0d2b4e;"><i class="fas fa-coins" style="color:#17a2b8;margin-right:8px;"></i> Alimenter la Petite Caisse</h3>
                <p style="color:#6c7a8a;font-size:0.9rem;margin-bottom:18px;">Transférer des fonds depuis la Grande Caisse vers la Petite Caisse.</p>
                <div style="background:#f8f9fa;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:0.9rem;border-left:3px solid #1a6bca;">
                    <i class="fas fa-info-circle" style="color:#1a6bca;margin-right:8px;"></i>
                    Solde Grande Caisse : <strong id="cash-modal-grande-balance">0.00 HTG</strong>
                </div>
                <div style="margin-bottom:16px;">
                    <label style="display:block;font-weight:500;font-size:0.88rem;color:#2c3e50;margin-bottom:4px;">Montant (HTG) *</label>
                    <input type="number" id="cash-transfer-amount" placeholder="0.00" min="0.01" step="0.01" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid #dce3ed;font-size:0.95rem;outline:none;" />
                </div>
                <div style="margin-bottom:16px;">
                    <label style="display:block;font-weight:500;font-size:0.88rem;color:#2c3e50;margin-bottom:4px;">Motif / Note</label>
                    <textarea id="cash-transfer-note" placeholder="Ex: Approvisionnement Petite Caisse..." style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid #dce3ed;font-size:0.95rem;outline:none;resize:vertical;min-height:60px;font-family:inherit;"></textarea>
                </div>
                <div style="display:flex;gap:12px;margin-top:6px;">
                    <button onclick="executeTransfer()" style="flex:1;padding:10px 26px;border-radius:10px;border:none;font-weight:600;font-size:0.92rem;cursor:pointer;background:#17a2b8;color:#fff;"><i class="fas fa-arrow-right"></i> Transférer</button>
                    <button onclick="closeTransferModal()" style="flex:1;padding:10px 26px;border-radius:10px;border:none;font-weight:600;font-size:0.92rem;cursor:pointer;background:#e9ecef;color:#2c3e50;">Annuler</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Ajouter les styles manquants
        if (!document.getElementById('cash-styles')) {
            const style = document.createElement('style');
            style.id = 'cash-styles';
            style.textContent = `
                @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
                @keyframes slideUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
                .cash-modal-overlay.open { display: flex !important; }
                .cash-account-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
                .cash-account-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
            `;
            document.head.appendChild(style);
        }

        // Événements sur les filtres
        document.getElementById('cash-filter-account').addEventListener('change', applyFilters);
        document.getElementById('cash-filter-date-from').addEventListener('change', applyFilters);
        document.getElementById('cash-filter-date-to').addEventListener('change', applyFilters);

        // Fermeture du modal en cliquant à l'extérieur
        document.getElementById('cash-transfer-modal').addEventListener('click', function(e) {
            if (e.target === this) closeTransferModal();
        });

        // Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeTransferModal();
        });

        // Exposer les fonctions globalement pour les boutons onclick
        window.refreshCashData = refreshData;
        window.filterByAccount = filterByAccount;
        window.applyFilters = applyFilters;
        window.resetFilters = resetFilters;
        window.openTransferModal = openTransferModal;
        window.closeTransferModal = closeTransferModal;
        window.executeTransfer = executeTransfer;
    }

    // ─── Ajout de l'onglet "Caisses" dans la navigation ────────────

    function addTab() {
        const nav = document.querySelector('.nav-bar');
        if (!nav) {
            console.error('Navigation introuvable');
            return;
        }
        if (document.querySelector('.nav-item[data-tab="cash-accounts"]')) return;

        const tab = document.createElement('a');
        tab.href = '#';
        tab.className = 'nav-item';
        tab.setAttribute('data-tab', 'cash-accounts');
        tab.innerHTML = '<i class="fas fa-cash-register"></i><span>Caisses</span>';
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            document.getElementById('cash-accounts-screen').classList.add('active');
            this.classList.add('active');
            refreshData();
        });
        nav.appendChild(tab);
    }

    // ─── Initialisation ────────────────────────────────────────────

    function init() {
        createUI();
        addTab();
        // Ne pas charger les données automatiquement, l'utilisateur clique sur l'onglet pour charger
        // Mais on peut précharger si déjà actif ?
        // On attend le clic pour refreshData.
        // On peut aussi définir un intervalle si besoin.
        console.log('📊 Gestion des Caisses chargée');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();