const CONFIG = {
    SERVER_URL: window.location.hostname.includes('localhost') 
        ? 'http://localhost:3000/api' 
        : '/api',
    CURRENCY: 'Gdes',
    GAMING_RULES: {
        BORLETTE: { lot1: 60, lot2: 20, lot3: 10 },
        LOTTO3: 500,
        LOTTO4: 1000,
        LOTTO5: 5000,
        MARIAGE: 1000,
        AUTO_MARRIAGE: 1000,
        AUTO_LOTTO4: 1000,
        AUTO_LOTTO5: 5000
    },
    DRAWS: []
};

let APP_STATE = {
    selectedDraw: '',
    selectedDraws: [],
    multiDrawMode: false,
    selectedGame: 'borlette',
    currentCart: [],
    lastResults: null,
    ticketsHistory: [],
    lotto3Options: [false, false, false],
    lotto4Options: [false, false, false],
    lotto5Options: [false, false, false],
    showNumericChips: false,
    showLottoGames: false,
    showSpecialGames: false,
    currentTab: 'home',
    token: localStorage.getItem('lotato_token'),
    user: JSON.parse(localStorage.getItem('lotato_user') || '{}')
};

// API Helper
const API = {
    async request(endpoint, options = {}) {
        const url = `${CONFIG.SERVER_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (APP_STATE.token) {
            headers['Authorization'] = `Bearer ${APP_STATE.token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (response.status === 401) {
                // Token expiré
                localStorage.removeItem('lotato_token');
                localStorage.removeItem('lotato_user');
                window.location.href = 'login.html';
                throw new Error('Session expirée');
            }

            if (response.status === 403) {
                throw new Error('Accès interdit');
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Erreur HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            showNotification(error.message || 'Erreur de connexion au serveur', 'error');
            throw error;
        }
    },

    async login(userId, password) {
        try {
            const response = await this.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ userId, password })
            });

            if (response.success && response.token) {
                APP_STATE.token = response.token;
                APP_STATE.user = response.user;
                localStorage.setItem('lotato_token', response.token);
                localStorage.setItem('lotato_user', JSON.stringify(response.user));
                return response;
            } else {
                throw new Error(response.error || 'Échec de connexion');
            }
        } catch (error) {
            throw error;
        }
    },

    async logout() {
        try {
            await this.request('/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('lotato_token');
            localStorage.removeItem('lotato_user');
            APP_STATE.token = null;
            APP_STATE.user = {};
            window.location.href = 'login.html';
        }
    },

    async getDraws() {
        return await this.request('/draws');
    },

    async saveTicket(ticketData) {
        return await this.request('/tickets', {
            method: 'POST',
            body: JSON.stringify(ticketData)
        });
    },

    async getAgentTickets(date) {
        const query = date ? `?startDate=${date}&endDate=${date}` : '';
        return await this.request(`/agent/tickets${query}`);
    },

    async getDailyReport() {
        return await this.request('/agent/reports/daily');
    },

    async getGameRules() {
        return await this.request('/game-rules');
    },

    async getProfile() {
        return await this.request('/profile');
    }
};

