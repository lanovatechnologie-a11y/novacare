// ============================================================
//  FICHIER DE CONFIGURATION
// ============================================================

const CONFIG = {
    // En production (Render), l'API est sur le même domaine.
    // En local, changer par "http://localhost:3000"
    API_URL: window.location.origin === 'null' || window.location.origin === ''
        ? 'http://localhost:3000'
        : window.location.origin,

    HOSPITAL_NAME: "NovaCare",
    LOADING_DELAY: 300,
};

if (typeof module !== "undefined") module.exports = CONFIG;
