// Owner Manager avec API
class OwnerManager {
    constructor() {
        this.token = localStorage.getItem('lotato_token');
        this.user = JSON.parse(localStorage.getItem('lotato_user') || '{}');
        this.init();
    }

    async init() {
        if (!this.token || this.user.role !== 'owner') {
            window.location.href = 'login.html';
            return;
        }

        document.getElementById('admin-name').textContent = this.user.name;
        await this.loadDashboard();
        this.setupEventListeners();
    }

    async request(endpoint, options = {}) {
        const url = `/api${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`,
            ...options.headers
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (response.status === 401) {
                this.logout();
                throw new Error('Session expirée');
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Erreur HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            this.showNotification(error.message || 'Erreur de connexion', 'error');
            throw error;
        }
    }

    async loadDashboard() {
        try {
            // Charger les statistiques
            const summary = await this.request('/owner/reports/summary');
            this.updateDashboard(summary);
            
            // Charger les utilisateurs
            const users = await this.request('/owner/users');
            this.renderUsers(users);
            
            // Charger les tirages
            const draws = await this.request('/owner/draws');
            this.renderDraws(draws);
            
            // Charger les nombres bloqués
            const blockedData = await this.request('/owner/blocked-numbers');
            this.renderBlockedNumbers(blockedData);
            
        } catch (error) {
            console.error('Load dashboard error:', error);
        }
    }

    updateDashboard(summary) {
        // Mettre à jour les statistiques du header
        document.getElementById('total-users').textContent = summary.users.total;
        document.getElementById('total-sales').textContent = `${(summary.sales.total/1000).toFixed(1)}K`;
        document.getElementById('online-users').textContent = summary.users.online;
        
        // Mettre à jour le tableau de bord
        document.getElementById('dashboard-users').textContent = summary.users.total;
        document.getElementById('dashboard-sales').textContent = `${summary.sales.total.toLocaleString()} Gdes`;
        document.getElementById('dashboard-tickets').textContent = summary.sales.tickets;
        document.getElementById('dashboard-wins').textContent = `${summary.sales.wins.toLocaleString()} Gdes`;
        document.getElementById('dashboard-blocks').textContent = 0; // À calculer
        document.getElementById('dashboard-draws').textContent = summary.draws.filter(d => d.active).length;
    }

