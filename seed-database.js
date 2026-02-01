require('dotenv').config();
const mongoose = require('mongoose');

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(async () => {
    console.log('✅ MongoDB connecté pour le seeding');
    
    // Modèles
    const User = require('./models/User');
    const Draw = require('./models/Draw');
    const GameRule = require('./models/GameRule');
    
    // Nettoyer les collections
    await User.deleteMany({});
    await Draw.deleteMany({});
    await GameRule.deleteMany({});
    
    console.log('🗑️ Collections nettoyées');
    
    // Créer l'utilisateur propriétaire
    const owner = await User.create({
        userId: 'OWNER-001',
        name: 'Admin Propriétaire',
        email: 'admin@lotato.com',
        phone: '3411-0000',
        password: 'owner123', // Mot de passe en clair
        role: 'owner',
        online: true
    });
    
    console.log('👑 Propriétaire créé:', owner.userId);
    
    // Créer des superviseurs
    const supervisor1 = await User.create({
        userId: 'SUP-001',
        name: 'Jean Pierre',
        email: 'jean@lotato.com',
        phone: '3411-2233',
        password: 'sup123',
        role: 'supervisor',
        online: true
    });
    
    const supervisor2 = await User.create({
        userId: 'SUP-002',
        name: 'Marie Claire',
        email: 'marie@lotato.com',
        phone: '3411-4455',
        password: 'sup456',
        role: 'supervisor',
        online: false
    });
    
    console.log('👥 Superviseurs créés:', supervisor1.userId, supervisor2.userId);
    
    // Créer des agents
    const agents = [
        {
            userId: 'AGENT-001',
            name: 'Marc Antoine',
            email: 'marc@lotato.com',
            phone: '3411-6677',
            password: 'agent123',
            role: 'agent',
            supervisorId: 'SUP-001',
            location: 'Port-au-Prince',
            commission: 5,
            online: true
        },
        {
            userId: 'AGENT-002',
            name: 'Sophie Bernard',
            email: 'sophie@lotato.com',
            phone: '3411-8899',
            password: 'agent456',
            role: 'agent',
            supervisorId: 'SUP-001',
            location: 'Delmas',
            commission: 5,
            online: true
        },
        {
            userId: 'AGENT-003',
            name: 'Robert Pierre',
            email: 'robert@lotato.com',
            phone: '3411-0011',
            password: 'agent789',
            role: 'agent',
            supervisorId: 'SUP-002',
            location: 'Pétion-Ville',
            commission: 5,
            online: false,
            blocked: true
        }
    ];
    
    await User.insertMany(agents);
    console.log('👤 Agents créés:', agents.map(a => a.userId));
    
    // Créer les tirages
    const draws = [
        { drawId: 'flo_matin', name: 'Florida Matin', time: '13:30', active: true },
        { drawId: 'flo_soir', name: 'Florida Soir', time: '21:50', active: true },
        { drawId: 'ny_matin', name: 'New York Matin', time: '14:30', active: true },
        { drawId: 'ny_soir', name: 'New York Soir', time: '20:00', active: true },
        { drawId: 'ga_matin', name: 'Georgia Matin', time: '12:30', active: true },
        { drawId: 'ga_soir', name: 'Georgia Soir', time: '19:00', active: true },
        { drawId: 'tx_matin', name: 'Texas Matin', time: '11:30', active: true },
        { drawId: 'tx_soir', name: 'Texas Soir', time: '18:30', active: true },
        { drawId: 'tn_matin', name: 'Tunisia Matin', time: '10:00', active: true },
        { drawId: 'tn_soir', name: 'Tunisia Soir', time: '17:00', active: false }
    ];
    
    await Draw.insertMany(draws);
    console.log('🎰 Tirages créés:', draws.length);
    
    // Créer les règles de jeu
    const gameRules = [
        { game: 'borlette_lot1', multiplier: 60, description: 'Borlette 1er lot' },
        { game: 'borlette_lot2', multiplier: 20, description: 'Borlette 2ème lot' },
        { game: 'borlette_lot3', multiplier: 10, description: 'Borlette 3ème lot' },
        { game: 'lotto3', multiplier: 500, description: 'Lotto 3 chiffres' },
        { game: 'lotto4', multiplier: 1000, description: 'Lotto 4 chiffres' },
        { game: 'lotto5', multiplier: 5000, description: 'Lotto 5 chiffres' },
        { game: 'mariage', multiplier: 1000, description: 'Mariage' }
    ];
    
    await GameRule.insertMany(gameRules);
    console.log('📜 Règles de jeu créées:', gameRules.length);
    
    console.log('✅ Base de données initialisée avec succès!');
    console.log('\n📋 Comptes de test:');
    console.log('- Propriétaire: OWNER-001 / owner123');
    console.log('- Superviseur: SUP-001 / sup123');
    console.log('- Agent: AGENT-001 / agent123');
    
    process.exit(0);
    
}).catch(err => {
    console.error('❌ Erreur lors du seeding:', err);
    process.exit(1);
});