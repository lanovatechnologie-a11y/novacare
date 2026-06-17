// ============================================================
//  FICHIER DE CONFIGURATION — À REMPLIR AVANT LE DÉPLOIEMENT
// ============================================================

const CONFIG = {
    // URL de votre serveur backend (Render.com ou local)
    // Exemple Render : "https://mon-hopital-api.onrender.com"
    // Exemple local  : "https://novacare-1-lkux.onrender.com"
    API_URL: "https://novacare-1-lkux.onrender.com",

    // Nom affiché de l'hôpital (valeur par défaut, modifiable dans Paramètres)
    HOSPITAL_NAME: "Hôpital Saint-Luc",

    // Délai en ms avant que les requêtes réseau affichent un spinner
    LOADING_DELAY: 300,
};

// NE PAS MODIFIER — export pour les autres fichiers JS
if (typeof module !== "undefined") module.exports = CONFIG;