// Fonction de notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--warning)'};
        color: ${type === 'warning' ? 'black' : 'white'};
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s;
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 300px;
    `;
    
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
    
    // Ajouter les styles d'animation s'ils n'existent pas
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Special Games Functions
const SpecialGames = {
    generateBOBets(amount) {
        const bets = [];
        for (let i = 0; i < 100; i++) {
            const num = i.toString().padStart(2, '0');
            if (num[0] === num[1]) {
                bets.push({
                    id: Date.now() + Math.random(),
                    game: 'borlette',
                    number: num,
                    cleanNumber: num,
                    amount: amount,
                    drawId: APP_STATE.selectedDraw,
                    timestamp: new Date().toISOString(),
                    isAutoGenerated: true,
                    specialType: 'BO'
                });
            }
        }
        return bets;
    },

    generateNBets(digit, amount) {
        const bets = [];
        for (let i = 0; i < 100; i++) {
            const num = i.toString().padStart(2, '0');
            if (num[1] === digit.toString()) {
                bets.push({
                    id: Date.now() + Math.random(),
                    game: 'borlette',
                    number: num,
                    cleanNumber: num,
                    amount: amount,
                    drawId: APP_STATE.selectedDraw,
                    timestamp: new Date().toISOString(),
                    isAutoGenerated: true,
                    specialType: `N${digit}`
                });
            }
        }
        return bets;
    },

    generateGRAPBets(amount) {
        const bets = [];
        for (let i = 0; i < 10; i++) {
            const num = i.toString().repeat(3);
            bets.push({
                id: Date.now() + Math.random(),
                game: 'lotto3',
                number: num,
                cleanNumber: num,
                amount: amount,
                drawId: APP_STATE.selectedDraw,
                timestamp: new Date().toISOString(),
                isAutoGenerated: true,
                specialType: 'GRAP'
            });
        }
        return bets;
    }
};

// Setup Input Auto Move
function setupInputAutoMove() {
    const numInput = document.getElementById('num-input');
    const amtInput = document.getElementById('amt-input');
    
    numInput.addEventListener('input', function(e) {
        const game = APP_STATE.selectedGame;
        let maxLength = 5;
        
        switch(game) {
            case 'borlette': maxLength = 2; break;
            case 'lotto3': maxLength = 3; break;
            case 'lotto4': maxLength = 4; break;
            case 'lotto5': maxLength = 5; break;
            case 'mariage': maxLength = 4; break;
            case 'auto_marriage': maxLength = 0; break;
            case 'auto_lotto4': maxLength = 0; break;
            case 'auto_lotto5': maxLength = 0; break;
            case 'bo': maxLength = 0; break;
            case 'grap': maxLength = 0; break;
        }
        
        if (game.startsWith('n')) {
            maxLength = 0;
        }
        
        if (this.value.length >= maxLength && maxLength > 0) {
            amtInput.focus();
            amtInput.select();
        }
        
        if (game === 'lotto4' && this.value.length === 4) {
            this.value = this.value.replace(/(\d{2})(\d{2})/, '$1-$2');
        } else if (game === 'lotto5' && this.value.length === 5) {
            this.value = this.value.replace(/(\d{3})(\d{2})/, '$1-$2');
        } else if (game === 'mariage' && this.value.length === 4) {
            this.value = this.value.replace(/(\d{2})(\d{2})/, '$1&$2');
        }
    });
    
    amtInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            CartManager.addBet();
        }
    });
}

// Game Engine
const GameEngine = {
    validateEntry(type, num) {
        const cleanNum = num.toString().replace(/[-&]/g, '');
        const n = cleanNum;
        
        switch(type) {
            case 'borlette': return n.length === 2;
            case 'lotto3':   return n.length === 3;
            case 'lotto4':   return n.length === 4;
            case 'lotto5':   return n.length === 5;
            case 'mariage':  return n.length === 4;
            case 'auto_marriage': return true;
            case 'auto_lotto4': return true;
            case 'auto_lotto5': return true;
            case 'bo': return true;
            case 'grap': return true;
            default: 
                if (type.startsWith('n')) return true;
                return false;
        }
    },

    getCleanNumber(num) {
        return num.toString().replace(/[-&]/g, '');
    },

    generateAutoMarriageBets(amount) {
        const borletteNumbers = APP_STATE.currentCart
            .filter(item => item.game === 'borlette' && this.getCleanNumber(item.number).length === 2)
            .map(item => this.getCleanNumber(item.number));

        const uniqueNumbers = [...new Set(borletteNumbers)];
        const autoBets = [];
        
        for (let i = 0; i < uniqueNumbers.length; i++) {
            for (let j = i + 1; j < uniqueNumbers.length; j++) {
                autoBets.push({
                    id: Date.now() + Math.random(),
                    game: 'auto_marriage',
                    number: uniqueNumbers[i] + '&' + uniqueNumbers[j],
                    cleanNumber: uniqueNumbers[i] + uniqueNumbers[j],
                    amount: amount,
                    drawId: APP_STATE.selectedDraw,
                    timestamp: new Date().toISOString(),
                    isAutoGenerated: true
                });
            }
        }
        
        return autoBets;
    },

    generateAutoLotto4Bets(amount) {
        const borletteNumbers = APP_STATE.currentCart
            .filter(item => item.game === 'borlette' && this.getCleanNumber(item.number).length === 2)
            .map(item => this.getCleanNumber(item.number));

        const uniqueNumbers = [...new Set(borletteNumbers)];
        const autoBets = [];
        
        for (let i = 0; i < uniqueNumbers.length; i++) {
            for (let j = 0; j < uniqueNumbers.length; j++) {
                if (i !== j) {
                    autoBets.push({
                        id: Date.now() + Math.random(),
                        game: 'auto_lotto4',
                        number: uniqueNumbers[i] + '-' + uniqueNumbers[j],
                        cleanNumber: uniqueNumbers[i] + uniqueNumbers[j],
                        amount: amount,
                        drawId: APP_STATE.selectedDraw,
                        timestamp: new Date().toISOString(),
                        isAutoGenerated: true
                    });
                }
            }
        }
        
        return autoBets;
    },

    generateAutoLotto5Bets(amount) {
        const lotto3Numbers = APP_STATE.currentCart
            .filter(item => item.game === 'lotto3' && this.getCleanNumber(item.number).length === 3)
            .map(item => this.getCleanNumber(item.number));

        const uniqueNumbers = [...new Set(lotto3Numbers)];
        const autoBets = [];
        
        for (let i = 0; i < uniqueNumbers.length; i++) {
            for (let j = 0; j < uniqueNumbers.length; j++) {
                if (i !== j) {
                    autoBets.push({
                        id: Date.now() + Math.random(),
                        game: 'auto_lotto5',
                        number: uniqueNumbers[i] + '-' + uniqueNumbers[j].slice(-2),
                        cleanNumber: uniqueNumbers[i] + uniqueNumbers[j].slice(-2),
                        amount: amount,
                        drawId: APP_STATE.selectedDraw,
                        timestamp: new Date().toISOString(),
                        isAutoGenerated: true
                    });
                }
            }
        }
        
        return autoBets;
    }
};

// Cart Manager
const CartManager = {
    addBet() {
        const numInput = document.getElementById('num-input');
        const amtInput = document.getElementById('amt-input');
        let num = numInput.value.trim();
        const amt = parseFloat(amtInput.value);

        if (isNaN(amt) || amt <= 0) {
            showNotification("Tanpri antre yon montan ki valid", "error");
            return;
        }

        if (APP_STATE.selectedGame === 'bo') {
            const boBets = SpecialGames.generateBOBets(amt);
            
            if (boBets.length === 0) {
                showNotification("Pa gen boules paires pou ajoute", "error");
                return;
            }

            const draws = APP_STATE.multiDrawMode ? APP_STATE.selectedDraws : [APP_STATE.selectedDraw];
            
            draws.forEach(drawId => {
                boBets.forEach(bet => {
                    const newBet = {
                        ...bet,
                        id: Date.now() + Math.random(),
                        drawId: drawId,
                        drawName: CONFIG.DRAWS.find(d => d.drawId === drawId)?.name || drawId
                    };
                    APP_STATE.currentCart.push(newBet);
                });
            });
            
            this.renderCart();
            amtInput.value = '';
            showNotification(`${boBets.length * draws.length} boules paires ajoute nan panye`, "success");
            return;
        }

        if (APP_STATE.selectedGame.startsWith('n')) {
            const digit = parseInt(APP_STATE.selectedGame[1]);
            const nBets = SpecialGames.generateNBets(digit, amt);
            
            if (nBets.length === 0) {
                showNotification("Pa gen boules pou ajoute", "error");
                return;
            }

            const draws = APP_STATE.multiDrawMode ? APP_STATE.selectedDraws : [APP_STATE.selectedDraw];
            
            draws.forEach(drawId => {
                nBets.forEach(bet => {
                    const newBet = {
                        ...bet,
                        id: Date.now() + Math.random(),
                        drawId: drawId,
                        drawName: CONFIG.DRAWS.find(d => d.drawId === drawId)?.name || drawId
                    };
                    APP_STATE.currentCart.push(newBet);
                });
            });
            
            this.renderCart();
            amtInput.value = '';
            showNotification(`${nBets.length * draws.length} boules (N${digit}) ajoute nan panye`, "success");
            return;
        }

        if (APP_STATE.selectedGame === 'grap') {
            const grapBets = SpecialGames.generateGRAPBets(amt);
            
            if (grapBets.length === 0) {
                showNotification("Pa gen boules grap pou ajoute", "error");
                return;
            }

            const draws = APP_STATE.multiDrawMode ? APP_STATE.selectedDraws : [APP_STATE.selectedDraw];
            
            draws.forEach(drawId => {
                grapBets.forEach(bet => {
                    const newBet = {
                        ...bet,
                        id: Date.now() + Math.random(),
                        drawId: drawId,
                        drawName: CONFIG.DRAWS.find(d => d.drawId === drawId)?.name || drawId
                    };
                    APP_STATE.currentCart.push(newBet);
                });
            });
            
            this.renderCart();
            amtInput.value = '';
            showNotification(`${grapBets.length * draws.length} boules grap ajoute nan panye`, "success");
            return;
        }

        if (APP_STATE.selectedGame.includes('auto')) {
            if (isNaN(amt) || amt <= 0) {
                showNotification("Tanpri antre yon montan ki valid", "error");
                return;
            }

            let autoBets = [];
            if (APP_STATE.selectedGame === 'auto_marriage') {
                autoBets = GameEngine.generateAutoMarriageBets(amt);
            } else if (APP_STATE.selectedGame === 'auto_lotto4') {
                autoBets = GameEngine.generateAutoLotto4Bets(amt);
            } else if (APP_STATE.selectedGame === 'auto_lotto5') {
                autoBets = GameEngine.generateAutoLotto5Bets(amt);
            }
            
            if (autoBets.length === 0) {
                showNotification("Pa gen nimewo nan panye pou kreye jwèt otomatik yo", "error");
                return;
            }

            const draws = APP_STATE.multiDrawMode ? APP_STATE.selectedDraws : [APP_STATE.selectedDraw];
            
            draws.forEach(drawId => {
                autoBets.forEach(bet => {
                    const newBet = {
                        ...bet,
                        id: Date.now() + Math.random(),
                        drawId: drawId,
                        drawName: CONFIG.DRAWS.find(d => d.drawId === drawId)?.name || drawId
                    };
                    APP_STATE.currentCart.push(newBet);
                });
            });
            
            this.renderCart();
            amtInput.value = '';
            showNotification(`${autoBets.length * draws.length} jwèt otomatik ajoute nan panye`, "success");
            return;
        }

        if (!GameEngine.validateEntry(APP_STATE.selectedGame, num)) {
            showNotification("Nimewo sa pa bon pou " + APP_STATE.selectedGame, "error");
            return;
        }

        num = GameEngine.getCleanNumber(num);
        
        let displayNum = num;
        if (APP_STATE.selectedGame === 'lotto4' && num.length === 4) {
            displayNum = num.slice(0, 2) + '-' + num.slice(2, 4);
        } else if (APP_STATE.selectedGame === 'lotto5' && num.length === 5) {
            displayNum = num.slice(0, 3) + '-' + num.slice(3, 5);
        } else if (APP_STATE.selectedGame === 'mariage' && num.length === 4) {
            displayNum = num.slice(0, 2) + '&' + num.slice(2, 4);
        }

        const draws = APP_STATE.multiDrawMode ? APP_STATE.selectedDraws : [APP_STATE.selectedDraw];
        
        draws.forEach(drawId => {
            const bet = {
                id: Date.now() + Math.random(),
                game: APP_STATE.selectedGame,
                number: displayNum,
                cleanNumber: num,
                amount: amt,
                drawId: drawId,
                drawName: CONFIG.DRAWS.find(d => d.drawId === drawId)?.name || drawId,
                timestamp: new Date().toISOString(),
                isAutoGenerated: false,
                isSpecial: false
            };

            APP_STATE.currentCart.push(bet);
        });
        
        this.renderCart();
        
        numInput.value = '';
        amtInput.value = '';
        numInput.focus();
    },

    removeBet(id) {
        APP_STATE.currentCart = APP_STATE.currentCart.filter(item => item.id !== id);
        this.renderCart();
    },

    renderCart() {
        const display = document.getElementById('cart-display');
        const summary = document.getElementById('cart-summary');
        const totalDisplay = document.getElementById('total-amount');
        const finalTotalDisplay = document.getElementById('final-total');
        const countDisplay = document.getElementById('items-count');
        const printHeaderBtn = document.getElementById('print-header-btn');

        if (APP_STATE.currentCart.length === 0) {
            display.innerHTML = '<div class="empty-msg">Pa gen paray ankò</div>';
            summary.style.display = 'none';
            countDisplay.innerText = "0 jwèt";
            if (printHeaderBtn) printHeaderBtn.style.display = 'none';
            return;
        }

        let total = 0;
        display.innerHTML = APP_STATE.currentCart.map(item => {
            total += item.amount;
            let gameName = '';
            
            if (item.isAutoGenerated && item.specialType) {
                gameName = item.specialType.toUpperCase();
            } else if (item.isAutoGenerated) {
                gameName = `${item.game.replace('_', ' ').toUpperCase()}*`;
            } else {
                gameName = item.game.toUpperCase();
            }
            
            const drawName = APP_STATE.multiDrawMode ? item.drawName : '';
            
            return `
                <div class="cart-item animate-fade">
                    <div class="item-info">
                        <span class="item-game">${gameName} ${item.number}</span>
                        ${APP_STATE.multiDrawMode ? `<span style="font-size:0.8rem; color:var(--text-dim)">${drawName}</span>` : ''}
                    </div>
                    <div class="item-price">
                        <span>${item.amount} ${CONFIG.CURRENCY}</span>
                        <button onclick="CartManager.removeBet(${item.id})" style="background:none; border:none; color:var(--danger); cursor:pointer;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        totalDisplay.innerText = total;
        finalTotalDisplay.innerText = total;
        countDisplay.innerText = APP_STATE.currentCart.length + " jwèt";
        summary.style.display = 'block';
        
        if (printHeaderBtn) {
            printHeaderBtn.style.display = 'flex';
            printHeaderBtn.innerHTML = `<i class="fas fa-check-circle"></i> Valider (${total} Gdes)`;
        }
        
        display.scrollTop = display.scrollHeight;
    }
};