    renderUsers(users) {
        const supervisors = users.filter(u => u.role === 'supervisor');
        const agents = users.filter(u => u.role === 'agent');
        
        // Rendre les superviseurs
        const supervisorsContainer = document.getElementById('supervisors-container');
        supervisorsContainer.innerHTML = supervisors.map(supervisor => `
            <div class="user-card ${supervisor.blocked ? 'blocked' : ''}">
                <div class="user-header">
                    <div class="user-type type-supervisor">SUPERVISEUR</div>
                    <div class="user-status">
                        <span class="status-dot ${supervisor.online ? 'online' : 'offline'}"></span>
                        ${supervisor.online ? 'En ligne' : 'Hors ligne'}
                    </div>
                </div>
                <div class="user-info">
                    <h4>${supervisor.name}</h4>
                    <div class="user-details">
                        <p><strong>ID:</strong> ${supervisor.userId}</p>
                        <p><strong>Email:</strong> ${supervisor.email || 'N/A'}</p>
                        <p><strong>Téléphone:</strong> ${supervisor.phone || 'N/A'}</p>
                    </div>
                </div>
                <div class="user-actions">
                    <button class="btn ${supervisor.blocked ? 'btn-success' : 'btn-danger'} btn-small" 
                            onclick="ownerManager.toggleBlock('user', '${supervisor.userId}', ${!supervisor.blocked})">
                        ${supervisor.blocked ? 'Débloquer' : 'Bloquer'}
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="ownerManager.showUserAgents('${supervisor.userId}')">
                        Voir Agents
                    </button>
                </div>
            </div>
        `).join('');
        
        // Rendre les agents
        const agentsContainer = document.getElementById('agents-container');
        agentsContainer.innerHTML = agents.map(agent => `
            <div class="user-card ${agent.blocked ? 'blocked' : ''}">
                <div class="user-header">
                    <div class="user-type type-agent">AGENT</div>
                    <div class="user-status">
                        <span class="status-dot ${agent.online ? 'online' : 'offline'}"></span>
                        ${agent.online ? 'En ligne' : 'Hors ligne'}
                    </div>
                </div>
                <div class="user-info">
                    <h4>${agent.name}</h4>
                    <div class="user-details">
                        <p><strong>ID:</strong> ${agent.userId}</p>
                        <p><strong>Superviseur:</strong> ${agent.supervisorId || 'N/A'}</p>
                        <p><strong>Localisation:</strong> ${agent.location || 'N/A'}</p>
                        <p><strong>Commission:</strong> ${agent.commission}%</p>
                    </div>
                </div>
                <div class="user-actions">
                    <button class="btn ${agent.blocked ? 'btn-success' : 'btn-danger'} btn-small" 
                            onclick="ownerManager.toggleBlock('user', '${agent.userId}', ${!agent.blocked})">
                        ${agent.blocked ? 'Débloquer' : 'Bloquer'}
                    </button>
                    <button class="btn btn-warning btn-small" onclick="ownerManager.editUser('${agent.userId}')">
                        Éditer
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderDraws(draws) {
        const container = document.getElementById('draws-container');
        container.innerHTML = draws.map(draw => `
            <div class="draw-item ${!draw.active ? 'blocked' : ''}">
                <div class="draw-header">
                    <div class="draw-name">${draw.name}</div>
                    <div class="draw-time">${draw.time}</div>
                </div>
                <div class="draw-stats">
                    <div class="draw-stat">
                        <div style="font-size: 12px; color: var(--text-dim);">Statut</div>
                        <div style="font-weight: bold; color: ${draw.active ? 'var(--success)' : 'var(--danger)'};">${draw.active ? 'ACTIF' : 'INACTIF'}</div>
                    </div>
                    <div class="draw-stat">
                        <div style="font-size: 12px; color: var(--text-dim);">Ventes</div>
                        <div style="font-weight: bold;">${draw.sales || 0} Gdes</div>
                    </div>
                    <div class="draw-stat">
                        <div style="font-size: 12px; color: var(--text-dim);">ID</div>
                        <div style="font-weight: bold; font-family: monospace;">${draw.drawId}</div>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button class="btn ${draw.active ? 'btn-danger' : 'btn-success'} btn-small" 
                            onclick="ownerManager.toggleDrawStatus('${draw.drawId}', ${!draw.active})">
                        ${draw.active ? 'Désactiver' : 'Activer'}
                    </button>
                    <button class="btn btn-info btn-small" onclick="ownerManager.showPublishModal('${draw.drawId}')">
                        Publier Résultats
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderBlockedNumbers(data) {
        const { blockedNumbers, numberLimits } = data;
        
        // Rendre les nombres bloqués
        const grid = document.getElementById('blocks-numbers-grid');
        let numbersHTML = '';
        for (let i = 0; i < 100; i++) {
            const num = i.toString().padStart(2, '0');
            const isBlocked = blockedNumbers.some(item => item.value === num);
            const hasLimit = numberLimits.find(limit => limit.number === num);
            
            let className = 'number-item normal';
            let title = `Boule ${num}`;
            
            if (isBlocked) {
                className = 'number-item blocked';
                title += ' (BLOQUÉ)';
            } else if (hasLimit) {
                className = 'number-item limited';
                title += ` (Limite: ${hasLimit.max} Gdes)`;
            }
            
            numbersHTML += `
                <div class="${className}" title="${title}" onclick="ownerManager.toggleNumberBlock('${num}', ${!isBlocked})">
                    ${num}
                </div>
            `;
        }
        grid.innerHTML = numbersHTML;
        
        // Rendre la liste des nombres bloqués
        const list = document.getElementById('blocked-numbers-list');
        if (blockedNumbers.length === 0) {
            list.innerHTML = '<p style="color: var(--text-dim); text-align: center;">Aucun boule bloqué</p>';
        } else {
            list.innerHTML = blockedNumbers.map(item => `
                <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: white; 
                            border-radius: 8px; margin-bottom: 5px;">
                    <input type="checkbox" id="unblock-${item.value}" value="${item.value}">
                    <label for="unblock-${item.value}" style="flex: 1;">
                        <strong>Boule ${item.value}</strong>
                        <div style="font-size: 12px; color: var(--text-dim);">${item.reason || 'Raison non spécifiée'}</div>
                    </label>
                    <span style="color: var(--danger); font-size: 12px;">
                        <i class="fas fa-ban"></i> Bloqué
                    </span>
                </div>
            `).join('');
        }
    }

    async toggleBlock(type, id, block) {
        try {
            await this.request(`/owner/users/${id}/block`, {
                method: 'PUT',
                body: JSON.stringify({ blocked: block })
            });
            
            this.showNotification(`Utilisateur ${block ? 'bloqué' : 'débloqué'} avec succès`, 'success');
            this.loadDashboard();
        } catch (error) {
            console.error('Toggle block error:', error);
        }
    }

    async toggleDrawStatus(drawId, active) {
        try {
            await this.request(`/owner/draws/${drawId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ active })
            });
            
            this.showNotification(`Tirage ${active ? 'activé' : 'désactivé'} avec succès`, 'success');
            this.loadDashboard();
        } catch (error) {
            console.error('Toggle draw status error:', error);
        }
    }

    async toggleNumberBlock(number, block) {
        try {
            if (block) {
                await this.request('/owner/blocked-numbers', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        numbers: [number],
                        reason: 'Bloqué manuellement par le propriétaire'
                    })
                });
                this.showNotification(`Boule ${number} bloqué avec succès`, 'success');
            } else {
                // Pour débloquer, nous devons implémenter une route DELETE
                // Pour l'instant, on recharge juste les données
                this.showNotification('Fonctionnalité à implémenter', 'warning');
            }
            this.loadDashboard();
        } catch (error) {
            console.error('Toggle number block error:', error);
        }
    }

    showPublishModal(drawId) {
        // Implémenter la modal de publication des résultats
        this.showNotification('Fonctionnalité à implémenter', 'info');
    }

    showCreateUserModal(type) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 20px; padding: 30px; width: 90%; max-width: 500px;">
                <h3>Créer un ${type === 'supervisor' ? 'Superviseur' : 'Agent'}</h3>
                <form id="create-user-form">
                    <div class="form-group">
                        <label>ID Utilisateur:</label>
                        <input type="text" class="form-control" name="userId" required>
                    </div>
                    <div class="form-group">
                        <label>Nom Complet:</label>
                        <input type="text" class="form-control" name="name" required>
                    </div>
                    <div class="form-group">
                        <label>Mot de passe:</label>
                        <input type="password" class="form-control" name="password" required>
                    </div>
                    ${type === 'agent' ? `
                        <div class="form-group">
                            <label>Superviseur:</label>
                            <select class="form-control" name="supervisorId" required>
                                <option value="">Sélectionner un superviseur</option>
                                <!-- Options chargées dynamiquement -->
                            </select>
                        </div>
                    ` : ''}
                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('[style*=\"position: fixed\"]').remove()">Annuler</button>
                        <button type="submit" class="btn btn-success">Créer</button>
                    </div>
                    <input type="hidden" name="role" value="${type}">
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Gérer la soumission du formulaire
        modal.querySelector('form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            try {
                await this.request('/owner/users', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                
                this.showNotification('Utilisateur créé avec succès', 'success');
                modal.remove();
                this.loadDashboard();
            } catch (error) {
                console.error('Create user error:', error);
            }
        });
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'success' ? '#00b09b' : type === 'error' ? '#ff416c' : '#ffb347'};
            color: white;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s;
            display: flex;
            align-items: center;
            gap: 10px;
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
    }

    logout() {
        localStorage.removeItem('lotato_token');
        localStorage.removeItem('lotato_user');
        window.location.href = 'login.html';
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.getAttribute('data-view');
                this.switchView(view);
            });
        });
        
        // Boutons d'action
        document.getElementById('create-supervisor-btn')?.addEventListener('click', () => {
            this.showCreateUserModal('supervisor');
        });
        
        document.getElementById('create-agent-btn')?.addEventListener('click', () => {
            this.showCreateUserModal('agent');
        });
    }

    switchView(viewName) {
        // Cacher toutes les vues
        document.querySelectorAll('.view-content').forEach(view => {
            view.style.display = 'none';
        });
        
        // Activer la vue sélectionnée
        document.getElementById(`${viewName}-view`).style.display = 'block';
        
        // Mettre à jour la navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`.nav-item[data-view="${viewName}"]`).classList.add('active');
    }
}

// Initialiser l'application propriétaire
document.addEventListener('DOMContentLoaded', () => {
    window.ownerManager = new OwnerManager();
});