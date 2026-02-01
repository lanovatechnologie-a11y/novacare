# LOTATO PRO - Système de Gestion de Loteries

## Description
Système complet de gestion de loteries pour agents, superviseurs et propriétaires.

## Installation

1. Clonez le repository
2. Installez les dépendances: `npm install`
3. Configurez les variables d'environnement dans `.env`
4. Initialisez la base de données: `npm run seed`
5. Démarrez le serveur: `npm start`

## Structure des fichiers

- `index.html` - Interface agent
- `login.html` - Page de connexion
- `owner.html` - Interface propriétaire
- `style.css` - Styles CSS
- `script.js` - Logique frontend agent
- `owner.js` - Logique frontend propriétaire
- `server.js` - API backend
- `seed-database.js` - Initialisation de la base de données

## Déploiement

### Sur Render.com
1. Créez un nouveau service Web
2. Connectez votre repository GitHub
3. Configurez les variables d'environnement
4. Déployez

### Sur Heroku
1. Créez une nouvelle app
2. Connectez votre repository
3. Déployez avec `git push heroku main`

## Accès

- URL de l'application: `https://votre-app.onrender.com`
- Compte propriétaire: `OWNER-001` / `owner123`
- Compte superviseur: `SUP-001` / `sup123`
- Compte agent: `AGENT-001` / `agent123`

## Sécurité

- Utilisation de JWT pour l'authentification
- Validation des données côté serveur
- Protection contre les attaques XSS et CSRF
- Mots de passe stockés (sans hash comme demandé)