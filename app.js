// Configuration de l'API
const API_BASE_URL = 'http://localhost:3000/api';

// Variables globales
let currentUser = null;
let currentRole = null;
let currentPaymentTransaction = null;
let currentPaymentTotal = 0;
let selectedPaymentMethod = null;

// Fonctions API
const api = {
    // Authentification
    async login(username, password, role) {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
        });
        return await response.json();
    },

    // Patients
    async getPatients() {
        const response = await fetch(`${API_BASE_URL}/patients`);
        return await response.json();
    },

    async createPatient(patientData) {
        const response = await fetch(`${API_BASE_URL}/patients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patientData)
        });
        return await response.json();
    },

    async getPatientById(id) {
        const response = await fetch(`${API_BASE_URL}/patients/${id}`);
        return await response.json();
    },

    // Consultations
    async getConsultations() {
        const response = await fetch(`${API_BASE_URL}/consultations`);
        return await response.json();
    },

    async createConsultation(consultationData) {
        const response = await fetch(`${API_BASE_URL}/consultations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(consultationData)
        });
        return await response.json();
    },

    // Analyses
    async getAnalyses() {
        const response = await fetch(`${API_BASE_URL}/analyses`);
        return await response.json();
    },

    async createAnalysis(analysisData) {
        const response = await fetch(`${API_BASE_URL}/analyses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(analysisData)
        });
        return await response.json();
    },

    async updateAnalysis(id, results) {
        const response = await fetch(`${API_BASE_URL}/analyses/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results })
        });
        return await response.json();
    },

    // Prescriptions
    async getPrescriptions() {
        const response = await fetch(`${API_BASE_URL}/prescriptions`);
        return await response.json();
    },

    async createPrescription(prescriptionData) {
        const response = await fetch(`${API_BASE_URL}/prescriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prescriptionData)
        });
        return await response.json();
    },

    async updatePrescription(id, delivered) {
        const response = await fetch(`${API_BASE_URL}/prescriptions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delivered })
        });
        return await response.json();
    },

    // Transactions
    async getTransactions() {
        const response = await fetch(`${API_BASE_URL}/transactions`);
        return await response.json();
    },

    async createTransaction(transactionData) {
        const response = await fetch(`${API_BASE_URL}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transactionData)
        });
        return await response.json();
    },

    async updateTransaction(id, status, paymentMethod, paymentDetails) {
        const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, paymentMethod, paymentDetails })
        });
        return await response.json();
    },

    // Stock
    async getStock() {
        const response = await fetch(`${API_BASE_URL}/stock`);
        return await response.json();
    },

    async updateStock(id, quantity) {
        const response = await fetch(`${API_BASE_URL}/stock/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity })
        });
        return await response.json();
    },

    async createStockItem(stockData) {
        const response = await fetch(`${API_BASE_URL}/stock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stockData)
        });
        return await response.json();
    },

    // Rendez-vous
    async getAppointments() {
        const response = await fetch(`${API_BASE_URL}/appointments`);
        return await response.json();
    },

    async createAppointment(appointmentData) {
        const response = await fetch(`${API_BASE_URL}/appointments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appointmentData)
        });
        return await response.json();
    },

    async updateAppointment(id, status) {
        const response = await fetch(`${API_BASE_URL}/appointments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        return await response.json();
    },

    // Employés
    async getEmployees() {
        const response = await fetch(`${API_BASE_URL}/employees`);
        return await response.json();
    },

    async createEmployee(employeeData) {
        const response = await fetch(`${API_BASE_URL}/employees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(employeeData)
        });
        return await response.json();
    },

    async updateEmployee(id, employeeData) {
        const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(employeeData)
        });
        return await response.json();
    },

    async deleteEmployee(id) {
        const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
            method: 'DELETE'
        });
        return await response.json();
    },

    // Présence
    async getAttendance() {
        const response = await fetch(`${API_BASE_URL}/attendance`);
        return await response.json();
    },

    async createAttendance(attendanceData) {
        const response = await fetch(`${API_BASE_URL}/attendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attendanceData)
        });
        return await response.json();
    },

    async updateAttendance(id, checkOut) {
        const response = await fetch(`${API_BASE_URL}/attendance/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkOut })
        });
        return await response.json();
    },

    // Urgences
    async getEmergencyPatients() {
        const response = await fetch(`${API_BASE_URL}/emergency`);
        return await response.json();
    },

    async createEmergencyPatient(emergencyData) {
        const response = await fetch(`${API_BASE_URL}/emergency`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emergencyData)
        });
        return await response.json();
    },

    async updateEmergencyPatient(id, emergencyData) {
        const response = await fetch(`${API_BASE_URL}/emergency/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emergencyData)
        });
        return await response.json();
    },

    // Statistiques
    async getDashboardStats() {
        const response = await fetch(`${API_BASE_URL}/stats/dashboard`);
        return await response.json();
    },

    async getAdminStats() {
        const response = await fetch(`${API_BASE_URL}/stats/admin`);
        return await response.json();
    }
};

// Données constantes
const servicePrices = {
    'Consultation': 500,
    'Consultation Urgence': 800,
    'Analyse': 300,
    'Analyse Urgence': 500,
    'Médicament': 0
};

const externalServices = [
    { name: 'Pansement', price: 150 },
    { name: 'Piqûre', price: 200 },
    { name: 'Planning familial', price: 300 },
    { name: 'Vaccination', price: 250 },
    { name: 'Soins infirmiers', price: 180 },
    { name: 'Prélèvement sanguin', price: 120 }
];

const paymentMethods = [
    { id: 'cash', name: 'Cash', icon: 'fas fa-money-bill-wave', needsDetails: true },
    { id: 'moncash', name: 'Mon Cash', icon: 'fas fa-mobile-alt', needsDetails: true, isMobile: true },
    { id: 'natcash', name: 'NatCash', icon: 'fas fa-phone-alt', needsDetails: true, isMobile: true },
    { id: 'debit', name: 'Carte Débit', icon: 'fas fa-credit-card', needsDetails: true },
    { id: 'credit', name: 'Carte Credit', icon: 'fas fa-credit-card', needsDetails: true },
    { id: 'mastercard', name: 'Master Card', icon: 'fab fa-cc-mastercard', needsDetails: true },
    { id: 'bank-transfer', name: 'Virement Bancaire', icon: 'fas fa-university', needsDetails: true }
];

// Fonctions utilitaires
function getRoleName(role) {
    const roles = {
        'admin': 'Administrateur',
        'doctor': 'Docteur',
        'lab': 'Technicien de Laboratoire',
        'pharmacy': 'Pharmacien',
        'reception': 'Réceptionniste',
        'cashier': 'Caissier'
    };
    return roles[role] || 'Utilisateur';
}

function showAlert(message, type) {
    // Supprimer les alertes existantes
    document.querySelectorAll('.alert').forEach(alert => {
        if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
        }
    });
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        ${message}
        <button type="button" class="close-alert" style="float: right; background: none; border: none; font-size: 1.2rem; cursor: pointer;">&times;</button>
    `;
    
    const currentContent = document.querySelector('.content.active');
    if (currentContent) {
        currentContent.insertBefore(alertDiv, currentContent.firstChild);
    }
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
    
    alertDiv.querySelector('.close-alert').addEventListener('click', function() {
        alertDiv.remove();
    });
}

function printContentDirectly(content, title = 'Document') {
    const printContainer = document.getElementById('print-container');
    printContainer.innerHTML = `
        <div class="printable">
            ${content}
        </div>
    `;
    
    // Attendre que le DOM soit mis à jour
    setTimeout(() => {
        window.print();
        
        // Nettoyer après impression
        setTimeout(() => {
            printContainer.innerHTML = '';
        }, 100);
    }, 100);
}

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

async function initApp() {
    setupLogin();
    setupNavigation();
    setupPatients();
    setupConsultation();
    setupAppointments();
    setupLaboratory();
    setupPharmacy();
    setupCashier();
    setupAdministration();
    setupEmployees();
    setupEmergency();
    
    // Charger les données initiales
    await updateDashboard();
}

function setupLogin() {
    const roleButtons = document.querySelectorAll('.login-role-btn');
    const loginForm = document.getElementById('login-form');
    
    roleButtons.forEach(button => {
        button.addEventListener('click', function() {
            roleButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    document.querySelector('.login-role-btn[data-role="admin"]').classList.add('active');
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const selectedRole = document.querySelector('.login-role-btn.active').getAttribute('data-role');
        
        if (!username || !password) {
            showAlert('Veuillez entrer un nom d\'utilisateur et un mot de passe', 'warning');
            return;
        }
        
        try {
            const result = await api.login(username, password, selectedRole);
            
            if (result.success) {
                currentUser = username;
                currentRole = selectedRole;
                
                document.getElementById('current-username').textContent = username;
                document.getElementById('current-user-role').textContent = getRoleName(selectedRole);
                
                document.getElementById('login-screen').classList.add('hidden');
                document.getElementById('main-app').classList.remove('hidden');
                
                showAlert('Connexion réussie! Bienvenue ' + username, 'success');
                
                updatePermissions();
                await updateDashboard();
            } else {
                showAlert('Identifiants incorrects', 'danger');
            }
        } catch (error) {
            showAlert('Erreur de connexion au serveur', 'danger');
            console.error('Login error:', error);
        }
    });
    
    document.getElementById('logout-btn').addEventListener('click', function() {
        currentUser = null;
        currentRole = null;
        
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
        
        document.getElementById('login-form').reset();
        document.querySelectorAll('.login-role-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.login-role-btn[data-role="admin"]').classList.add('active');
    });
}

function updatePermissions() {
    const role = currentRole;
    
    // Montrer/Masquer le total employé
    const employeeTotalDiv = document.getElementById('employee-today-total');
    if (role !== 'admin') {
        employeeTotalDiv.classList.remove('hidden');
        updateEmployeeTodayTotal();
    } else {
        employeeTotalDiv.classList.add('hidden');
    }
    
    // Gestion des permissions pharmacie
    const addMedicationBtn = document.getElementById('add-medication-btn');
    const stockPermissionLabel = document.getElementById('stock-permission-label');
    
    if (role === 'admin') {
        addMedicationBtn.classList.remove('hidden');
        stockPermissionLabel.textContent = 'Administration seulement';
    } else if (role === 'pharmacy') {
        addMedicationBtn.classList.add('hidden');
        stockPermissionLabel.textContent = 'Vue seulement';
    } else {
        addMedicationBtn.classList.add('hidden');
        stockPermissionLabel.textContent = 'Vue seulement';
    }
    
    // Rendez-vous docteur
    const doctorAppointmentsDiv = document.getElementById('doctor-appointments-dashboard');
    if (role === 'doctor' || role === 'admin') {
        doctorAppointmentsDiv.classList.remove('hidden');
        updateDoctorAppointmentsDashboard();
    } else {
        doctorAppointmentsDiv.classList.add('hidden');
    }
    
    // Gestion des employés (admin seulement)
    const addEmployeeBtn = document.getElementById('add-employee-btn');
    const employeeAdminSection = document.getElementById('employee-admin-section');
    const employeeManagementForm = document.getElementById('employee-management-form');
    
    if (role === 'admin') {
        addEmployeeBtn.classList.remove('hidden');
        employeeAdminSection.classList.remove('hidden');
    } else {
        addEmployeeBtn.classList.add('hidden');
        employeeAdminSection.classList.add('hidden');
        employeeManagementForm.classList.add('hidden');
    }
    
    // Services externes (caisse seulement)
    const externalServicesSection = document.getElementById('external-services-section');
    if (role === 'cashier' || role === 'admin') {
        externalServicesSection.classList.remove('hidden');
    } else {
        externalServicesSection.classList.add('hidden');
    }
    
    // Montrer tous les onglets pour admin
    if (role === 'admin') {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.style.display = 'flex';
        });
        return;
    }
    
    // Pour les autres rôles, afficher seulement les onglets pertinents
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.style.display = 'none';
    });
    
    if (role === 'doctor') {
        document.querySelector('[data-target="dashboard"]').style.display = 'flex';
        document.querySelector('[data-target="patients"]').style.display = 'flex';
        document.querySelector('[data-target="consultation"]').style.display = 'flex';
        document.querySelector('[data-target="appointments"]').style.display = 'flex';
        document.querySelector('[data-target="emergency"]').style.display = 'flex';
    } else if (role === 'lab') {
        document.querySelector('[data-target="dashboard"]').style.display = 'flex';
        document.querySelector('[data-target="laboratory"]').style.display = 'flex';
        document.querySelector('[data-target="emergency"]').style.display = 'flex';
    } else if (role === 'pharmacy') {
        document.querySelector('[data-target="dashboard"]').style.display = 'flex';
        document.querySelector('[data-target="pharmacy"]').style.display = 'flex';
        document.querySelector('[data-target="emergency"]').style.display = 'flex';
    } else if (role === 'reception') {
        document.querySelector('[data-target="dashboard"]').style.display = 'flex';
        document.querySelector('[data-target="patients"]').style.display = 'flex';
        document.querySelector('[data-target="appointments"]').style.display = 'flex';
        document.querySelector('[data-target="emergency"]').style.display = 'flex';
    } else if (role === 'cashier') {
        document.querySelector('[data-target="dashboard"]').style.display = 'flex';
        document.querySelector('[data-target="cashier"]').style.display = 'flex';
        document.querySelector('[data-target="emergency"]').style.display = 'flex';
    }
}

function setupNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            showContent(target);
            
            if (target === 'cashier') {
                updateCashierTotals();
            }
            
            if (target === 'appointments') {
                updateAppointmentsLists();
            }
            
            if (target === 'emergency') {
                updateEmergencyPatientsTable();
            }
            
            if (currentRole !== 'admin') {
                updateEmployeeTodayTotal();
            }
        });
    });
}

function showContent(contentId) {
    document.querySelectorAll('.content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.getElementById(contentId).classList.add('active');
}

function setupPatients() {
    const patientForm = document.getElementById('patient-form');
    const printCardBtn = document.getElementById('print-card-btn');
    const closeCardBtn = document.getElementById('close-card-btn');
    
    patientForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const isPediatric = document.getElementById('patient-pediatric').checked;
        const isEmergency = document.getElementById('patient-emergency').checked;
        
        const patientData = {
            name: document.getElementById('patient-name').value,
            dob: document.getElementById('patient-dob').value,
            birthplace: document.getElementById('patient-birthplace').value,
            phone: document.getElementById('patient-phone').value,
            address: document.getElementById('patient-address').value,
            responsible: document.getElementById('patient-responsible').value,
            pediatric: isPediatric,
            emergency: isEmergency,
            registrationDate: new Date().toISOString(),
            registeredBy: currentUser
        };
        
        try {
            const result = await api.createPatient(patientData);
            
            if (result.success) {
                showAlert('Patient enregistré avec succès! Numéro: ' + result.patientId, 'success');
                patientForm.reset();
                await updatePatientsTable();
                await updateDashboard();
                
                // Afficher la carte du patient
                displayPatientCard(result.patient);
            } else {
                showAlert('Erreur lors de l\'enregistrement du patient', 'danger');
            }
        } catch (error) {
            showAlert('Erreur de connexion au serveur', 'danger');
            console.error('Create patient error:', error);
        }
    });
    
    printCardBtn.addEventListener('click', function() {
        const printContent = document.getElementById('print-area').innerHTML;
        printContentDirectly(printContent, 'Carte du Patient');
    });
    
    closeCardBtn.addEventListener('click', function() {
        document.getElementById('patient-card-preview').classList.add('hidden');
    });
    
    // Charger la liste des patients au chargement
    updatePatientsTable();
}