// Navigation
function switchTab(tabName) {
    APP_STATE.currentTab = tabName;
    
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
    });
    
    let screenId = '';
    switch(tabName) {
        case 'home':
            screenId = 'draw-selection-screen';
            document.querySelector('.nav-item:nth-child(1)').classList.add('active');
            break;
        case 'history':
            screenId = 'history-screen';
            document.querySelector('.nav-item:nth-child(2)').classList.add('active');
            renderHistory();
            break;
        case 'reports':
            screenId = 'reports-screen';
            document.querySelector('.nav-item:nth-child(3)').classList.add('active');
            renderReports();
            break;
    }
    
    if (screenId) {
        document.getElementById(screenId).classList.add('active');
    }
}

// Render History from API
async function renderHistory() {
    const container = document.getElementById('history-container');
    
    try {
        const tickets = await API.getAgentTickets();
        
        if (tickets.length === 0) {
            container.innerHTML = '<div class="empty-msg">Pa gen tikè nan istorik</div>';
            return;
        }
        
        container.innerHTML = tickets.map(ticket => {
            let status = '';
            let statusClass = '';
            
            if (ticket.checked) {
                const totalBet = ticket.bets.reduce((sum, bet) => sum + bet.amount, 0);
                const hasWin = ticket.bets.some(bet => bet.gain > 0);
                
                if (hasWin) {
                    status = 'GANYEN';
                    statusClass = 'badge-win';
                } else {
                    status = 'PÈDI';
                    statusClass = 'badge-lost';
                }
            } else {
                status = 'AP TANN';
                statusClass = 'badge-wait';
            }
            
            return `
                <div class="history-card">
                    <div class="card-header">
                        <span>#${ticket.ticketId}</span>
                        <span>${new Date(ticket.date).toLocaleDateString()}</span>
                    </div>
                    <div>
                        <p><strong>Tiraj:</strong> ${ticket.drawName}</p>
                        <p><strong>Total:</strong> ${ticket.total} Gdes</p>
                        <p><strong>Nimewo:</strong> ${ticket.bets.length}</p>
                    </div>
                    <div class="card-footer">
                        <span class="badge ${statusClass}">${status}</span>
                        <button class="btn-small" onclick="viewTicketDetails('${ticket.ticketId}')">
                            <i class="fas fa-eye"></i> Detay
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('History error:', error);
        container.innerHTML = '<div class="empty-msg">Erreur chargement historique</div>';
    }
}

// Render Reports from API
async function renderReports() {
    try {
        const report = await API.getDailyReport();
        
        document.getElementById('total-tickets').textContent = report.totalTickets;
        document.getElementById('total-bets').textContent = report.totalSales + ' Gdes';
        document.getElementById('total-wins').textContent = report.totalWins + ' Gdes';
        document.getElementById('total-loss').textContent = report.totalLoss + ' Gdes';
        document.getElementById('balance').textContent = report.balance + ' Gdes';
        document.getElementById('balance').style.color = report.balance >= 0 ? 'var(--success)' : 'var(--danger)';
        
        const breakdownContainer = document.getElementById('game-breakdown');
        breakdownContainer.innerHTML = Object.entries(report.gameStats || {}).map(([game, data]) => `
            <div class="report-row">
                <span>${game.toUpperCase()}:</span>
                <span class="val">${data.count} jwèt (${data.amount} Gdes)</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Report error:', error);
        showNotification('Erreur lors du chargement du rapport', 'error');
    }
}

// View Ticket Details
async function viewTicketDetails(ticketId) {
    try {
        const tickets = await API.getAgentTickets();
        const ticket = tickets.find(t => t.ticketId === ticketId);
        
        if (!ticket) {
            showNotification('Ticket non trouvé', 'error');
            return;
        }
        
        let details = `
            <h3>Detay Tikè #${ticket.ticketId}</h3>
            <p><strong>Tiraj:</strong> ${ticket.drawName}</p>
            <p><strong>Dat:</strong> ${new Date(ticket.date).toLocaleString()}</p>
            <p><strong>Total:</strong> ${ticket.total} Gdes</p>
            <hr>
            <h4>Paray yo:</h4>
        `;
        
        ticket.bets.forEach(bet => {
            let gameName = bet.game.toUpperCase();
            if (bet.specialType) gameName = bet.specialType;
            details += `<p>${gameName} ${bet.number} - ${bet.amount} Gdes ${bet.gain ? `(Ganyen: ${bet.gain} Gdes)` : ''}</p>`;
        });
        
        // Créer une modal pour afficher les détails
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="background: var(--bg); border-radius: 20px; padding: 30px; max-width: 500px; width: 100%; max-height: 80vh; overflow-y: auto;">
                <div style="text-align: right; margin-bottom: 10px;">
                    <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: var(--text-dim); font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div style="white-space: pre-wrap; font-family: 'Plus Jakarta Sans', sans-serif;">
                    ${details}
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 10px; margin-top: 20px; width: 100%; cursor: pointer;">
                    Fèmen
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
    } catch (error) {
        console.error('View ticket error:', error);
        showNotification('Erreur lors du chargement des détails', 'error');
    }
}

// Multi Draw Functions
function toggleMultiDrawMode() {
    APP_STATE.multiDrawMode = !APP_STATE.multiDrawMode;
    const btn = document.getElementById('multi-draw-btn');
    const multiContainer = document.getElementById('multi-draw-container');
    const continueBtn = document.getElementById('multi-draw-continue');
    const drawGrid = document.getElementById('draws-container');
    
    if (APP_STATE.multiDrawMode) {
        btn.innerHTML = '<i class="fas fa-times"></i> Sispann Plizyè Tiraj';
        btn.style.background = 'rgba(255, 77, 77, 0.2)';
        btn.style.borderColor = 'var(--danger)';
        btn.style.color = 'var(--danger)';
        multiContainer.style.display = 'flex';
        continueBtn.style.display = 'block';
        drawGrid.style.display = 'none';
        renderMultiDrawSelector();
    } else {
        btn.innerHTML = '<i class="fas fa-layer-group"></i> Plizyè Tiraj';
        btn.style.background = 'rgba(0, 212, 255, 0.2)';
        btn.style.borderColor = 'var(--secondary)';
        btn.style.color = 'var(--secondary)';
        multiContainer.style.display = 'none';
        continueBtn.style.display = 'none';
        drawGrid.style.display = 'grid';
    }
}

function renderMultiDrawSelector() {
    const container = document.getElementById('multi-draw-container');
    container.innerHTML = CONFIG.DRAWS.map(draw => `
        <input type="checkbox" class="multi-draw-checkbox" id="multi-${draw.drawId}" 
               value="${draw.drawId}" ${APP_STATE.selectedDraws.includes(draw.drawId) ? 'checked' : ''}
               onchange="toggleMultiDrawSelection('${draw.drawId}')">
        <label for="multi-${draw.drawId}" class="multi-draw-label" style="border-left: 3px solid ${getDrawColor(draw.name)}">
            ${draw.name} (${draw.time})
        </label>
    `).join('');
}

function toggleMultiDrawSelection(drawId) {
    const checkbox = document.getElementById(`multi-${drawId}`);
    if (checkbox.checked) {
        if (!APP_STATE.selectedDraws.includes(drawId)) {
            APP_STATE.selectedDraws.push(drawId);
        }
    } else {
        APP_STATE.selectedDraws = APP_STATE.selectedDraws.filter(id => id !== drawId);
    }
    
    document.getElementById('selected-draws-count').textContent = APP_STATE.selectedDraws.length;
    document.getElementById('selected-draws-count-indicator').textContent = APP_STATE.selectedDraws.length;
}

function continueToBettingWithMultiDraw() {
    if (APP_STATE.selectedDraws.length === 0) {
        showNotification("Tanpri chwazi omwen yon tiraj", "error");
        return;
    }
    
    APP_STATE.selectedDraw = APP_STATE.selectedDraws[0];
    const draw = CONFIG.DRAWS.find(d => d.drawId === APP_STATE.selectedDraw);
    document.getElementById('current-draw-title').textContent = `${APP_STATE.selectedDraws.length} Tiraj`;
    
    const indicator = document.getElementById('multi-draw-indicator');
    indicator.style.display = 'block';
    document.getElementById('selected-draws-count-indicator').textContent = APP_STATE.selectedDraws.length;
    
    document.getElementById('draw-selection-screen').classList.remove('active');
    document.getElementById('betting-screen').classList.add('active');
    document.querySelector('.back-button').style.display = 'flex';
    
    updateGameSelector();
}

// Clock
function updateClock() {
    const now = new Date();
    document.getElementById('live-clock').innerText = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Render Draws from API
async function renderDraws() {
    const container = document.getElementById('draws-container');
    
    try {
        const draws = await API.getDraws();
        CONFIG.DRAWS = draws.map(draw => ({
            drawId: draw.drawId,
            name: draw.name,
            time: draw.time,
            active: draw.active
        }));
        
        if (CONFIG.DRAWS.length > 0) {
            APP_STATE.selectedDraw = CONFIG.DRAWS[0].drawId;
            APP_STATE.selectedDraws = [CONFIG.DRAWS[0].drawId];
        }
        
        container.innerHTML = CONFIG.DRAWS.map(draw => `
            <div class="draw-card ${APP_STATE.selectedDraw === draw.drawId ? 'active' : ''}" 
                 onclick="selectDraw('${draw.drawId}')" 
                 style="--draw-color: ${getDrawColor(draw.name)}">
                <span class="draw-name">${draw.name}</span>
                <span class="draw-time"><i class="far fa-clock"></i> ${draw.time}</span>
                ${!draw.active ? '<span style="color: var(--danger); font-size: 0.8rem;">(Inaktif)</span>' : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('Draws error:', error);
        container.innerHTML = '<div class="empty-msg">Erreur chargement tirages</div>';
    }
}

function getDrawColor(drawName) {
    const colors = {
        'florida': '#ff4757',
        'newyork': '#ffa502',
        'georgia': '#2ed573',
        'texas': '#ff6b35',
        'tunisia': '#00cec9'
    };
    
    const name = drawName.toLowerCase();
    if (name.includes('florida')) return colors.florida;
    if (name.includes('new york')) return colors.newyork;
    if (name.includes('georgia')) return colors.georgia;
    if (name.includes('texas')) return colors.texas;
    if (name.includes('tunisia')) return colors.tunisia;
    return '#ad00f1';
}

function selectDraw(id) {
    if (APP_STATE.multiDrawMode) return;
    
    APP_STATE.selectedDraw = id;
    APP_STATE.selectedDraws = [id];
    const draw = CONFIG.DRAWS.find(d => d.drawId === id);
    document.getElementById('current-draw-title').textContent = draw.name;
    
    document.getElementById('multi-draw-indicator').style.display = 'none';
    
    document.getElementById('draw-selection-screen').classList.remove('active');
    document.getElementById('betting-screen').classList.add('active');
    document.querySelector('.back-button').style.display = 'flex';
    
    updateGameSelector();
}

function goBackToDraws() {
    document.getElementById('betting-screen').classList.remove('active');
    document.getElementById('draw-selection-screen').classList.add('active');
    document.querySelector('.back-button').style.display = 'none';
    
    APP_STATE.multiDrawMode = false;
    const btn = document.getElementById('multi-draw-btn');
    btn.innerHTML = '<i class="fas fa-layer-group"></i> Plizyè Tiraj';
    btn.style.background = 'rgba(0, 212, 255, 0.2)';
    btn.style.borderColor = 'var(--secondary)';
    btn.style.color = 'var(--secondary)';
    
    document.getElementById('multi-draw-container').style.display = 'none';
    document.getElementById('multi-draw-continue').style.display = 'none';
    document.getElementById('draws-container').style.display = 'grid';
    
    renderDraws();
}

// Game Selection
function toggleNumericChips() {
    APP_STATE.showNumericChips = !APP_STATE.showNumericChips;
    const container = document.getElementById('numeric-chips');
    const btn = document.getElementById('toggle-nx-btn');
    
    if (APP_STATE.showNumericChips) {
        container.classList.add('visible');
        btn.classList.add('active');
        btn.innerHTML = '<i class="fas fa-times"></i> NX';
    } else {
        container.classList.remove('visible');
        btn.classList.remove('active');
        btn.innerHTML = 'NX';
    }
    
    APP_STATE.showLottoGames = false;
    APP_STATE.showSpecialGames = false;
    document.getElementById('lotto-games').classList.remove('visible');
    document.getElementById('special-games').classList.remove('visible');
    
    document.querySelectorAll('#game-types .chip').forEach(chip => {
        chip.classList.remove('active');
    });
    document.querySelector('#game-types .chip[data-game="borlette"]').classList.add('active');
}

function toggleLottoOption(gameType, optionIndex) {
    let optionsArray;
    if (gameType === 3) {
        optionsArray = APP_STATE.lotto3Options;
    } else if (gameType === 4) {
        optionsArray = APP_STATE.lotto4Options;
    } else if (gameType === 5) {
        optionsArray = APP_STATE.lotto5Options;
    }
    
    optionsArray[optionIndex - 1] = !optionsArray[optionIndex - 1];
    
    const optionChip = document.querySelector(`#lotto${gameType}-options .option-chip[data-option="${optionIndex}"]`);
    if (optionChip) {
        optionChip.classList.toggle('active');
        
        optionChip.classList.add('animate-bounce');
        setTimeout(() => {
            optionChip.classList.remove('animate-bounce');
        }, 500);
        
        const checkbox = optionChip.querySelector('input');
        if (checkbox) {
            checkbox.checked = optionsArray[optionIndex - 1];
        }
    }
}

function selectGame(game) {
    APP_STATE.selectedGame = game;
    const input = document.getElementById('num-input');
    const currentGameDisplay = document.getElementById('current-game-display');
    
    document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sub-game-btn').forEach(b => b.classList.remove('active'));
    
    if (game.startsWith('n')) {
        document.querySelector(`.numeric-chip[data-game="${game}"]`).classList.add('active');
    }
    
    const placeholderMap = {
        'borlette': '00',
        'lotto3': '000',
        'lotto4': '0000',
        'lotto5': '00000',
        'mariage': '0000',
        'auto_marriage': 'Auto',
        'auto_lotto4': 'Auto',
        'auto_lotto5': 'Auto',
        'bo': 'Auto',
        'grap': 'Auto'
    };
    
    const gameNameMap = {
        'borlette': 'Borlette',
        'lotto3': 'Lotto 3',
        'lotto4': 'Lotto 4',
        'lotto5': 'Lotto 5',
        'mariage': 'Mariage',
        'auto_marriage': 'Auto Mariage',
        'auto_lotto4': 'Auto Lotto 4',
        'auto_lotto5': 'Auto Lotto 5',
        'bo': 'BO (Boules Paires)',
        'grap': 'GRAP',
        'n0': 'N0', 'n1': 'N1', 'n2': 'N2', 'n3': 'N3', 'n4': 'N4',
        'n5': 'N5', 'n6': 'N6', 'n7': 'N7', 'n8': 'N8', 'n9': 'N9'
    };
    
    input.placeholder = placeholderMap[game] || '00';
    currentGameDisplay.textContent = gameNameMap[game] || 'Borlette';
    
    if (game.includes('auto') || game === 'bo' || game === 'grap' || game.startsWith('n')) {
        input.disabled = true;
        input.value = '';
        input.placeholder = 'Auto-genere';
    } else {
        input.disabled = false;
        input.focus();
    }
    
    const lotto3Options = document.getElementById('lotto3-options');
    const lotto4Options = document.getElementById('lotto4-options');
    const lotto5Options = document.getElementById('lotto5-options');
    
    lotto3Options.classList.remove('visible');
    lotto4Options.classList.remove('visible');
    lotto5Options.classList.remove('visible');
    
    if (game === 'lotto3') {
        lotto3Options.classList.add('visible');
    } else if (game === 'lotto4' || game === 'auto_lotto4') {
        lotto4Options.classList.add('visible');
    } else if (game === 'lotto5' || game === 'auto_lotto5') {
        lotto5Options.classList.add('visible');
    }
}

function updateGameSelector() {
    const gameSelector = document.getElementById('game-types');
    gameSelector.innerHTML = `
        <button class="chip active" data-game="borlette" onclick="selectMainGame('borlette')">Borlette</button>
        <button class="chip" data-game="lotto" onclick="selectMainGame('lotto')">Lotto</button>
        <button class="chip" data-game="special" onclick="selectMainGame('special')">Jeux Spéciaux</button>
        <button class="chip" id="toggle-nx-btn" onclick="toggleNumericChips()">NX</button>
    `;
    
    selectGame('borlette');
}

function selectMainGame(game) {
    APP_STATE.showNumericChips = false;
    document.getElementById('numeric-chips').classList.remove('visible');
    document.getElementById('toggle-nx-btn').classList.remove('active');
    document.getElementById('toggle-nx-btn').innerHTML = 'NX';
    
    document.querySelectorAll('#game-types .chip').forEach(chip => {
        chip.classList.remove('active');
    });
    document.querySelector(`#game-types .chip[data-game="${game}"]`).classList.add('active');
    
    if (game === 'lotto') {
        APP_STATE.showLottoGames = !APP_STATE.showLottoGames;
        APP_STATE.showSpecialGames = false;
        
        if (APP_STATE.showLottoGames) {
            document.getElementById('lotto-games').classList.add('visible');
            document.getElementById('special-games').classList.remove('visible');
        } else {
            document.getElementById('lotto-games').classList.remove('visible');
        }
    } else if (game === 'special') {
        APP_STATE.showSpecialGames = !APP_STATE.showSpecialGames;
        APP_STATE.showLottoGames = false;
        
        if (APP_STATE.showSpecialGames) {
            document.getElementById('special-games').classList.add('visible');
            document.getElementById('lotto-games').classList.remove('visible');
        } else {
            document.getElementById('special-games').classList.remove('visible');
        }
    } else if (game === 'borlette') {
        APP_STATE.showLottoGames = false;
        APP_STATE.showSpecialGames = false;
        document.getElementById('lotto-games').classList.remove('visible');
        document.getElementById('special-games').classList.remove('visible');
        selectGame('borlette');
    }
}

// Process Final Ticket with API
async function processFinalTicket() {
    if (APP_STATE.currentCart.length === 0) {
        showNotification("Pa gen anyen nan panye an!", "error");
        return;
    }

    const betsByDraw = {};
    APP_STATE.currentCart.forEach(bet => {
        if (!betsByDraw[bet.drawId]) {
            betsByDraw[bet.drawId] = [];
        }
        
        // Formater les paris pour l'API
        const formattedBet = {
            game: bet.game,
            number: bet.number,
            cleanNumber: bet.cleanNumber,
            amount: bet.amount,
            isAutoGenerated: bet.isAutoGenerated || false,
            specialType: bet.specialType || null
        };
        
        betsByDraw[bet.drawId].push(formattedBet);
    });

    const drawIds = Object.keys(betsByDraw);
    let successCount = 0;
    
    for (const drawId of drawIds) {
        const drawBets = betsByDraw[drawId];
        const draw = CONFIG.DRAWS.find(d => d.drawId === drawId);
        
        const ticketData = {
            drawId: drawId,
            drawName: draw?.name || drawId,
            bets: drawBets,
            total: drawBets.reduce((sum, b) => sum + b.amount, 0)
        };

        try {
            const result = await API.saveTicket(ticketData);
            successCount++;
            
            // Imprimer le ticket
            printThermalTicket({
                ...ticketData,
                ticketId: result.ticketId,
                date: new Date().toLocaleString('fr-FR'),
                agent: APP_STATE.user.name
            });
            
        } catch (error) {
            console.error('Save ticket error:', error);
            showNotification(`Erreur pour le tirage ${draw?.name || drawId}: ${error.message}`, "error");
        }
    }
    
    APP_STATE.currentCart = [];
    CartManager.renderCart();
    
    // Cacher le bouton d'impression après validation
    const printHeaderBtn = document.getElementById('print-header-btn');
    if (printHeaderBtn) {
        printHeaderBtn.style.display = 'none';
    }
    
    if (successCount === drawIds.length) {
        if (drawIds.length === 1) {
            showNotification("Fich sove ak siksè!", "success");
        } else {
            showNotification(`${successCount} fich sove ak siksè!`, "success");
        }
    }
}

// Print Thermal Ticket
function printThermalTicket(ticket) {
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    
    let betsHtml = ticket.bets.map(b => {
        let gameName = '';
        if (b.isAutoGenerated && b.specialType) {
            gameName = b.specialType.toUpperCase();
        } else if (b.isAutoGenerated) {
            gameName = `${b.game.replace('_', ' ').toUpperCase()}*`;
        } else {
            gameName = b.game.toUpperCase();
        }
        
        return `
            <div style="display:flex; justify-content:space-between; font-size:14px;">
                <span>${gameName} ${b.number}</span>
                <span>${b.amount}G</span>
            </div>
        `;
    }).join('');

    const content = `
        <html>
        <head>
            <title>Ticket #${ticket.ticketId}</title>
            <style>
                @media print {
                    body { margin: 0; padding: 0; }
                    .no-print { display: none !important; }
                }
                body { font-family:'Courier New', monospace; width:100%; padding:0; margin:0; text-align:center; }
            </style>
        </head>
        <body>
            <h2 style="margin-bottom:5px;">LOTATO PRO</h2>
            <p style="font-size:12px; margin:0;">Nouvelle Version 2024</p>
            <p style="font-size:12px;">--------------------------</p>
            <p style="font-size:14px; font-weight:bold;">TIRAJ: ${ticket.drawName.toUpperCase()}</p>
            <p style="font-size:12px;">TICKET: #${ticket.ticketId}</p>
            <p style="font-size:12px;">AGENT: ${ticket.agent}</p>
            <p style="font-size:12px;">DATE: ${ticket.date}</p>
            <p style="font-size:12px;">--------------------------</p>
            <div style="text-align:left; padding:0 10px;">
                ${betsHtml}
            </div>
            <p style="font-size:12px;">--------------------------</p>
            <h3 style="margin-top:5px;">TOTAL: ${ticket.total} Gdes</h3>
            <p style="font-size:10px; margin-top:15px;">Mèci paske ou chwazi nou!</p>
            <p style="font-size:10px;">Bòn Chans!</p>
            <br><br>
            <button class="no-print" onclick="window.print()" style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 20px;">Enprime</button>
        </body>
        </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    
    // Auto-print after a delay
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 1000);
}

// Initialize App
async function initApp() {
    // Vérifier l'authentification
    if (!APP_STATE.token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        // Vérifier le profil
        const profile = await API.getProfile();
        if (!profile.success) {
            throw new Error('Session invalide');
        }
        
        APP_STATE.user = profile.user;
        
        // Vérifier que l'utilisateur est un agent
        if (APP_STATE.user.role !== 'agent') {
            localStorage.removeItem('lotato_token');
            localStorage.removeItem('lotato_user');
            window.location.href = 'login.html';
            return;
        }
        
        // Mettre à jour le nom de l'agent dans l'interface
        document.getElementById('agent-name').textContent = APP_STATE.user.name;
        
        // Charger les données
        await renderDraws();
        updateClock();
        
        setupInputAutoMove();
        
        document.getElementById('add-bet-btn').addEventListener('click', () => CartManager.addBet());
        
        updateGameSelector();
        
        // Initialiser les options de lotto
        document.querySelectorAll('#lotto3-options .option-chip').forEach((chip, index) => {
            chip.classList.toggle('active', APP_STATE.lotto3Options[index]);
            chip.querySelector('input').checked = APP_STATE.lotto3Options[index];
        });
        
        document.querySelectorAll('#lotto4-options .option-chip').forEach((chip, index) => {
            chip.classList.toggle('active', APP_STATE.lotto4Options[index]);
            chip.querySelector('input').checked = APP_STATE.lotto4Options[index];
        });
        
        document.querySelectorAll('#lotto5-options .option-chip').forEach((chip, index) => {
            chip.classList.toggle('active', APP_STATE.lotto5Options[index]);
            chip.querySelector('input').checked = APP_STATE.lotto5Options[index];
        });
        
        console.log("LOTATO PRO Ready - Connected to API");
    } catch (error) {
        console.error('Init error:', error);
        if (error.message === 'Session expirée' || error.message.includes('401') || error.message.includes('Session invalide')) {
            localStorage.removeItem('lotato_token');
            localStorage.removeItem('lotato_user');
            window.location.href = 'login.html';
        } else {
            showNotification('Erreur de connexion au serveur: ' + error.message, "error");
        }
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', initApp);
setInterval(updateClock, 1000);

// Service Worker pour PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then(reg => console.log('PWA: Service Worker actif'))
        .catch(err => console.error('PWA: Erreur', err));
}