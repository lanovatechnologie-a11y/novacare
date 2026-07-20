// ============================================================
//  API.JS — Couche d'appels au serveur backend
//  Toutes les fonctions retournent des promesses
// ============================================================

const API = (() => {

    function getToken() {
        return localStorage.getItem('hopital_token');
    }

    function getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
        };
    }

    async function request(method, path, body = null) {
        const opts = { method, headers: getHeaders() };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(CONFIG.API_URL + path, opts);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
        return data;
    }

    return {

        // ── Auth ──────────────────────────────────────────────
        login: (username, password, role) =>
            request('POST', '/auth/login', { username, password, role }),

        // ── Paramètres hôpital ────────────────────────────────
        getSettings:  ()      => request('GET',  '/settings'),
        saveSettings: (data)  => request('PUT',  '/settings', data),

        // ── Utilisateurs ─────────────────────────────────────
        getUsers:     ()          => request('GET',    '/users'),
        addUser:      (data)      => request('POST',   '/users', data),
        updateUser:      (id, data)  => request('PUT',    `/users/${id}`, data),
        updateUserPassword: (id, pwd)  => request('PUT',    `/users/${id}/password`, { password: pwd }),
        deleteUser:   (id)        => request('DELETE', `/users/${id}`),

        // ── Patients ─────────────────────────────────────────
        getPatients: (params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return request('GET', '/patients' + (qs ? '?' + qs : ''));
        },
        getPatient:      (id)       => request('GET',  `/patients/${id}`),
        createPatient:   (data)     => request('POST', '/patients', data),
        updatePrivilege: (id, data) => request('PUT',  `/patients/${id}/privileges`, data),

        // ── Transactions ──────────────────────────────────────
        getTransactions: (params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return request('GET', '/transactions' + (qs ? '?' + qs : ''));
        },
        payTransactions:   (ids, method) => request('POST', '/transactions/pay', { transactionIds: ids, paymentMethod: method }),
        getReceipt:        (receiptNumber) => request('GET', `/transactions/receipt/${encodeURIComponent(receiptNumber)}`),
        getReceiptsByPatient: (patientId) => request('GET', `/transactions/receipts-by-patient/${encodeURIComponent(patientId)}`),
        getAllReceipts: (params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return request('GET', '/transactions/receipts' + (qs ? '?' + qs : ''));
        },
        addTransaction:    (data)        => request('POST', '/transactions/add', data),
        saveLabResult:     (id, result)  => request('PUT',  `/transactions/${id}/lab-result`, { result }),
        updateTransactionConsultationType: (id, typeId) => request('PUT', `/transactions/${id}/consultation-type`, { consultationTypeId: typeId }),
        deliverMedication: (id)          => request('PUT',  `/transactions/${id}/deliver`, {}),
        updateTransaction: (id, data)    => request('PUT',    `/transactions/${id}`, data),
        deleteTransaction: (id)          => request('DELETE', `/transactions/${id}`),

        // ── Signes vitaux ─────────────────────────────────────
        getVitals:    (patientId) => request('GET',  `/vitals/${patientId}`),
        addVitals:    (data)      => request('POST', '/vitals', data),
        updateVitals: (id, data)  => request('PUT',  `/vitals/${id}`, data),

        // ── Consultations ─────────────────────────────────────
        getConsultations: (patientId) => request('GET',  `/consultations/${patientId}`),
        addConsultation:  (data)      => request('POST', '/consultations', data),

        // ── Médicaments ───────────────────────────────────────
        getMedications:   ()          => request('GET',    '/medications'),
        addMedication:    (data)      => request('POST',   '/medications', data),
        updateMedication: (id, data)  => request('PUT',    `/medications/${id}`, data),
        deleteMedication: (id)        => request('DELETE', `/medications/${id}`),

        // ── Types de consultation ─────────────────────────────
        getConsultationTypes:   ()          => request('GET',    '/consultation-types'),
        addConsultationType:    (data)      => request('POST',   '/consultation-types', data),
        updateConsultationType: (id, data)  => request('PUT',    `/consultation-types/${id}`, data),
        deleteConsultationType: (id)        => request('DELETE', `/consultation-types/${id}`),

        // ── Types de signes vitaux ────────────────────────────
        getVitalTypes:   ()          => request('GET',    '/vital-types'),
        addVitalType:    (data)      => request('POST',   '/vital-types', data),
        updateVitalType: (id, data)  => request('PUT',    `/vital-types/${id}`, data),
        deleteVitalType: (id)        => request('DELETE', `/vital-types/${id}`),

        // ── Types d'analyses labo ─────────────────────────────
        getLabAnalysisTypes:   ()          => request('GET',    '/lab-analysis-types'),
        addLabAnalysisType:    (data)      => request('POST',   '/lab-analysis-types', data),
        updateLabAnalysisType: (id, data)  => request('PUT',    `/lab-analysis-types/${id}`, data),
        deleteLabAnalysisType: (id)        => request('DELETE', `/lab-analysis-types/${id}`),

        // ── Types de services externes ────────────────────────
        getExternalServiceTypes:   ()          => request('GET',    '/external-service-types'),
        addExternalServiceType:    (data)      => request('POST',   '/external-service-types', data),
        updateExternalServiceType: (id, data)  => request('PUT',    `/external-service-types/${id}`, data),
        deleteExternalServiceType: (id)        => request('DELETE', `/external-service-types/${id}`),

        // ── Rendez-vous ───────────────────────────────────────
        getAppointments: (params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return request('GET', '/appointments' + (qs ? '?' + qs : ''));
        },
        addAppointment:    (data)      => request('POST', '/appointments', data),
        updateAppointment: (id, data)  => request('PUT',  `/appointments/${id}`, data),

        // ── Messagerie ────────────────────────────────────────
        getMessages:    ()     => request('GET',  '/messages'),
        getUnreadCount: ()     => request('GET',  '/messages/unread-count'),
        sendMessage:    (data) => request('POST', '/messages', data),
        markRead:       (id)   => request('PUT',  `/messages/${id}/read`, {}),
        markAllRead:    ()     => request('PUT',  '/messages/read-all', {}),

        // ── Comptes patients ──────────────────────────────────
        createPatientAccount: (patientId, password) =>
            request('POST', '/patient-accounts', { patientId, password }),
        deletePatientAccount: (patientId) =>
            request('DELETE', `/patient-accounts/${patientId}`),

        // ── Gestion de caisse (retraits / commissions) ────────
        getCashWithdrawals: (params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return request('GET', '/cash-withdrawals' + (qs ? '?' + qs : ''));
        },
        addCashWithdrawal:    (data) => request('POST',   '/cash-withdrawals', data),
        deleteCashWithdrawal: (id)   => request('DELETE', `/cash-withdrawals/${id}`),

        // ── Fournisseurs ──────────────────────────────────────
        getSuppliers:    ()          => request('GET',    '/suppliers'),
        addSupplier:     (data)      => request('POST',   '/suppliers', data),
        updateSupplier:  (id, data)  => request('PUT',    `/suppliers/${id}`, data),
        deleteSupplier:  (id)        => request('DELETE', `/suppliers/${id}`),

        // ── Achats fournisseurs ───────────────────────────────
        getSupplierPurchases: (params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return request('GET', '/supplier-purchases' + (qs ? '?' + qs : ''));
        },
        addSupplierPurchase:    (data) => request('POST',   '/supplier-purchases', data),
        deleteSupplierPurchase: (id)   => request('DELETE', `/supplier-purchases/${id}`),

        // ── Paiements partiels fournisseurs ───────────────────
        getSupplierPayments: (params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return request('GET', '/supplier-payments' + (qs ? '?' + qs : ''));
        },
        addSupplierPayment: (data) => request('POST', '/supplier-payments', data),

        // ── Gestion de caisse (retraits / commissions) ────────
        getCashWithdrawals: (params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return request('GET', '/cash-withdrawals' + (qs ? '?' + qs : ''));
        },
        addCashWithdrawal:    (data) => request('POST',   '/cash-withdrawals', data),
        deleteCashWithdrawal: (id)   => request('DELETE', `/cash-withdrawals/${id}`),

        // ── Petite caisse ──────────────────────────────────────
        getPetiteCaisse:    ()      => request('GET',    '/petite-caisse'),
        addPetiteCaisse:    (data)  => request('POST',   '/petite-caisse', data),
        deletePetiteCaisse: (id)    => request('DELETE', `/petite-caisse/${id}`),

        // ── Stats admin ───────────────────────────────────────
        getStats: (params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return request('GET', '/stats' + (qs ? '?' + qs : ''));
        },

        // ── Hospitalisation ────────────────────────────────────
        getHospitalizations: (params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return request('GET', '/hospitalizations' + (qs ? '?' + qs : ''));
        },
        getHospitalization:    (id)   => request('GET',  `/hospitalizations/${id}`),
        admitPatient:          (data) => request('POST', '/hospitalizations', data),
        updateHospitalization: (id, data) => request('PUT', `/hospitalizations/${id}`, data),

        getHospDeposits: (hospId) => request('GET',  `/hosp-deposits/${hospId}`),
        addHospDeposit:  (data)   => request('POST', '/hosp-deposits', data),

        getHospPrescriptions:  (hospId)     => request('GET',  `/hosp-prescriptions/${hospId}`),
        getAllHospPrescriptions: (params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return request('GET', '/hosp-prescriptions' + (qs ? '?' + qs : ''));
        },
        addHospPrescription:   (data)       => request('POST', '/hosp-prescriptions', data),
        updateHospPrescription:(id, data)   => request('PUT',  `/hosp-prescriptions/${id}`, data),

        getHospNursing: (hospId) => request('GET',  `/hosp-nursing/${hospId}`),
        addHospNursing: (data)   => request('POST', '/hosp-nursing', data),

        getHospServices: (hospId) => request('GET',  `/hosp-services/${hospId}`),
        addHospService:  (data)   => request('POST', '/hosp-services', data),
    };
})();