async function updatePatientsTable() {
    try {
        const patients = await api.getPatients();
        const tableBody = document.getElementById('patients-table-body');
        tableBody.innerHTML = '';
        
        patients.forEach(patient => {
            let typeText = '';
            if (patient.emergency) {
                typeText = '<span class="emergency-patient-tag">URGENCE</span>';
            } else if (patient.pediatric) {
                typeText = '<span class="pediatric-tag">PÉDIATRIE</span>';
            } else {
                typeText = 'Normal';
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${patient.id}</td>
                <td>${patient.name}</td>
                <td>${new Date(patient.dob).toLocaleDateString('fr-FR')}</td>
                <td>${patient.phone || 'N/A'}</td>
                <td>${new Date(patient.registrationDate).toLocaleDateString('fr-FR')}</td>
                <td>${typeText}</td>
                <td>
                    <button class="btn btn-secondary" onclick="viewPatient('${patient.id}')">
                        <i class="fas fa-eye"></i> Voir
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading patients:', error);
        showAlert('Erreur de chargement des patients', 'danger');
    }
}

async function viewPatient(patientId) {
    try {
        const patient = await api.getPatientById(patientId);
        if (patient) {
            displayPatientCard(patient);
            document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
            document.querySelector('[data-target="patients"]').classList.add('active');
            showContent('patients');
        }
    } catch (error) {
        showAlert('Erreur de chargement du patient', 'danger');
        console.error('View patient error:', error);
    }
}

function displayPatientCard(patient) {
    document.getElementById('card-patient-id').textContent = patient.id;
    document.getElementById('card-patient-name').textContent = patient.name;
    document.getElementById('card-patient-dob').textContent = new Date(patient.dob).toLocaleDateString('fr-FR');
    document.getElementById('card-patient-birthplace').textContent = patient.birthplace;
    document.getElementById('card-patient-responsible').textContent = patient.responsible || 'N/A';
    document.getElementById('card-patient-date').textContent = new Date(patient.registrationDate).toLocaleDateString('fr-FR');
    
    const printArea = document.getElementById('print-area').innerHTML;
    document.getElementById('patient-card-display').innerHTML = printArea;
    
    document.getElementById('patient-card-preview').classList.remove('hidden');
}

function setupConsultation() {
    const searchBtn = document.getElementById('search-patient-btn');
    const consultationForm = document.getElementById('consultation-form');
    const scheduleAppointmentBtn = document.getElementById('schedule-appointment-btn');
    const checkMedicationsBtn = document.getElementById('check-medications-btn');
    const addMedicationRowBtn = document.getElementById('add-medication-row-btn');
    
    // Ajouter une ligne au tableau des médicaments
    addMedicationRowBtn.addEventListener('click', function() {
        const tableBody = document.getElementById('medication-table-body');
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td><input type="text" class="form-control medication-name" placeholder="Paracétamol 500mg"></td>
            <td><input type="text" class="form-control medication-dosage" placeholder="1 comprimé"></td>
            <td><input type="text" class="form-control medication-frequency" placeholder="3 fois par jour"></td>
            <td><input type="text" class="form-control medication-duration" placeholder="5 jours"></td>
            <td><button type="button" class="btn btn-danger remove-medication-btn"><i class="fas fa-trash"></i></button></td>
        `;
        tableBody.appendChild(newRow);
        
        // Ajouter l'événement pour supprimer la ligne
        newRow.querySelector('.remove-medication-btn').addEventListener('click', function() {
            newRow.remove();
        });
    });
    
    // Initialiser l'événement pour supprimer la première ligne
    document.querySelector('.remove-medication-btn').addEventListener('click', function() {
        this.closest('tr').remove();
    });
    
    searchBtn.addEventListener('click', async function() {
        const patientId = document.getElementById('search-patient-id').value;
        try {
            const patient = await api.getPatientById(patientId);
            
            if (patient) {
                displayPatientForConsultation(patient);
                document.getElementById('consultation-form-container').classList.remove('hidden');
            } else {
                showAlert('Patient non trouvé. Vérifiez le numéro.', 'warning');
            }
        } catch (error) {
            showAlert('Erreur de recherche du patient', 'danger');
            console.error('Search patient error:', error);
        }
    });
    
    checkMedicationsBtn.addEventListener('click', async function() {
        const medications = getMedicationsFromTable();
        if (medications.length === 0) {
            showAlert('Veuillez ajouter au moins un médicament', 'warning');
            return;
        }
        
        await checkMedicationsAvailability(medications);
    });
    
    scheduleAppointmentBtn.addEventListener('click', function() {
        const patientId = document.getElementById('search-patient-id').value;
        if (patientId) {
            document.getElementById('appointment-patient-id').value = patientId;
            
            document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
            document.querySelector('[data-target="appointments"]').classList.add('active');
            showContent('appointments');
            
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('appointment-date').value = tomorrow.toISOString().split('T')[0];
        } else {
            showAlert('Veuillez d\'abord rechercher un patient', 'warning');
        }
    });
    
    consultationForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const patientId = document.getElementById('search-patient-id').value;
        const diagnosis = document.getElementById('consultation-diagnosis').value;
        const notes = document.getElementById('consultation-notes').value;
        const otherAnalysis = document.getElementById('consultation-other-analysis').value;
        
        const selectedAnalyses = [];
        document.querySelectorAll('.checkbox-item input[type="checkbox"]:checked').forEach(cb => {
            selectedAnalyses.push(cb.value);
        });
        
        if (otherAnalysis.trim() !== '') {
            selectedAnalyses.push(otherAnalysis);
        }
        
        const analyses = selectedAnalyses.join(', ');
        
        // Récupérer les médicaments du tableau
        const medications = getMedicationsFromTable();
        
        try {
            const patient = await api.getPatientById(patientId);
            const isEmergency = patient && patient.emergency;
            
            const consultationData = {
                patientId: patientId,
                doctor: currentUser,
                diagnosis: diagnosis,
                medications: medications,
                analyses: analyses,
                notes: notes,
                emergency: isEmergency
            };
            
            const result = await api.createConsultation(consultationData);
            
            if (result.success) {
                // Créer les analyses si nécessaire
                if (analyses.trim() !== '') {
                    const analysisData = {
                        patientId: patientId,
                        consultationId: result.consultationId,
                        analyses: analyses,
                        emergency: isEmergency
                    };
                    await api.createAnalysis(analysisData);
                }
                
                // Créer les prescriptions
                for (const medication of medications) {
                    const prescriptionData = {
                        patientId: patientId,
                        consultationId: result.consultationId,
                        prescription: `${medication.name} - ${medication.dosage} ${medication.frequency} pendant ${medication.duration}`,
                        emergency: isEmergency
                    };
                    await api.createPrescription(prescriptionData);
                }
                
                // Créer la transaction
                const consultationType = isEmergency ? 'Consultation Urgence' : 'Consultation';
                const consultationFee = isEmergency ? servicePrices['Consultation Urgence'] : servicePrices['Consultation'];
                
                const transactionData = {
                    patientId: patientId,
                    service: consultationType,
                    amount: consultationFee,
                    doctor: currentUser,
                    emergency: isEmergency
                };
                await api.createTransaction(transactionData);
                
                // Si c'est une urgence, ajouter au suivi des urgences
                if (isEmergency) {
                    const emergencyData = {
                        patientId: patientId,
                        doctor: currentUser,
                        status: 'En traitement',
                        active: true,
                        notes: ''
                    };
                    await api.createEmergencyPatient(emergencyData);
                }
                
                consultationForm.reset();
                document.getElementById('consultation-form-container').classList.add('hidden');
                document.getElementById('consultation-patient-info').classList.add('hidden');
                document.getElementById('medication-check-results').innerHTML = '';
                
                // Réinitialiser le tableau des médicaments
                const tableBody = document.getElementById('medication-table-body');
                tableBody.innerHTML = `
                    <tr>
                        <td><input type="text" class="form-control medication-name" placeholder="Paracétamol 500mg"></td>
                        <td><input type="text" class="form-control medication-dosage" placeholder="1 comprimé"></td>
                        <td><input type="text" class="form-control medication-frequency" placeholder="3 fois par jour"></td>
                        <td><input type="text" class="form-control medication-duration" placeholder="5 jours"></td>
                        <td><button type="button" class="btn btn-danger remove-medication-btn"><i class="fas fa-trash"></i></button></td>
                    </tr>
                `;
                
                document.querySelectorAll('.checkbox-item input[type="checkbox"]').forEach(cb => {
                    cb.checked = false;
                });
                
                showAlert('Consultation enregistrée avec succès!', 'success');
                await updateDashboard();
                await updateEmployeeTodayTotal();
            } else {
                showAlert('Erreur lors de l\'enregistrement de la consultation', 'danger');
            }
        } catch (error) {
            showAlert('Erreur lors de l\'enregistrement', 'danger');
            console.error('Create consultation error:', error);
        }
    });
}

function getMedicationsFromTable() {
    const medications = [];
    const rows = document.querySelectorAll('#medication-table-body tr');
    
    rows.forEach(row => {
        const name = row.querySelector('.medication-name').value.trim();
        const dosage = row.querySelector('.medication-dosage').value.trim();
        const frequency = row.querySelector('.medication-frequency').value.trim();
        const duration = row.querySelector('.medication-duration').value.trim();
        
        if (name && dosage && frequency && duration) {
            medications.push({
                name: name,
                dosage: dosage,
                frequency: frequency,
                duration: duration
            });
        }
    });
    
    return medications;
}

async function checkMedicationsAvailability(medications) {
    const resultsContainer = document.getElementById('medication-check-results');
    resultsContainer.innerHTML = '';
    
    if (medications.length === 0) {
        resultsContainer.innerHTML = '<div class="alert alert-info">Aucun médicament à vérifier.</div>';
        return;
    }
    
    try {
        const stock = await api.getStock();
        let unavailableMeds = [];
        let availableMeds = [];
        
        medications.forEach(med => {
            const medName = med.name.toLowerCase();
            let found = false;
            let available = false;
            
            for (const stockItem of stock) {
                if (medName.includes(stockItem.medication.toLowerCase()) || 
                    stockItem.medication.toLowerCase().includes(medName)) {
                    found = true;
                    if (stockItem.quantity > 0) {
                        availableMeds.push({
                            medication: med,
                            stock: stockItem.quantity,
                            price: stockItem.price
                        });
                        available = true;
                    } else {
                        unavailableMeds.push({
                            medication: med,
                            reason: 'Stock épuisé'
                        });
                    }
                    break;
                }
            }
            
            if (!found) {
                unavailableMeds.push({
                    medication: med,
                    reason: 'Non disponible à l\'hôpital'
                });
            }
        });
        
        let html = '<div class="card"><h4>Vérification de disponibilité des médicaments</h4>';
        
        if (availableMeds.length > 0) {
            html += '<h5 class="medication-available">Médicaments disponibles:</h5><ul>';
            availableMeds.forEach(med => {
                html += `<li>${med.medication.name} - ${med.medication.dosage} ${med.medication.frequency} pendant ${med.medication.duration} <span class="text-success">(Stock: ${med.stock}, Prix: ${med.price} Gdes)</span></li>`;
            });
            html += '</ul>';
        }
        
        if (unavailableMeds.length > 0) {
            html += '<h5 class="medication-unavailable">Médicaments non disponibles:</h5><ul>';
            unavailableMeds.forEach(med => {
                html += `<li>${med.medication.name} - ${med.medication.dosage} ${med.medication.frequency} pendant ${med.medication.duration} <span class="text-danger">(${med.reason})</span></li>`;
            });
            html += '</ul>';
            
            html += `<button id="print-external-prescription-btn" class="btn btn-warning">
                <i class="fas fa-print"></i> Imprimer prescription pour pharmacie externe
            </button>`;
        }
        
        html += '</div>';
        resultsContainer.innerHTML = html;
        
        if (unavailableMeds.length > 0) {
            document.getElementById('print-external-prescription-btn').addEventListener('click', function() {
                const patientId = document.getElementById('search-patient-id').value;
                printExternalPrescription(patientId, unavailableMeds);
            });
        }
    } catch (error) {
        showAlert('Erreur de vérification du stock', 'danger');
        console.error('Check medications error:', error);
    }
}

async function printExternalPrescription(patientId, unavailableMeds) {
    try {
        const patient = await api.getPatientById(patientId);
        
        if (patient) {
            let receiptHtml = `
                <div class="receipt">
                    <div class="receipt-header">
                        <h3>Hôpital Saint-Luc</h3>
                        <p>Reçu d'achat de médicaments</p>
                        <p>Date: ${new Date().toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div>
                        <p><strong>Patient:</strong> ${patient.name}</p>
                        <p><strong>Numéro:</strong> ${patient.id}</p>
                        <p><strong>Docteur:</strong> ${currentUser}</p>
                    </div>
                    <h4>Médicaments à acheter:</h4>
            `;
            
            unavailableMeds.forEach(med => {
                const medText = `${med.medication.name} - ${med.medication.dosage} ${med.medication.frequency} pendant ${med.medication.duration}`;
                receiptHtml += `<div class="receipt-item"><span>${medText}</span><span>À acheter</span></div>`;
            });
            
            receiptHtml += `
                    <div class="receipt-total">
                        <span>Total estimé:</span>
                        <span>À déterminer à la pharmacie</span>
                    </div>
                    <p class="text-center" style="margin-top: 15px; font-size: 0.9rem;">
                        Présentez ce reçu à la pharmacie externe
                    </p>
                </div>
            `;
            
            printContentDirectly(receiptHtml, 'Prescription Médicaments');
        }
    } catch (error) {
        showAlert('Erreur lors de l\'impression', 'danger');
        console.error('Print prescription error:', error);
    }
}

function displayPatientForConsultation(patient) {
    const detailsContainer = document.getElementById('consultation-patient-details');
    const emergencyTag = patient.emergency ? '<span class="emergency-patient-tag">URGENCE</span>' : '';
    const pediatricTag = patient.pediatric ? '<span class="pediatric-tag">PÉDIATRIE</span>' : '';
    
    detailsContainer.innerHTML = `
        <div class="patient-info-item">
            <div class="patient-info-label">Numéro patient:</div>
            <div>${patient.id} ${emergencyTag} ${pediatricTag}</div>
        </div>
        <div class="patient-info-item">
            <div class="patient-info-label">Nom:</div>
            <div>${patient.name}</div>
        </div>
        <div class="patient-info-item">
            <div class="patient-info-label">Date de naissance:</div>
            <div>${new Date(patient.dob).toLocaleDateString('fr-FR')}</div>
        </div>
        <div class="patient-info-item">
            <div class="patient-info-label">Téléphone:</div>
            <div>${patient.phone || 'N/A'}</div>
        </div>
        <div class="patient-info-item">
            <div class="patient-info-label">Date d'enregistrement:</div>
            <div>${new Date(patient.registrationDate).toLocaleDateString('fr-FR')}</div>
        </div>
    `;
    
    document.getElementById('consultation-patient-info').classList.remove('hidden');
}

function setupAppointments() {
    const appointmentForm = document.getElementById('appointment-form');
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('appointment-date').min = today;
    
    appointmentForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const patientId = document.getElementById('appointment-patient-id').value;
        const doctor = document.getElementById('appointment-doctor').value;
        const date = document.getElementById('appointment-date').value;
        const time = document.getElementById('appointment-time').value;
        const reason = document.getElementById('appointment-reason').value;
        
        try {
            const patient = await api.getPatientById(patientId);
            
            if (!patient) {
                showAlert('Patient non trouvé. Vérifiez le numéro.', 'warning');
                return;
            }
            
            const appointmentData = {
                patientId: patientId,
                patientName: patient.name,
                doctor: doctor,
                date: date,
                time: time,
                reason: reason,
                createdBy: currentUser
            };
            
            const result = await api.createAppointment(appointmentData);
            
            if (result.success) {
                appointmentForm.reset();
                await updateAppointmentsLists();
                await updateDashboard();
                showAlert('Rendez-vous planifié avec succès!', 'success');
            } else {
                showAlert('Erreur lors de la planification du rendez-vous', 'danger');
            }
        } catch (error) {
            showAlert('Erreur lors de la planification', 'danger');
            console.error('Create appointment error:', error);
        }
    });
    
    // Charger les rendez-vous au chargement
    updateAppointmentsLists();
}

async function updateAppointmentsLists() {
    try {
        const appointments = await api.getAppointments();
        const upcomingList = document.getElementById('upcoming-appointments-list');
        const pastList = document.getElementById('past-appointments-list');
        
        upcomingList.innerHTML = '';
        pastList.innerHTML = '';
        
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        const upcoming = appointments.filter(apt => {
            const aptDate = new Date(apt.date);
            return aptDate >= today && apt.status === 'scheduled';
        });
        
        const past = appointments.filter(apt => {
            const aptDate = new Date(apt.date);
            return aptDate < today || apt.status !== 'scheduled';
        });
        
        upcoming.sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time));
        past.sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));
        
        if (upcoming.length === 0) {
            upcomingList.innerHTML = '<p class="text-center">Aucun rendez-vous à venir</p>';
        } else {
            upcoming.forEach(appointment => {
                const isToday = appointment.date === todayStr;
                const card = document.createElement('div');
                card.className = `appointment-card ${isToday ? 'urgent' : ''}`;
                card.innerHTML = `
                    <div class="d-flex justify-between">
                        <div>
                            <h4>${appointment.patientName} <small>(${appointment.patientId})</small></h4>
                            <p><strong>Docteur:</strong> ${appointment.doctor}</p>
                            <p><strong>Raison:</strong> ${appointment.reason || 'Non spécifiée'}</p>
                        </div>
                        <div class="text-right">
                            <div class="appointment-time">${appointment.time}</div>
                            <div>${new Date(appointment.date).toLocaleDateString('fr-FR')}</div>
                            ${isToday ? '<div class="text-danger"><strong>Aujourd\'hui</strong></div>' : ''}
                        </div>
                    </div>
                    <div class="text-right mt-2">
                        <button class="btn btn-secondary" onclick="cancelAppointment('${appointment.id}')">
                            <i class="fas fa-times"></i> Annuler
                        </button>
                        <button class="btn" onclick="completeAppointment('${appointment.id}')">
                            <i class="fas fa-check"></i> Terminer
                        </button>
                    </div>
                `;
                upcomingList.appendChild(card);
            });
        }
        
        if (past.length === 0) {
            pastList.innerHTML = '<p class="text-center">Aucun rendez-vous passé</p>';
        } else {
            past.forEach(appointment => {
                const card = document.createElement('div');
                card.className = 'appointment-card past';
                card.innerHTML = `
                    <div class="d-flex justify-between">
                        <div>
                            <h4>${appointment.patientName} <small>(${appointment.patientId})</small></h4>
                            <p><strong>Docteur:</strong> ${appointment.doctor}</p>
                            <p><strong>Raison:</strong> ${appointment.reason || 'Non spécifiée'}</p>
                            <p><strong>Statut:</strong> ${appointment.status === 'completed' ? 'Terminé' : 'Annulé'}</p>
                        </div>
                        <div class="text-right">
                            <div class="appointment-time">${appointment.time}</div>
                            <div>${new Date(appointment.date).toLocaleDateString('fr-FR')}</div>
                        </div>
                    </div>
                `;
                pastList.appendChild(card);
            });
        }
        
        await updateDashboard();
    } catch (error) {
        console.error('Error loading appointments:', error);
        showAlert('Erreur de chargement des rendez-vous', 'danger');
    }
}

async function updateDoctorAppointmentsDashboard() {
    try {
        const appointments = await api.getAppointments();
        const today = new Date().toISOString().split('T')[0];
        const doctorAppointments = appointments.filter(apt => 
            apt.date === today && 
            apt.status === 'scheduled' &&
            (apt.doctor === currentUser || currentRole === 'admin')
        );
        
        const list = document.getElementById('today-appointments-list');
        list.innerHTML = '';
        
        if (doctorAppointments.length === 0) {
            list.innerHTML = '<p class="text-center">Aucun rendez-vous aujourd\'hui</p>';
        } else {
            doctorAppointments.forEach(appointment => {
                const card = document.createElement('div');
                card.className = 'appointment-card urgent';
                card.innerHTML = `
                    <div class="d-flex justify-between">
                        <div>
                            <h4>${appointment.patientName}</h4>
                            <p><strong>Heure:</strong> ${appointment.time}</p>
                            <p><strong>Raison:</strong> ${appointment.reason || 'Non spécifiée'}</p>
                        </div>
                        <div class="text-right">
                            <button class="btn" onclick="startConsultationFromAppointment('${appointment.patientId}')">
                                <i class="fas fa-stethoscope"></i> Commencer
                            </button>
                        </div>
                    </div>
                `;
                list.appendChild(card);
            });
        }
    } catch (error) {
        console.error('Error loading doctor appointments:', error);
    }
}

function startConsultationFromAppointment(patientId) {
    document.getElementById('search-patient-id').value = patientId;
    document.getElementById('search-patient-btn').click();
    
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector('[data-target="consultation"]').classList.add('active');
    showContent('consultation');
}

async function cancelAppointment(appointmentId) {
    try {
        const result = await api.updateAppointment(appointmentId, 'cancelled');
        if (result.success) {
            await updateAppointmentsLists();
            await updateDoctorAppointmentsDashboard();
            showAlert('Rendez-vous annulé', 'info');
        }
    } catch (error) {
        showAlert('Erreur lors de l\'annulation', 'danger');
        console.error('Cancel appointment error:', error);
    }
}

async function completeAppointment(appointmentId) {
    try {
        const result = await api.updateAppointment(appointmentId, 'completed');
        if (result.success) {
            await updateAppointmentsLists();
            await updateDoctorAppointmentsDashboard();
            showAlert('Rendez-vous marqué comme terminé', 'success');
        }
    } catch (error) {
        showAlert('Erreur lors de la mise à jour', 'danger');
        console.error('Complete appointment error:', error);
    }
}

function setupLaboratory() {
    const searchBtn = document.getElementById('lab-search-btn');
    
    searchBtn.addEventListener('click', async function() {
        const patientId = document.getElementById('lab-patient-id').value;
        try {
            const patient = await api.getPatientById(patientId);
            if (patient) {
                await displayLabResults(patient);
            } else {
                showAlert('Patient non trouvé. Vérifiez le numéro.', 'warning');
            }
        } catch (error) {
            showAlert('Erreur de recherche du patient', 'danger');
            console.error('Lab search error:', error);
        }
    });
    
    // Charger les analyses au chargement
    updateLaboratoryTable();
}

async function displayLabResults(patient) {
    const container = document.getElementById('lab-results-container');
    
    try {
        const analyses = await api.getAnalyses();
        const patientAnalyses = analyses.filter(a => a.patientId === patient.id && (a.status === 'paid' || patient.emergency));
        
        if (patientAnalyses.length === 0) {
            // Si aucune analyse, vérifier s'il y a des analyses en attente de paiement
            const pendingAnalyses = analyses.filter(a => a.patientId === patient.id && a.status === 'pending-payment');
            if (pendingAnalyses.length > 0 && !patient.emergency) {
                container.innerHTML = '<div class="alert alert-warning">Les analyses sont en attente de paiement. Veuillez payer à la caisse d\'abord.</div>';
            } else {
                container.innerHTML = '<div class="alert alert-info">Aucune analyse trouvée pour ce patient.</div>';
            }
        } else {
            let html = '<div class="card"><h3>Analyses du Patient</h3>';
            
            for (const analysis of patientAnalyses) {
                const isEmergency = analysis.emergency || (patient && patient.emergency);
                const emergencyTag = isEmergency ? '<span class="emergency-patient-tag">URGENCE</span>' : '';
                
                html += `
                    <div class="mb-3">
                        <h4>Analyse ${analysis.id} ${emergencyTag}</h4>
                        <p><strong>Demandé par:</strong> ${analysis.doctor || 'N/A'}</p>
                        <p><strong>Date:</strong> ${new Date(analysis.date).toLocaleDateString('fr-FR')}</p>
                        <p><strong>Analyses demandées:</strong> ${analysis.analyses}</p>
                        <p><strong>Statut paiement:</strong> ${analysis.status === 'paid' ? 'Payé' : 'En attente'}</p>
                        
                        <div class="form-group">
                            <label class="form-label">Résultats</label>
                            <textarea class="form-control analysis-results" data-id="${analysis.id}" rows="3">${analysis.results || ''}</textarea>
                        </div>
                        <button class="btn btn-success save-results-btn" data-id="${analysis.id}">
                            <i class="fas fa-save"></i> Enregistrer Résultats
                        </button>
                    </div>
                    <hr>
                `;
            }
            
            html += '</div>';
            container.innerHTML = html;
            
            document.querySelectorAll('.save-results-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const analysisId = this.getAttribute('data-id');
                    const results = document.querySelector(`.analysis-results[data-id="${analysisId}"]`).value;
                    
                    try {
                        const result = await api.updateAnalysis(analysisId, results);
                        if (result.success) {
                            showAlert('Résultats enregistrés avec succès!', 'success');
                        } else {
                            showAlert('Erreur lors de l\'enregistrement', 'danger');
                        }
                    } catch (error) {
                        showAlert('Erreur lors de l\'enregistrement', 'danger');
                        console.error('Save results error:', error);
                    }
                });
            });
        }
        
        container.classList.remove('hidden');
    } catch (error) {
        showAlert('Erreur de chargement des analyses', 'danger');
        console.error('Display lab results error:', error);
    }
}

async function updateLaboratoryTable() {
    try {
        const analyses = await api.getAnalyses();
        const tableBody = document.getElementById('pending-analyses-body');
        tableBody.innerHTML = '';
        
        const pendingAnalyses = analyses.filter(a => (a.status === 'paid' || a.emergency) && !a.results);
        
        for (const analysis of pendingAnalyses) {
            const patient = await api.getPatientById(analysis.patientId);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${analysis.patientId}</td>
                <td>${patient ? patient.name : 'N/A'}</td>
                <td>${analysis.analyses}</td>
                <td>${new Date(analysis.date).toLocaleDateString('fr-FR')}</td>
                <td><span class="${analysis.status === 'paid' ? 'text-success' : 'text-warning'}">${analysis.status === 'paid' ? 'Payé' : 'En attente'}</span></td>
                <td>
                    <button class="btn btn-success" onclick="enterLabResults('${analysis.id}')">
                        <i class="fas fa-edit"></i> Saisir Résultats
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        }
    } catch (error) {
        console.error('Error loading laboratory table:', error);
        showAlert('Erreur de chargement des analyses', 'danger');
    }
}

async function enterLabResults(analysisId) {
    try {
        const analyses = await api.getAnalyses();
        const analysis = analyses.find(a => a.id === analysisId);
        if (analysis) {
            document.getElementById('lab-patient-id').value = analysis.patientId;
            document.getElementById('lab-search-btn').click();
        }
    } catch (error) {
        showAlert('Erreur de chargement de l\'analyse', 'danger');
        console.error('Enter lab results error:', error);
    }
}

function setupPharmacy() {
    const searchBtn = document.getElementById('pharmacy-search-btn');
    const addMedicationBtn = document.getElementById('add-medication-btn');
    
    searchBtn.addEventListener('click', async function() {
        const patientId = document.getElementById('pharmacy-patient-id').value;
        try {
            const patient = await api.getPatientById(patientId);
            if (patient) {
                await displayPharmacyOrders(patient);
            } else {
                showAlert('Patient non trouvé. Vérifiez le numéro.', 'warning');
            }
        } catch (error) {
            showAlert('Erreur de recherche du patient', 'danger');
            console.error('Pharmacy search error:', error);
        }
    });
    
    addMedicationBtn.addEventListener('click', function() {
        if (currentRole !== 'admin') {
            showAlert('Seul l\'administrateur peut ajouter des médicaments', 'warning');
            return;
        }
        addMedicationToStock();
    });
    
    // Charger les données au chargement
    updatePharmacyTable();
    updateStockTable();
}

async function displayPharmacyOrders(patient) {
    const container = document.getElementById('pharmacy-results-container');
    
    try {
        const prescriptions = await api.getPrescriptions();
        const patientPrescriptions = prescriptions.filter(p => p.patientId === patient.id && (p.status === 'paid' || patient.emergency || p.emergency));
        
        if (patientPrescriptions.length === 0) {
            // Si aucune prescription payée, vérifier s'il y a des prescriptions en attente de paiement
            const pendingPrescriptions = prescriptions.filter(p => p.patientId === patient.id && p.status === 'pending-payment');
            if (pendingPrescriptions.length > 0 && !patient.emergency) {
                container.innerHTML = '<div class="alert alert-warning">Les prescriptions sont en attente de paiement. Veuillez payer à la caisse d\'abord.</div>';
            } else {
                container.innerHTML = '<div class="alert alert-info">Aucune ordonnance trouvée pour ce patient.</div>';
            }
        } else {
            let html = '<div class="card"><h3>Ordonnances du Patient</h3>';
            
            const consultations = {};
            patientPrescriptions.forEach(p => {
                if (!consultations[p.consultationId]) {
                    consultations[p.consultationId] = [];
                }
                consultations[p.consultationId].push(p);
            });
            
            for (const [consultId, meds] of Object.entries(consultations)) {
                const isEmergency = meds[0].emergency || (patient && patient.emergency);
                const emergencyTag = isEmergency ? '<span class="emergency-patient-tag">URGENCE</span>' : '';
                
                html += `
                    <div class="mb-3">
                        <h4>Ordonnance ${consultId} ${emergencyTag}</h4>
                        <p><strong>Prescrit par:</strong> ${meds[0].doctor || 'N/A'}</p>
                        <p><strong>Date:</strong> ${new Date(meds[0].date).toLocaleDateString('fr-FR')}</p>
                        <p><strong>Statut paiement:</strong> ${meds[0].status === 'paid' ? 'Payé' : 'En attente'}</p>
                        
                        <h5>Médicaments prescrits:</h5>
                        <ul>
                `;
                
                let allAvailable = true;
                let missingMeds = [];
                
                const stock = await api.getStock();
                
                for (const prescription of meds) {
                    const medInStock = stock.find(m => 
                        prescription.prescription.toLowerCase().includes(m.medication.toLowerCase())
                    );
                    
                    if (medInStock && medInStock.quantity > 0) {
                        html += `<li>${prescription.prescription} <span class="text-success">(En stock: ${medInStock.quantity})</span></li>`;
                    } else {
                        html += `<li>${prescription.prescription} <span class="text-danger">(Stock épuisé)</span></li>`;
                        allAvailable = false;
                        missingMeds.push(prescription.prescription);
                    }
                }
                
                html += `</ul>`;
                
                if (!meds[0].delivered) {
                    if (allAvailable) {
                        html += `
                            <button class="btn btn-success" onclick="dispenseMedication('${consultId}')">
                                <i class="fas fa-pills"></i> Délivrer tous les médicaments
                            </button>
                        `;
                    } else {
                        html += `
                            <div class="alert alert-warning">
                                <p>Certains médicaments ne sont pas disponibles en stock.</p>
                                <button class="btn btn-warning" onclick="printMissingMedsReceipt('${patient.id}', ${JSON.stringify(missingMeds).replace(/'/g, "\\'")})">
                                    <i class="fas fa-print"></i> Imprimer reçu d'achat
                                </button>
                                <button class="btn btn-success" onclick="dispensePartialMedication('${consultId}')">
                                    <i class="fas fa-pills"></i> Délivrer seulement les disponibles
                                </button>
                            </div>
                        `;
                    }
                } else if (meds[0].delivered) {
                    html += '<div class="alert alert-success">Médicaments déjà délivrés</div>';
                }
                
                html += `<hr>`;
            }
            
            html += '</div>';
            container.innerHTML = html;
        }
        
        container.classList.remove('hidden');
    } catch (error) {
        showAlert('Erreur de chargement des ordonnances', 'danger');
        console.error('Display pharmacy orders error:', error);
    }
}

async function dispenseMedication(consultationId) {
    try {
        const prescriptions = await api.getPrescriptions();
        const consultationPrescriptions = prescriptions.filter(p => p.consultationId === consultationId);
        
        if (consultationPrescriptions.length === 0) return;
        
        const patient = await api.getPatientById(consultationPrescriptions[0].patientId);
        const isEmergency = patient && patient.emergency;
        const stock = await api.getStock();
        
        for (const prescription of consultationPrescriptions) {
            // Marquer comme délivré
            await api.updatePrescription(prescription.id, true);
            
            // Réduire le stock
            const medInStock = stock.find(m => 
                prescription.prescription.toLowerCase().includes(m.medication.toLowerCase())
            );
            
            if (medInStock) {
                const newQuantity = medInStock.quantity - 1;
                await api.updateStock(medInStock.id, newQuantity);
                
                // Créer une transaction pour le médicament
                const transactionData = {
                    patientId: prescription.patientId,
                    service: 'Médicament: ' + medInStock.medication,
                    amount: medInStock.price,
                    doctor: currentUser,
                    emergency: isEmergency
                };
                await api.createTransaction(transactionData);
            }
        }
        
        showAlert('Médicaments délivrés avec succès!', 'success');
        
        const patientId = consultationPrescriptions[0].patientId;
        document.getElementById('pharmacy-patient-id').value = patientId;
        document.getElementById('pharmacy-search-btn').click();
        
        await updateStockTable();
        await updateCashierTotals();
        await updateEmployeeTodayTotal();
    } catch (error) {
        showAlert('Erreur lors de la délivrance', 'danger');
        console.error('Dispense medication error:', error);
    }
}

async function dispensePartialMedication(consultationId) {
    try {
        const prescriptions = await api.getPrescriptions();
        const consultationPrescriptions = prescriptions.filter(p => p.consultationId === consultationId);
        
        if (consultationPrescriptions.length === 0) return;
        
        const patient = await api.getPatientById(consultationPrescriptions[0].patientId);
        const isEmergency = patient && patient.emergency;
        const stock = await api.getStock();
        let deliveredCount = 0;
        
        for (const prescription of consultationPrescriptions) {
            const medInStock = stock.find(m => 
                prescription.prescription.toLowerCase().includes(m.medication.toLowerCase())
            );
            
            if (medInStock && medInStock.quantity > 0) {
                // Marquer comme délivré
                await api.updatePrescription(prescription.id, true);
                
                // Réduire le stock
                const newQuantity = medInStock.quantity - 1;
                await api.updateStock(medInStock.id, newQuantity);
                deliveredCount++;
                
                // Créer une transaction pour le médicament
                const transactionData = {
                    patientId: prescription.patientId,
                    service: 'Médicament: ' + medInStock.medication,
                    amount: medInStock.price,
                    doctor: currentUser,
                    emergency: isEmergency
                };
                await api.createTransaction(transactionData);
            }
        }
        
        showAlert(`${deliveredCount} médicament(s) délivré(s) avec succès!`, 'success');
        
        const patientId = consultationPrescriptions[0].patientId;
        document.getElementById('pharmacy-patient-id').value = patientId;
        document.getElementById('pharmacy-search-btn').click();
        
        await updateStockTable();
        await updateCashierTotals();
        await updateEmployeeTodayTotal();
    } catch (error) {
        showAlert('Erreur lors de la délivrance', 'danger');
        console.error('Dispense partial medication error:', error);
    }
}

async function updatePharmacyTable() {
    // Cette fonction peut être utilisée pour mettre à jour d'autres données si nécessaire
    await updateDashboard();
}

async function addMedicationToStock() {
    if (currentRole !== 'admin') {
        showAlert('Seul l\'administrateur peut ajouter des médicaments', 'warning');
        return;
    }
    
    const medication = prompt("Nom du médicament:");
    if (!medication) return;
    
    const quantity = parseInt(prompt("Quantité en stock:", "100"));
    if (isNaN(quantity)) return;
    
    const threshold = parseInt(prompt("Seuil d'alerte:", "20"));
    if (isNaN(threshold)) return;
    
    const price = parseFloat(prompt("Prix unitaire (Gdes):", "50"));
    if (isNaN(price)) return;
    
    const stockData = {
        medication: medication,
        quantity: quantity,
        threshold: threshold,
        price: price
    };
    
    try {
        const result = await api.createStockItem(stockData);
        if (result.success) {
            showAlert('Médicament ajouté au stock avec succès! Code: ' + result.medicationId, 'success');
            await updateStockTable();
        } else {
            showAlert('Erreur lors de l\'ajout du médicament', 'danger');
        }
    } catch (error) {
        showAlert('Erreur lors de l\'ajout du médicament', 'danger');
        console.error('Add medication error:', error);
    }
}

async function updateStockTable() {
    try {
        const stock = await api.getStock();
        const tableBody = document.getElementById('stock-table-body');
        tableBody.innerHTML = '';
        
        stock.forEach(item => {
            const lowStock = item.quantity <= item.threshold;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.id}</td>
                <td>${item.medication}</td>
                <td class="${lowStock ? 'text-danger' : ''}">${item.quantity} ${lowStock ? '(Stock bas!)' : ''}</td>
                <td>${item.threshold}</td>
                <td>${item.price.toFixed(2)} Gdes</td>
                <td>
                    ${currentRole === 'admin' ? 
                        `<button class="btn btn-secondary" onclick="restockMedication('${item.id}')">
                            <i class="fas fa-boxes"></i> Réapprovisionner
                        </button>` :
                        `<button class="btn btn-secondary" disabled>
                            <i class="fas fa-eye"></i> Voir seulement
                        </button>`
                    }
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading stock:', error);
        showAlert('Erreur de chargement du stock', 'danger');
    }
}

async function restockMedication(medicationId) {
    if (currentRole !== 'admin') {
        showAlert('Seul l\'administrateur peut réapprovisionner le stock', 'warning');
        return;
    }
    
    try {
        const stock = await api.getStock();
        const item = stock.find(m => m.id === medicationId);
        
        if (item) {
            const amount = parseInt(prompt(`Quantité à ajouter pour ${item.medication}:`, "50"));
            if (!isNaN(amount) && amount > 0) {
                const newQuantity = item.quantity + amount;
                const result = await api.updateStock(medicationId, newQuantity);
                
                if (result.success) {
                    showAlert(`${amount} unités ajoutées au stock de ${item.medication}`, 'success');
                    await updateStockTable();
                } else {
                    showAlert('Erreur lors du réapprovisionnement', 'danger');
                }
            }
        }
    } catch (error) {
        showAlert('Erreur lors du réapprovisionnement', 'danger');
        console.error('Restock medication error:', error);
    }
}

function setupCashier() {
    const searchBtn = document.getElementById('cashier-search-btn');
    const printReceiptBtn = document.getElementById('print-receipt-btn');
    const paymentMethodSelect = document.getElementById('payment-method-select');
    const confirmPaymentBtn = document.getElementById('confirm-payment-btn');
    const cancelPaymentBtn = document.getElementById('cancel-payment-btn');
    const addExternalServiceBtn = document.getElementById('add-external-service-btn');
    const externalServiceCards = document.querySelectorAll('.external-service-card');
    
    // Gestion des services externes
    externalServiceCards.forEach(card => {
        card.addEventListener('click', function() {
            externalServiceCards.forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            
            const service = this.getAttribute('data-service');
            const price = this.getAttribute('data-price');
            
            document.getElementById('selected-service').value = service;
            document.getElementById('selected-service-price').value = price;
        });
    });
    
    addExternalServiceBtn.addEventListener('click', async function() {
        const patientId = document.getElementById('external-service-patient-id').value;
        const service = document.getElementById('selected-service').value;
        const price = document.getElementById('selected-service-price').value;
        
        if (!patientId) {
            showAlert('Veuillez entrer le numéro du patient', 'warning');
            return;
        }
        
        if (!service) {
            showAlert('Veuillez sélectionner un service', 'warning');
            return;
        }
        
        try {
            const patient = await api.getPatientById(patientId);
            if (!patient) {
                showAlert('Patient non trouvé. Vérifiez le numéro.', 'warning');
                return;
            }
            
            const transactionData = {
                patientId: patientId,
                service: 'Service Externe: ' + service,
                amount: parseFloat(price),
                doctor: currentUser,
                emergency: false
            };
            
            const result = await api.createTransaction(transactionData);
            
            if (result.success) {
                showAlert('Service externe ajouté avec succès! Montant: ' + price + ' Gdes', 'success');
                
                // Réinitialiser
                document.getElementById('external-service-patient-id').value = '';
                document.getElementById('selected-service').value = '';
                document.getElementById('selected-service-price').value = '';
                externalServiceCards.forEach(c => c.classList.remove('selected'));
                
                await updateTransactionsTable();
                await updateCashierTotals();
                await updateEmployeeTodayTotal();
            } else {
                showAlert('Erreur lors de l\'ajout du service', 'danger');
            }
        } catch (error) {
            showAlert('Erreur lors de l\'ajout du service', 'danger');
            console.error('Add external service error:', error);
        }
    });
    
    searchBtn.addEventListener('click', async function() {
        const patientId = document.getElementById('cashier-patient-id').value;
        try {
            const patient = await api.getPatientById(patientId);
            if (patient) {
                await displayPatientTransactions(patient);
            } else {
                showAlert('Patient non trouvé. Vérifiez le numéro.', 'warning');
            }
        } catch (error) {
            showAlert('Erreur de recherche du patient', 'danger');
            console.error('Cashier search error:', error);
        }
    });
    
    printReceiptBtn.addEventListener('click', async function() {
        const patientId = document.getElementById('cashier-patient-id').value;
        try {
            const patient = await api.getPatientById(patientId);
            if (patient) {
                await printPaymentReceipt(patient);
            } else {
                showAlert('Veuillez d\'abord rechercher un patient', 'warning');
            }
        } catch (error) {
            showAlert('Erreur lors de l\'impression', 'danger');
            console.error('Print receipt error:', error);
        }
    });
    
    paymentMethodSelect.addEventListener('change', function() {
        selectedPaymentMethod = this.value;
        
        // Cacher tous les détails de paiement
        document.querySelectorAll('.payment-details').forEach(detail => {
            detail.classList.add('hidden');
        });
        
        // Afficher les détails appropriés
        if (selectedPaymentMethod === 'cash') {
            document.getElementById('cash-payment-details').classList.remove('hidden');
            document.getElementById('cash-amount').value = '';
            document.getElementById('cash-amount').focus();
        } else if (selectedPaymentMethod === 'moncash' || selectedPaymentMethod === 'natcash') {
            document.getElementById('mobile-payment-details').classList.remove('hidden');
            document.getElementById('mobile-transaction-id').value = '';
            
            // Mettre à jour les liens de paiement
            const moncashLink = document.getElementById('moncash-link');
            const natcashLink = document.getElementById('natcash-link');
            
            if (currentPaymentTransaction && typeof currentPaymentTransaction === 'string' && !currentPaymentTransaction.startsWith('PA') && !currentPaymentTransaction.startsWith('URG')) {
                const transaction = currentPaymentTransaction;
                if (transaction) {
                    const amount = currentPaymentTotal;
                    moncashLink.href = `https://moncash.com/pay?amount=${amount}&transaction=${transaction}`;
                    natcashLink.href = `https://natcash.com/pay?amount=${amount}&transaction=${transaction}`;
                }
            } else if (currentPaymentTransaction && (currentPaymentTransaction.startsWith('PA') || currentPaymentTransaction.startsWith('URG'))) {
                const total = currentPaymentTotal;
                moncashLink.href = `https://moncash.com/pay?amount=${total}&patient=${currentPaymentTransaction}`;
                natcashLink.href = `https://natcash.com/pay?amount=${total}&patient=${currentPaymentTransaction}`;
            }
            
            document.getElementById('mobile-transaction-id').focus();
        } else if (selectedPaymentMethod === 'debit' || selectedPaymentMethod === 'credit' || selectedPaymentMethod === 'mastercard') {
            document.getElementById('card-payment-details').classList.remove('hidden');
            document.getElementById('card-number').focus();
        } else if (selectedPaymentMethod === 'bank-transfer') {
            document.getElementById('bank-transfer-details').classList.remove('hidden');
            document.getElementById('transfer-reference').focus();
        }
        
        // Activer le bouton de confirmation
        confirmPaymentBtn.disabled = false;
    });
    
    // Gérer le montant cash pour calculer la monnaie
    document.getElementById('cash-amount')?.addEventListener('input', function() {
        if (currentPaymentTotal > 0) {
            const cashAmount = parseFloat(this.value) || 0;
            const change = cashAmount - currentPaymentTotal;
            document.getElementById('cash-change').textContent = 
                `Monnaie à rendre: ${change >= 0 ? change.toFixed(2) : '0.00'} Gdes`;
        }
    });
    
    confirmPaymentBtn.addEventListener('click', async function() {
        if (!selectedPaymentMethod) {
            showAlert('Veuillez sélectionner un moyen de paiement', 'warning');
            return;
        }
        
        if (!currentPaymentTransaction) {
            showAlert('Aucune transaction sélectionnée', 'warning');
            return;
        }
        
        // Validation des détails de paiement
        let valid = true;
        let paymentDetails = {};
        
        if (selectedPaymentMethod === 'cash') {
            const cashAmount = parseFloat(document.getElementById('cash-amount').value);
            if (!cashAmount || cashAmount < currentPaymentTotal) {
                showAlert(`Le montant doit être au moins ${currentPaymentTotal.toFixed(2)} Gdes`, 'warning');
                valid = false;
            } else {
                paymentDetails.cashAmount = cashAmount;
                paymentDetails.change = cashAmount - currentPaymentTotal;
            }
        } else if (selectedPaymentMethod === 'moncash' || selectedPaymentMethod === 'natcash') {
            const transactionId = document.getElementById('mobile-transaction-id').value;
            if (!transactionId) {
                showAlert('Veuillez entrer l\'ID de transaction', 'warning');
                valid = false;
            } else {
                paymentDetails.transactionId = transactionId;
            }
        } else if (selectedPaymentMethod === 'debit' || selectedPaymentMethod === 'credit' || selectedPaymentMethod === 'mastercard') {
            const cardNumber = document.getElementById('card-number').value;
            const cardExpiry = document.getElementById('card-expiry').value;
            const cardCVV = document.getElementById('card-cvv').value;
            const cardHolder = document.getElementById('card-holder').value;
            
            if (!cardNumber || !cardExpiry || !cardCVV || !cardHolder) {
                showAlert('Veuillez remplir tous les détails de la carte', 'warning');
                valid = false;
            } else {
                paymentDetails.cardLast4 = cardNumber.slice(-4);
            }
        } else if (selectedPaymentMethod === 'bank-transfer') {
            const transferRef = document.getElementById('transfer-reference').value;
            if (!transferRef) {
                showAlert('Veuillez entrer une référence de virement', 'warning');
                valid = false;
            } else {
                paymentDetails.transferReference = transferRef;
            }
        }
        
        if (!valid) return;
        
        try {
            await markAsPaidWithMethod(currentPaymentTransaction, selectedPaymentMethod, paymentDetails);
            document.getElementById('payment-methods-container').classList.add('hidden');
            paymentMethodSelect.value = '';
            
            // Réinitialiser les formulaires de détails
            document.querySelectorAll('.payment-details input').forEach(input => {
                input.value = '';
            });
            
            selectedPaymentMethod = null;
            currentPaymentTransaction = null;
            currentPaymentTotal = 0;
            
            // Recharger la vue
            const patientId = document.getElementById('cashier-patient-id').value;
            if (patientId) {
                const patient = await api.getPatientById(patientId);
                if (patient) {
                    await displayPatientTransactions(patient);
                }
            }
        } catch (error) {
            showAlert('Erreur lors du paiement', 'danger');
            console.error('Confirm payment error:', error);
        }
    });
    
    cancelPaymentBtn.addEventListener('click', function() {
        document.getElementById('payment-methods-container').classList.add('hidden');
        paymentMethodSelect.value = '';
        selectedPaymentMethod = null;
        currentPaymentTransaction = null;
        currentPaymentTotal = 0;
        
        // Réinitialiser les formulaires de détails
        document.querySelectorAll('.payment-details input').forEach(input => {
            input.value = '';
        });
    });
    
    // Charger les données initiales
    updateTransactionsTable();
    updateCashierTotals();
}

async function updateCashierTotals() {
    try {
        const transactions = await api.getTransactions();
        const today = new Date().toISOString().split('T')[0];
        const todayTransactions = transactions.filter(t => 
            new Date(t.date).toISOString().split('T')[0] === today && 
            t.status === 'paid'
        );
        
        const todayTotal = todayTransactions.reduce((sum, t) => sum + t.amount, 0);
        document.getElementById('today-total').textContent = `Total aujourd'hui: ${todayTotal.toFixed(2)} Gdes`;
        
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekTransactions = transactions.filter(t => {
            const transDate = new Date(t.date);
            return transDate >= weekAgo && t.status === 'paid';
        });
        
        const weekTotal = weekTransactions.reduce((sum, t) => sum + t.amount, 0);
        document.getElementById('week-total').textContent = `Total cette semaine: ${weekTotal.toFixed(2)} Gdes`;
    } catch (error) {
        console.error('Error updating cashier totals:', error);
    }
}

async function displayPatientTransactions(patient) {
    const container = document.getElementById('cashier-results-container');
    
    try {
        const transactions = await api.getTransactions();
        const patientTransactions = transactions.filter(t => t.patientId === patient.id);
        
        container.innerHTML = '';
        
        if (patientTransactions.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Aucune transaction trouvée pour ce patient.</div>';
            document.getElementById('print-receipt-btn').disabled = true;
        } else {
            let html = '<div class="card"><h3>Transactions du Patient</h3>';
            
            let totalPending = 0;
            let totalPaid = 0;
            let hasPending = false;
            
            patientTransactions.forEach(transaction => {
                if (transaction.status === 'pending') {
                    hasPending = true;
                    totalPending += transaction.amount;
                    html += `
                        <div class="d-flex justify-between mb-2">
                            <div>
                                <strong>${transaction.service}</strong>
                                <div>${new Date(transaction.date).toLocaleDateString('fr-FR')} - ${transaction.id}</div>
                                ${transaction.emergency ? '<span class="emergency-patient-tag">URGENCE</span>' : ''}
                            </div>
                            <div>
                                <div class="text-right">${transaction.amount.toFixed(2)} Gdes</div>
                                <button class="btn btn-success" onclick="showPaymentMethods('${transaction.id}', ${transaction.amount})">
                                    <i class="fas fa-credit-card"></i> Payer
                                </button>
                            </div>
                        </div>
                        <hr>
                    `;
                } else {
                    totalPaid += transaction.amount;
                }
            });
            
            // Vérifier les analyses en attente de paiement
            const analyses = await api.getAnalyses();
            const pendingAnalyses = analyses.filter(a => 
                a.patientId === patient.id && 
                (a.status === 'pending-payment' || a.status === 'pending') &&
                !transactions.some(t => 
                    t.patientId === patient.id && 
                    (t.service === 'Analyse' || t.service === 'Analyse Urgence') &&
                    t.status === 'pending'
                )
            );
            
            for (const analysis of pendingAnalyses) {
                const analysisType = analysis.emergency ? 'Analyse Urgence' : 'Analyse';
                const analysisAmount = analysis.emergency ? servicePrices['Analyse Urgence'] : servicePrices['Analyse'];
                
                html += `
                    <div class="d-flex justify-between mb-2">
                        <div>
                            <strong>${analysisType}</strong>
                            <div>${new Date(analysis.date).toLocaleDateString('fr-FR')} - Analyses demandées</div>
                            ${analysis.emergency ? '<span class="emergency-patient-tag">URGENCE</span>' : ''}
                        </div>
                        <div>
                            <div class="text-right">${analysisAmount.toFixed(2)} Gdes</div>
                            <button class="btn btn-success" onclick="createAndPayAnalysis('${patient.id}', '${analysis.consultationId}', ${analysisAmount}, ${analysis.emergency})">
                                <i class="fas fa-credit-card"></i> Payer
                            </button>
                        </div>
                    </div>
                    <hr>
                `;
                hasPending = true;
                totalPending += analysisAmount;
            }
            
            // Vérifier les prescriptions en attente de paiement
            const prescriptions = await api.getPrescriptions();
            const pendingPrescriptions = prescriptions.filter(p => 
                p.patientId === patient.id && 
                (p.status === 'pending-payment' || p.status === 'pending') &&
                !p.delivered &&
                !transactions.some(t => 
                    t.patientId === patient.id && 
                    t.service.includes('Médicament') &&
                    t.status === 'pending'
                )
            );
            
            const stock = await api.getStock();
            
            for (const prescription of pendingPrescriptions) {
                // Extraire le nom du médicament de la prescription
                const medMatch = prescription.prescription.match(/^(.*?) -/);
                const medName = medMatch ? medMatch[1] : 'Médicament';
                
                // Trouver le prix dans le stock
                const stockItem = stock.find(s => 
                    medName.toLowerCase().includes(s.medication.toLowerCase()) ||
                    s.medication.toLowerCase().includes(medName.toLowerCase())
                );
                
                const medAmount = stockItem ? stockItem.price : 50; // Prix par défaut
                
                html += `
                    <div class="d-flex justify-between mb-2">
                        <div>
                            <strong>Médicament: ${medName}</strong>
                            <div>${new Date(prescription.date).toLocaleDateString('fr-FR')} - Ordonnance</div>
                            ${prescription.emergency ? '<span class="emergency-patient-tag">URGENCE</span>' : ''}
                        </div>
                        <div>
                            <div class="text-right">${medAmount.toFixed(2)} Gdes</div>
                            <button class="btn btn-success" onclick="createAndPayMedication('${patient.id}', '${prescription.id}', '${medName}', ${medAmount}, ${prescription.emergency})">
                                <i class="fas fa-credit-card"></i> Payer
                            </button>
                        </div>
                    </div>
                    <hr>
                `;
                hasPending = true;
                totalPending += medAmount;
            }
            
            html += `
                <div class="d-flex justify-between mt-3">
                    <div><strong>Total en attente:</strong></div>
                    <div><strong>${totalPending.toFixed(2)} Gdes</strong></div>
                </div>
                <div class="d-flex justify-between">
                    <div><strong>Total déjà payé:</strong></div>
                    <div><strong>${totalPaid.toFixed(2)} Gdes</strong></div>
                </div>
                <div class="d-flex justify-between mt-2">
                    <div><strong>Total général:</strong></div>
                    <div><strong>${(totalPending + totalPaid).toFixed(2)} Gdes</strong></div>
                </div>
                
                ${hasPending ? `
                    <div class="text-center mt-3">
                        <button class="btn btn-success" onclick="showPaymentMethodsForAll('${patient.id}', ${totalPending})">
                            <i class="fas fa-check-circle"></i> Tout Payer
                        </button>
                    </div>
                ` : ''}
            `;
            
            html += '</div>';
            container.innerHTML = html;
            
            document.getElementById('print-receipt-btn').disabled = totalPaid === 0;
        }
        
        container.classList.remove('hidden');
    } catch (error) {
        showAlert('Erreur de chargement des transactions', 'danger');
        console.error('Display patient transactions error:', error);
    }
}

async function createAndPayAnalysis(patientId, consultationId, amount, isEmergency) {
    try {
        const transactionData = {
            patientId: patientId,
            service: isEmergency ? 'Analyse Urgence' : 'Analyse',
            amount: amount,
            doctor: currentUser,
            emergency: isEmergency
        };
        
        const result = await api.createTransaction(transactionData);
        
        if (result.success) {
            showPaymentMethods(result.transactionId, amount);
        } else {
            showAlert('Erreur lors de la création de la transaction', 'danger');
        }
    } catch (error) {
        showAlert('Erreur lors de la création de la transaction', 'danger');
        console.error('Create and pay analysis error:', error);
    }
}

async function createAndPayMedication(patientId, prescriptionId, medName, amount, isEmergency) {
    try {
        const transactionData = {
            patientId: patientId,
            service: 'Médicament: ' + medName,
            amount: amount,
            doctor: currentUser,
            emergency: isEmergency
        };
        
        const result = await api.createTransaction(transactionData);
        
        if (result.success) {
            showPaymentMethods(result.transactionId, amount);
        } else {
            showAlert('Erreur lors de la création de la transaction', 'danger');
        }
    } catch (error) {
        showAlert('Erreur lors de la création de la transaction', 'danger');
        console.error('Create and pay medication error:', error);
    }
}

function showPaymentMethods(transactionId, amount) {
    currentPaymentTransaction = transactionId;
    currentPaymentTotal = amount;
    
    // Réinitialiser le formulaire
    document.getElementById('payment-method-select').value = '';
    document.querySelectorAll('.payment-details').forEach(detail => {
        detail.classList.add('hidden');
    });
    
    document.getElementById('payment-methods-container').classList.remove('hidden');
    
    // Faire défiler vers la section de paiement
    setTimeout(() => {
        document.getElementById('payment-methods-container').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }, 100);
}

function showPaymentMethodsForAll(patientId, total) {
    currentPaymentTransaction = patientId;
    currentPaymentTotal = total;
    
    // Réinitialiser le formulaire
    document.getElementById('payment-method-select').value = '';
    document.querySelectorAll('.payment-details').forEach(detail => {
        detail.classList.add('hidden');
    });
    
    document.getElementById('payment-methods-container').classList.remove('hidden');
    
    // Faire défiler vers la section de paiement
    setTimeout(() => {
        document.getElementById('payment-methods-container').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }, 100);
}

async function markAsPaidWithMethod(transactionId, paymentMethod, paymentDetails = {}) {
    try {
        if (transactionId.startsWith('PA') || transactionId.startsWith('URG') || transactionId.startsWith('PED')) {
            await markAllAsPaidWithMethod(transactionId, paymentMethod, paymentDetails);
        } else {
            const result = await api.updateTransaction(transactionId, 'paid', paymentMethod, paymentDetails);
            
            if (result.success) {
                showAlert('Transaction payée avec ' + getPaymentMethodName(paymentMethod) + '!', 'success');
                
                const patientId = result.transaction.patientId;
                document.getElementById('cashier-patient-id').value = patientId;
                document.getElementById('cashier-search-btn').click();
                
                await updateTransactionsTable();
                await updateCashierTotals();
                await updateDashboard();
                
                // Mettre à jour le statut d'urgence si le patient est en urgence et tout est payé
                const patient = await api.getPatientById(patientId);
                if (patient && patient.emergency) {
                    const transactions = await api.getTransactions();
                    const pendingTransactions = transactions.filter(t => t.patientId === patientId && t.status === 'pending');
                    if (pendingTransactions.length === 0) {
                        // Fermer le dossier d'urgence
                        const emergencyPatients = await api.getEmergencyPatients();
                        const emergencyRecord = emergencyPatients.find(ep => ep.patientId === patientId && ep.active);
                        if (emergencyRecord) {
                            const updateData = {
                                active: false,
                                dischargeTime: new Date().toISOString(),
                                status: 'Payé et sorti'
                            };
                            await api.updateEmergencyPatient(emergencyRecord.id, updateData);
                            await updateEmergencyPatientsTable();
                        }
                    }
                }
            } else {
                showAlert('Erreur lors du paiement', 'danger');
            }
        }
    } catch (error) {
        showAlert('Erreur lors du paiement', 'danger');
        console.error('Mark as paid error:', error);
    }
}

async function markAllAsPaidWithMethod(patientId, paymentMethod, paymentDetails = {}) {
    try {
        const transactions = await api.getTransactions();
        const pendingTransactions = transactions.filter(t => t.patientId === patientId && t.status === 'pending');
        
        for (const transaction of pendingTransactions) {
            await api.updateTransaction(transaction.id, 'paid', paymentMethod, paymentDetails);
        }
        
        showAlert('Toutes les transactions payées avec ' + getPaymentMethodName(paymentMethod) + '!', 'success');
        document.getElementById('cashier-patient-id').value = patientId;
        document.getElementById('cashier-search-btn').click();
        
        await updateTransactionsTable();
        await updateCashierTotals();
        await updateDashboard();
        
        // Mettre à jour le statut d'urgence
        const patient = await api.getPatientById(patientId);
        if (patient && patient.emergency) {
            const emergencyPatients = await api.getEmergencyPatients();
            const emergencyRecord = emergencyPatients.find(ep => ep.patientId === patientId && ep.active);
            if (emergencyRecord) {
                const updateData = {
                    active: false,
                    dischargeTime: new Date().toISOString(),
                    status: 'Payé et sorti'
                };
                await api.updateEmergencyPatient(emergencyRecord.id, updateData);
                await updateEmergencyPatientsTable();
            }
        }
    } catch (error) {
        showAlert('Erreur lors du paiement', 'danger');
        console.error('Mark all as paid error:', error);
    }
}

function getPaymentMethodName(methodId) {
    const method = paymentMethods.find(m => m.id === methodId);
    return method ? method.name : 'Inconnu';
}

async function printPaymentReceipt(patient) {
    try {
        const transactions = await api.getTransactions();
        const paidTransactions = transactions.filter(t => t.patientId === patient.id && t.status === 'paid');
        
        if (paidTransactions.length === 0) {
            showAlert('Aucune transaction payée pour ce patient', 'warning');
            return;
        }
        
        const receiptNumber = 'REC-' + Date.now().toString().slice(-6);
        
        let receiptHtml = `
            <div class="receipt">
                <div class="receipt-header">
                    <h3>Hôpital Saint-Luc</h3>
                    <p>Reçu de paiement</p>
                    <p>Date: ${new Date().toLocaleDateString('fr-FR')}</p>
                    <p>Reçu #: ${receiptNumber}</p>
        `;
        
        const paymentMethod = paidTransactions[0].paymentMethod || 'Cash';
        receiptHtml += `<p>Moyen de paiement: ${getPaymentMethodName(paymentMethod)}</p>`;
        
        receiptHtml += `
                </div>
                <div>
                    <p><strong>Patient:</strong> ${patient.name}</p>
                    <p><strong>Numéro:</strong> ${patient.id}</p>
                    ${patient.emergency ? '<p><strong>Type:</strong> Patient Urgence</p>' : ''}
                    ${patient.pediatric ? '<p><strong>Type:</strong> Patient Pédiatrique</p>' : ''}
                </div>
                <h4>Services payés:</h4>
        `;
        
        let totalAmount = 0;
        
        paidTransactions.forEach(transaction => {
            receiptHtml += `
                <div class="receipt-item">
                    <span>${transaction.service}</span>
                    <span>${transaction.amount.toFixed(2)} Gdes</span>
                </div>
            `;
            totalAmount += transaction.amount;
        });
        
        receiptHtml += `
                <div class="receipt-total">
                    <span>Total payé:</span>
                    <span>${totalAmount.toFixed(2)} Gdes</span>
                </div>
                <p class="text-center" style="margin-top: 15px; font-size: 0.9rem;">
                    Merci pour votre visite
                </p>
            </div>
        `;
        
        printContentDirectly(receiptHtml, 'Reçu de Paiement');
    } catch (error) {
        showAlert('Erreur lors de l\'impression', 'danger');
        console.error('Print payment receipt error:', error);
    }
}

async function updateTransactionsTable() {
    try {
        const transactions = await api.getTransactions();
        const tableBody = document.getElementById('transactions-table-body');
        tableBody.innerHTML = '';
        
        const recentTransactions = transactions.slice(-10).reverse();
        
        for (const transaction of recentTransactions) {
            const patient = await api.getPatientById(transaction.patientId);
            const paymentMethod = transaction.paymentMethod ? getPaymentMethodName(transaction.paymentMethod) : 'Non spécifié';
            const emergencyTag = transaction.emergency ? '<span class="emergency-patient-tag">URGENCE</span>' : '';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${transaction.patientId} ${emergencyTag}</td>
                <td>${patient ? patient.name : 'N/A'}</td>
                <td>${transaction.service}</td>
                <td>${transaction.amount.toFixed(2)} Gdes</td>
                <td>${new Date(transaction.date).toLocaleDateString('fr-FR')}</td>
                <td>${paymentMethod}</td>
                <td><span class="${transaction.status === 'paid' ? 'text-success' : 'text-danger'}">${transaction.status === 'paid' ? 'Payé' : 'En attente'}</span></td>
            `;
            tableBody.appendChild(row);
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
        showAlert('Erreur de chargement des transactions', 'danger');
    }
}

function setupAdministration() {
    // Les statistiques seront chargées lorsque la section administration sera active
}

async function updateAdminStats() {
    try {
        const stats = await api.getAdminStats();
        
        if (stats) {
            document.getElementById('total-revenue').textContent = stats.totalRevenue.toFixed(2) + ' Gdes';
            document.getElementById('total-patients').textContent = stats.totalPatients;
            document.getElementById('total-appointments').textContent = stats.totalAppointments;
            document.getElementById('total-analyses').textContent = stats.totalAnalyses;
            
            // Mettre à jour les autres tableaux si nécessaire
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
        showAlert('Erreur de chargement des statistiques', 'danger');
    }
}

async function updateEmployeeTodayTotal() {
    if (currentRole === 'admin') return;
    
    try {
        const transactions = await api.getTransactions();
        const today = new Date().toISOString().split('T')[0];
        const employeeTransactions = transactions.filter(t => 
            new Date(t.date).toISOString().split('T')[0] === today && 
            t.status === 'paid' && 
            t.doctor === currentUser
        );
        
        const total = employeeTransactions.reduce((sum, t) => sum + t.amount, 0);
        const count = employeeTransactions.length;
        
        document.getElementById('employee-service-total').textContent = 
            `${count} service(s) - Total: ${total.toFixed(2)} Gdes`;
    } catch (error) {
        console.error('Error updating employee total:', error);
    }
}

function setupEmployees() {
    const checkInBtn = document.getElementById('check-in-btn');
    const checkOutBtn = document.getElementById('check-out-btn');
    const faceIdBtn = document.getElementById('face-id-btn');
    const addEmployeeBtn = document.getElementById('add-employee-btn');
    const cancelEmployeeFormBtn = document.getElementById('cancel-employee-form-btn');
    const employeeForm = document.getElementById('employee-form');
    
    checkInBtn.addEventListener('click', async function() {
        const employeeId = document.getElementById('employee-id').value;
        const pin = document.getElementById('employee-pin').value;
        
        if (!employeeId || !pin) {
            showAlert('Veuillez entrer l\'ID employé et le code PIN', 'warning');
            return;
        }
        
        const attendanceData = {
            employeeId: employeeId,
            checkIn: new Date().toISOString()
        };
        
        try {
            const result = await api.createAttendance(attendanceData);
            if (result.success) {
                await updateAttendanceTable();
                showAlert('Pointage d\'entrée enregistré pour ' + employeeId, 'success');
                document.getElementById('employee-id').value = '';
                document.getElementById('employee-pin').value = '';
            } else {
                showAlert('Erreur lors du pointage', 'danger');
            }
        } catch (error) {
            showAlert('Erreur lors du pointage', 'danger');
            console.error('Check in error:', error);
        }
    });
    
    checkOutBtn.addEventListener('click', async function() {
        const employeeId = document.getElementById('employee-id').value;
        const pin = document.getElementById('employee-pin').value;
        
        if (!employeeId || !pin) {
            showAlert('Veuillez entrer l\'ID employé et le code PIN', 'warning');
            return;
        }
        
        try {
            const attendanceRecords = await api.getAttendance();
            const today = new Date().toISOString().split('T')[0];
            const record = attendanceRecords.find(a => 
                a.employeeId === employeeId && 
                new Date(a.checkIn).toISOString().split('T')[0] === today && 
                !a.checkOut
            );
            
            if (record) {
                const result = await api.updateAttendance(record.id, new Date().toISOString());
                if (result.success) {
                    await updateAttendanceTable();
                    showAlert('Pointage de sortie enregistré pour ' + employeeId, 'success');
                    document.getElementById('employee-id').value = '';
                    document.getElementById('employee-pin').value = '';
                } else {
                    showAlert('Erreur lors du pointage', 'danger');
                }
            } else {
                showAlert('Aucun pointage d\'entrée trouvé pour cet employé aujourd\'hui', 'warning');
            }
        } catch (error) {
            showAlert('Erreur lors du pointage', 'danger');
            console.error('Check out error:', error);
        }
    });
    
    faceIdBtn.addEventListener('click', function() {
        const demoEmployees = ['EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005', 'EMP006'];
        const randomEmployee = demoEmployees[Math.floor(Math.random() * demoEmployees.length)];
        
        document.getElementById('employee-id').value = randomEmployee;
        document.getElementById('employee-pin').value = '1234';
        showAlert('Face ID simulé. ID employé: ' + randomEmployee, 'info');
    });
    
    addEmployeeBtn.addEventListener('click', function() {
        document.getElementById('employee-form-title').textContent = 'Ajouter un Employé';
        document.getElementById('employee-edit-id').value = '';
        document.getElementById('employee-form').reset();
        document.getElementById('employee-management-form').classList.remove('hidden');
    });
    
    cancelEmployeeFormBtn.addEventListener('click', function() {
        document.getElementById('employee-management-form').classList.add('hidden');
        employeeForm.reset();
    });
    
    employeeForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const employeeId = document.getElementById('employee-form-id').value;
        const name = document.getElementById('employee-form-name').value;
        const role = document.getElementById('employee-form-role').value;
        const pin = document.getElementById('employee-form-pin').value;
        const email = document.getElementById('employee-form-email').value;
        const phone = document.getElementById('employee-form-phone').value;
        const access = document.getElementById('employee-form-access').value;
        const editId = document.getElementById('employee-edit-id').value;
        
        const employeeData = {
            name: name,
            role: role,
            pin: pin,
            email: email,
            phone: phone,
            access: access
        };
        
        try {
            let result;
            if (editId) {
                // Modifier un employé existant
                result = await api.updateEmployee(editId, employeeData);
            } else {
                // Ajouter un nouvel employé
                result = await api.createEmployee(employeeData);
            }
            
            if (result.success) {
                showAlert(editId ? 'Employé modifié avec succès!' : 'Employé ajouté avec succès!', 'success');
                document.getElementById('employee-management-form').classList.add('hidden');
                employeeForm.reset();
                await updateEmployeesTable();
            } else {
                showAlert('Erreur lors de l\'enregistrement', 'danger');
            }
        } catch (error) {
            showAlert('Erreur lors de l\'enregistrement', 'danger');
            console.error('Save employee error:', error);
        }
    });
    
    // Charger les données initiales
    updateAttendanceTable();
    updateEmployeesTable();
}

async function editEmployee(employeeId) {
    try {
        const employees = await api.getEmployees();
        const employee = employees.find(e => e.id === employeeId);
        
        if (employee) {
            document.getElementById('employee-form-title').textContent = 'Modifier un Employé';
            document.getElementById('employee-edit-id').value = employee.id;
            document.getElementById('employee-form-id').value = employee.id;
            document.getElementById('employee-form-name').value = employee.name;
            document.getElementById('employee-form-role').value = employee.role;
            document.getElementById('employee-form-pin').value = employee.pin;
            document.getElementById('employee-form-email').value = employee.email;
            document.getElementById('employee-form-phone').value = employee.phone;
            document.getElementById('employee-form-access').value = employee.access;
            
            document.getElementById('employee-management-form').classList.remove('hidden');
        }
    } catch (error) {
        showAlert('Erreur de chargement de l\'employé', 'danger');
        console.error('Edit employee error:', error);
    }
}

async function deleteEmployee(employeeId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet employé?')) {
        try {
            const result = await api.deleteEmployee(employeeId);
            if (result.success) {
                showAlert('Employé supprimé avec succès!', 'success');
                await updateEmployeesTable();
            } else {
                showAlert('Erreur lors de la suppression', 'danger');
            }
        } catch (error) {
            showAlert('Erreur lors de la suppression', 'danger');
            console.error('Delete employee error:', error);
        }
    }
}

async function updateAttendanceTable() {
    try {
        const attendance = await api.getAttendance();
        const tableBody = document.getElementById('presence-table-body');
        tableBody.innerHTML = '';
        
        const today = new Date().toISOString().split('T')[0];
        const todayAttendance = attendance.filter(a => 
            new Date(a.checkIn).toISOString().split('T')[0] === today
        );
        
        if (todayAttendance.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="5" class="text-center">Aucun pointage aujourd\'hui</td>';
            tableBody.appendChild(row);
        } else {
            for (const record of todayAttendance) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${record.employeeId}</td>
                    <td>${getEmployeeServiceById(record.employeeId)}</td>
                    <td>${new Date(record.checkIn).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</td>
                    <td>${record.checkOut ? new Date(record.checkOut).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : 'En cours...'}</td>
                    <td><span class="${record.checkOut ? 'text-success' : 'text-warning'}">${record.checkOut ? 'Terminé' : 'En service'}</span></td>
                `;
                tableBody.appendChild(row);
            }
        }
    } catch (error) {
        console.error('Error loading attendance:', error);
        showAlert('Erreur de chargement de la présence', 'danger');
    }
}

function getEmployeeServiceById(employeeId) {
    const services = {
        'EMP001': 'Consultation',
        'EMP002': 'Consultation',
        'EMP003': 'Laboratoire',
        'EMP004': 'Pharmacie',
        'EMP005': 'Réception',
        'EMP006': 'Caisse'
    };
    return services[employeeId] || 'Non spécifié';
}

async function updateEmployeesTable() {
    try {
        const employees = await api.getEmployees();
        const tableBody = document.getElementById('employees-table-body');
        tableBody.innerHTML = '';
        
        employees.forEach(emp => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${emp.id}</td>
                <td>${emp.name}</td>
                <td>${getRoleName(emp.role)}</td>
                <td>${emp.email}</td>
                <td>${emp.phone}</td>
                <td>${emp.access}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editEmployee('${emp.id}')">
                        <i class="fas fa-edit"></i> Modifier
                    </button>
                    <button class="btn btn-danger" onclick="deleteEmployee('${emp.id}')">
                        <i class="fas fa-trash"></i> Supprimer
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading employees:', error);
        showAlert('Erreur de chargement des employés', 'danger');
    }
}

function setupEmergency() {
    const searchBtn = document.getElementById('emergency-search-btn');
    const consultationBtn = document.getElementById('emergency-consultation-btn');
    const labBtn = document.getElementById('emergency-lab-btn');
    const pharmacyBtn = document.getElementById('emergency-pharmacy-btn');
    const saveRecordBtn = document.getElementById('save-emergency-record-btn');
    const printBillBtn = document.getElementById('print-emergency-bill-btn');
    
    searchBtn.addEventListener('click', async function() {
        const patientId = document.getElementById('emergency-patient-id').value;
        try {
            const patient = await api.getPatientById(patientId);
            if (patient && patient.emergency) {
                await displayEmergencyPatient(patient);
            } else {
                showAlert('Patient d\'urgence non trouvé. Vérifiez le numéro (doit commencer par URG).', 'warning');
            }
        } catch (error) {
            showAlert('Erreur de recherche du patient', 'danger');
            console.error('Emergency search error:', error);
        }
    });
    
    consultationBtn.addEventListener('click', async function() {
        const patientId = document.getElementById('emergency-patient-id').value;
        try {
            const patient = await api.getPatientById(patientId);
            
            if (patient && patient.emergency) {
                const consultationData = {
                    patientId: patient.id,
                    doctor: currentUser,
                    diagnosis: 'Consultation d\'urgence',
                    emergency: true
                };
                
                const result = await api.createConsultation(consultationData);
                
                if (result.success) {
                    const transactionData = {
                        patientId: patient.id,
                        service: 'Consultation Urgence',
                        amount: servicePrices['Consultation Urgence'],
                        doctor: currentUser,
                        emergency: true
                    };
                    await api.createTransaction(transactionData);
                    
                    await updateEmergencyTransactions(patient.id);
                    showAlert('Consultation d\'urgence ajoutée avec succès!', 'success');
                }
            }
        } catch (error) {
            showAlert('Erreur lors de l\'ajout de la consultation', 'danger');
            console.error('Emergency consultation error:', error);
        }
    });
    
    labBtn.addEventListener('click', async function() {
        const patientId = document.getElementById('emergency-patient-id').value;
        try {
            const patient = await api.getPatientById(patientId);
            
            if (patient && patient.emergency) {
                const analysisData = {
                    patientId: patient.id,
                    analyses: 'Analyses d\'urgence complètes',
                    emergency: true
                };
                
                const result = await api.createAnalysis(analysisData);
                
                if (result.success) {
                    const transactionData = {
                        patientId: patient.id,
                        service: 'Analyse Urgence',
                        amount: servicePrices['Analyse Urgence'],
                        doctor: currentUser,
                        emergency: true
                    };
                    await api.createTransaction(transactionData);
                    
                    await updateEmergencyTransactions(patient.id);
                    showAlert('Analyses d\'urgence ajoutées avec succès!', 'success');
                }
            }
        } catch (error) {
            showAlert('Erreur lors de l\'ajout des analyses', 'danger');
            console.error('Emergency lab error:', error);
        }
    });
    
    pharmacyBtn.addEventListener('click', async function() {
        const patientId = document.getElementById('emergency-patient-id').value;
        try {
            const patient = await api.getPatientById(patientId);
            
            if (patient && patient.emergency) {
                const meds = ['Paracétamol 1000mg', 'Anti-inflammatoire', 'Antibiotique large spectre'];
                
                for (const med of meds) {
                    const prescriptionData = {
                        patientId: patient.id,
                        prescription: med + ' - Posologie d\'urgence',
                        emergency: true
                    };
                    await api.createPrescription(prescriptionData);
                }
                
                await updateEmergencyTransactions(patient.id);
                showAlert('Médicaments d\'urgence ajoutés avec succès!', 'success');
            }
        } catch (error) {
            showAlert('Erreur lors de l\'ajout des médicaments', 'danger');
            console.error('Emergency pharmacy error:', error);
        }
    });
    
    saveRecordBtn.addEventListener('click', async function() {
        const patientId = document.getElementById('emergency-patient-id').value;
        try {
            const patient = await api.getPatientById(patientId);
            
            if (patient && patient.emergency) {
                const notes = document.getElementById('emergency-notes').value;
                
                const emergencyPatients = await api.getEmergencyPatients();
                const emergencyRecord = emergencyPatients.find(ep => ep.patientId === patientId && ep.active);
                
                if (emergencyRecord) {
                    const updateData = {
                        notes: notes,
                        status: 'Traitement terminé - En attente de paiement'
                    };
                    await api.updateEmergencyPatient(emergencyRecord.id, updateData);
                }
                
                showAlert('Dossier d\'urgence enregistré avec succès!', 'success');
                await updateEmergencyPatientsTable();
            }
        } catch (error) {
            showAlert('Erreur lors de l\'enregistrement', 'danger');
            console.error('Save emergency record error:', error);
        }
    });
    
    printBillBtn.addEventListener('click', async function() {
        const patientId = document.getElementById('emergency-patient-id').value;
        try {
            const patient = await api.getPatientById(patientId);
            
            if (patient && patient.emergency) {
                await printEmergencyBill(patient);
            }
        } catch (error) {
            showAlert('Erreur lors de l\'impression', 'danger');
            console.error('Print emergency bill error:', error);
        }
    });
    
    // Charger les données initiales
    updateEmergencyPatientsTable();
}

async function displayEmergencyPatient(patient) {
    const detailsContainer = document.getElementById('emergency-patient-details');
    
    try {
        const emergencyPatients = await api.getEmergencyPatients();
        const emergencyRecord = emergencyPatients.find(ep => ep.patientId === patient.id && ep.active);
        
        detailsContainer.innerHTML = `
            <div class="patient-info-item">
                <div class="patient-info-label">Numéro patient:</div>
                <div>${patient.id} <span class="emergency-patient-tag">URGENCE</span> ${patient.pediatric ? '<span class="pediatric-tag">PÉDIATRIE</span>' : ''}</div>
            </div>
            <div class="patient-info-item">
                <div class="patient-info-label">Nom:</div>
                <div>${patient.name}</div>
            </div>
            <div class="patient-info-item">
                <div class="patient-info-label">Date de naissance:</div>
                <div>${new Date(patient.dob).toLocaleDateString('fr-FR')}</div>
            </div>
            <div class="patient-info-item">
                <div class="patient-info-label">Téléphone:</div>
                <div>${patient.phone || 'N/A'}</div>
            </div>
            ${emergencyRecord ? `
                <div class="patient-info-item">
                    <div class="patient-info-label">Heure d'admission:</div>
                    <div>${new Date(emergencyRecord.admissionTime).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
                <div class="patient-info-item">
                    <div class="patient-info-label">Statut:</div>
                    <div>${emergencyRecord.status}</div>
                </div>
            ` : ''}
        `;
        
        document.getElementById('emergency-patient-info').classList.remove('hidden');
        document.getElementById('emergency-services-container').classList.remove('hidden');
        
        await updateEmergencyTransactions(patient.id);
    } catch (error) {
        showAlert('Erreur de chargement du patient d\'urgence', 'danger');
        console.error('Display emergency patient error:', error);
    }
}

async function updateEmergencyTransactions(patientId) {
    const container = document.getElementById('emergency-transactions-list');
    
    try {
        const transactions = await api.getTransactions();
        const patientTransactions = transactions.filter(t => t.patientId === patientId);
        
        container.innerHTML = '';
        
        if (patientTransactions.length === 0) {
            container.innerHTML = '<p class="text-center">Aucune transaction pour ce patient d\'urgence</p>';
            return;
        }
        
        let total = 0;
        
        patientTransactions.forEach(transaction => {
            const item = document.createElement('div');
            item.className = 'd-flex justify-between mb-2';
            item.innerHTML = `
                <div>
                    <strong>${transaction.service}</strong>
                    <div>${new Date(transaction.date).toLocaleDateString('fr-FR')} - ${transaction.status === 'paid' ? '<span class="text-success">Payé</span>' : '<span class="text-warning">En attente</span>'}</div>
                </div>
                <div class="text-right">
                    ${transaction.amount.toFixed(2)} Gdes
                </div>
            `;
            container.appendChild(item);
            total += transaction.amount;
        });
        
        const totalDiv = document.createElement('div');
        totalDiv.className = 'd-flex justify-between mt-3 pt-3 border-top';
        totalDiv.innerHTML = `
            <div><strong>Total dû:</strong></div>
            <div><strong>${total.toFixed(2)} Gdes</strong></div>
        `;
        container.appendChild(totalDiv);
    } catch (error) {
        console.error('Error updating emergency transactions:', error);
    }
}

async function updateEmergencyPatientsTable() {
    try {
        const emergencyPatients = await api.getEmergencyPatients();
        const tableBody = document.getElementById('emergency-patients-body');
        tableBody.innerHTML = '';
        
        const activeEmergencies = emergencyPatients.filter(ep => ep.active);
        
        if (activeEmergencies.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="6" class="text-center">Aucun patient en urgence actif</td>';
            tableBody.appendChild(row);
        } else {
            for (const emergency of activeEmergencies) {
                const patient = await api.getPatientById(emergency.patientId);
                const transactions = await api.getTransactions();
                const patientTransactions = transactions.filter(t => t.patientId === emergency.patientId && t.status === 'pending');
                const totalDue = patientTransactions.reduce((sum, t) => sum + t.amount, 0);
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${emergency.patientId}</td>
                    <td>${patient ? patient.name : 'N/A'}</td>
                    <td>${new Date(emergency.admissionTime).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</td>
                    <td>${emergency.status}</td>
                    <td>${totalDue.toFixed(2)} Gdes</td>
                    <td>
                        <button class="btn btn-secondary" onclick="viewEmergencyPatient('${emergency.patientId}')">
                            <i class="fas fa-eye"></i> Voir
                        </button>
                        <button class="btn btn-success" onclick="processEmergencyPayment('${emergency.patientId}')">
                            <i class="fas fa-credit-card"></i> Payer
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            }
        }
    } catch (error) {
        console.error('Error loading emergency patients:', error);
        showAlert('Erreur de chargement des patients d\'urgence', 'danger');
    }
}

function viewEmergencyPatient(patientId) {
    document.getElementById('emergency-patient-id').value = patientId;
    document.getElementById('emergency-search-btn').click();
    
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector('[data-target="emergency"]').classList.add('active');
    showContent('emergency');
}

function processEmergencyPayment(patientId) {
    document.getElementById('cashier-patient-id').value = patientId;
    
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector('[data-target="cashier"]').classList.add('active');
    showContent('cashier');
    
    // Déclencher la recherche automatique
    setTimeout(() => {
        document.getElementById('cashier-search-btn').click();
    }, 100);
}

async function printEmergencyBill(patient) {
    try {
        const transactions = await api.getTransactions();
        const patientTransactions = transactions.filter(t => t.patientId === patient.id);
        const totalDue = patientTransactions.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0);
        const totalPaid = patientTransactions.filter(t => t.status === 'paid').reduce((sum, t) => sum + t.amount, 0);
        
        let billHtml = `
            <div class="receipt">
                <div class="receipt-header">
                    <h3>Hôpital Saint-Luc</h3>
                    <p>FACTURE D'URGENCE</p>
                    <p>Date: ${new Date().toLocaleDateString('fr-FR')}</p>
                    <p>Facture #: URG-${Date.now().toString().slice(-6)}</p>
                </div>
                <div>
                    <p><strong>Patient:</strong> ${patient.name}</p>
                    <p><strong>Numéro:</strong> ${patient.id}</p>
                    <p><strong>Type:</strong> PATIENT URGENCE ${patient.pediatric ? '(PÉDIATRIE)' : ''}</p>
                    <p><strong>Date d'admission:</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
                </div>
                <h4>Services d'urgence:</h4>
        `;
        
        patientTransactions.forEach(transaction => {
            billHtml += `
                <div class="receipt-item">
                    <span>${transaction.service}</span>
                    <span>${transaction.amount.toFixed(2)} Gdes</span>
                    <span>${transaction.status === 'paid' ? 'PAYÉ' : 'EN ATTENTE'}</span>
                </div>
            `;
        });
        
        billHtml += `
                <div class="receipt-total">
                    <span>Total dû:</span>
                    <span>${totalDue.toFixed(2)} Gdes</span>
                </div>
                <div class="receipt-item">
                    <span>Total payé:</span>
                    <span>${totalPaid.toFixed(2)} Gdes</span>
                </div>
                <div class="receipt-total" style="border-top: 2px solid #dc3545;">
                    <span>SOLDE À PAYER:</span>
                    <span style="color: #dc3545;">${totalDue.toFixed(2)} Gdes</span>
                </div>
                <p class="text-center" style="margin-top: 15px; font-size: 0.9rem; color: #dc3545;">
                    PRIORITÉ URGENCE - À RÉGLER AVANT LA SORTIE
                </p>
            </div>
        `;
        
        printContentDirectly(billHtml, 'Facture Urgence');
    } catch (error) {
        showAlert('Erreur lors de l\'impression', 'danger');
        console.error('Print emergency bill error:', error);
    }
}

async function updateDashboard() {
    try {
        const stats = await api.getDashboardStats();
        
        if (stats) {
            document.getElementById('stat-patients').textContent = stats.totalPatients;
            document.getElementById('stat-consultations').textContent = stats.todayConsultations;
            document.getElementById('stat-appointments').textContent = stats.todayAppointments;
            document.getElementById('stat-analyses').textContent = stats.pendingAnalyses;
        }
        
        updateNotifications();
        
        if (currentRole === 'doctor' || currentRole === 'admin') {
            await updateDoctorAppointmentsDashboard();
        }
        
        if (document.getElementById('administration').classList.contains('active')) {
            await updateAdminStats();
        }
    } catch (error) {
        console.error('Error updating dashboard:', error);
        showAlert('Erreur de chargement du tableau de bord', 'danger');
    }
}

function updateNotifications() {
    const notificationsList = document.getElementById('notifications-list');
    notificationsList.innerHTML = '';
    
    // Pour l'instant, afficher un message générique
    // Dans une version complète, on récupérerait les notifications depuis l'API
    notificationsList.innerHTML = `
        <div class="alert alert-info">
            <i class="fas fa-info-circle"></i> Bienvenue dans le système de gestion hospitalier
        </div>
    `;
}