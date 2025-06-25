const User = require('../models/user.model.js');
const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const multer = require('multer');
const dotenv = require('dotenv');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

dotenv.config();


const FILE_TYPE_MAP = {
    'image/png': 'png',
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpg',
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const isValid = FILE_TYPE_MAP[file.mimetype];
        let uploadError = new Error('Image invalide');

        if (isValid) {
            uploadError = null
        }
        cb(null, './public/profile/')
    },
    filename: function (req, file, cb) {

        const fileName = file.originalname.split(' ').join('-')
        const extension = FILE_TYPE_MAP[file.mimetype];
        cb(null, `${fileName}-${Date.now()}.${extension}`)
    }
})

const uploadOptions = multer({ storage: storage });


//afficher toutes les utilisateurs
router.get('/', async (req, res) => {
    const userList = await User.find()
        .select('-password')
        .sort({ 'createdAt': -1 });
    if (!userList) {
        res.status(500).send({
            success: false
        });
    }
    res.status(200).send({
        success: true,
        message: 'User fetched successfuly',
        data: userList
    });
});

// Obtenir les infos de l'utilisateur en cours
router.get('/current-user', authMiddleware, async (req, res) => {
    //console.log("cc");

    // Récupérer userId du middleware
    const userId = req.user.userId;

    try {
        //const userId = mongoose.Types.ObjectId(id);
        // console.log("current", userId);

        const user = await User.findById(userId)
            .select('-password');

        if (!user) {
            return res.status(404).send({
                success: false,
                message: 'User not found'
            });
        }

        return res.send({
            success: true,
            message: 'User fetched successfully',
            data: user,
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
});

//  Route pour compter les utilisateurs
router.get('/count', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        res.status(200).json({
            success: true,
            message: "Compteur à jour",
            count: userCount
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors du comptage des cartes NFC actives.' });
    }
});

router.get('/recent', authMiddleware, adminMiddleware, async (req, res) => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    try {
        const recentUsers = await User.find({ createdAt: { $gte: oneWeekAgo } });
        res.status(200).json({
            success: true,
            message: "Compteur à jour",
            count: recentUsers.length
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs récents.' });
    }
});

// Route: GET /api/v1/users/registrations-last-7-days
router.get('/registrations-last-7-days', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const endDate = new Date(); // Aujourd'hui
        endDate.setHours(23, 59, 59, 999); // Fin de la journée
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 6); // Les 7 derniers jours incluant aujourd'hui
        startDate.setHours(0, 0, 0, 0); // Début de la journée

        // Agrégation pour grouper par jour et compter les utilisateurs
        const registrations = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { "_id": 1 } // Trie par date
            }
        ]);

        // Formater les résultats pour inclure les jours sans inscription (count = 0)
        const result = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateString = d.toISOString().split('T')[0]; // Format 'YYYY-MM-DD'
            const found = registrations.find(reg => reg._id === dateString);
            result.push({
                date: dateString,
                count: found ? found.count : 0
            });
        }

        res.status(200).json({ success: true, message: 'Nouvelles inscriptions récupérées.', data: result });
    } catch (error) {
        console.error("Erreur API lors de la récupération des inscriptions récentes:", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la récupération des inscriptions récentes.", error: error.message });
    }
});

// Compter les utilisateurs par rôle
// Route: GET /api/v1/users/stats/counts-by-role
router.get('/stats/counts-by-role', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const userCounts = await User.aggregate([
            {
                $group: {
                    _id: "$role",
                    count: { $sum: 1 }
                }
            }
        ]);

        const totalClients = userCounts.find(item => item._id === 'client')?.count || 0;
        const totalAdmins = userCounts.find(item => item._id === 'admin')?.count || 0;
        const totalUsers = totalClients + totalAdmins;

        res.status(200).json({
            success: true,
            message: 'Statistiques utilisateurs récupérées.',
            data: {
                totalUsers,
                totalClients,
                totalAdmins
            }
        });
    } catch (error) {
        console.error("Erreur API lors de la récupération des stats utilisateurs:", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la récupération des statistiques utilisateurs.", error: error.message });
    }
});

// Route: GET /api/v1/users/stats/fidelity-engagement
router.get('/stats/fidelity-engagement', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        // Ex: Compter les utilisateurs avec un niveau de fidélité supérieur à un seuil
        const usersAboveLevel500 = await User.countDocuments({ fidelityLevel: { $gt: 500 } });
        const usersAboveLevel1000 = await User.countDocuments({ fidelityLevel: { $gt: 1000 } });

        // Compteur de publicités visionnées (si vous avez un champ 'adsWatchedCount' sur l'utilisateur ou un log)
        // Ceci est un exemple, ajustez selon votre modèle de données
        const totalAdsWatchedResult = await User.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: "$totalAdsWatched" } // <-- Utilise le nouveau champ
                }
            }
        ]);
        const totalAdsWatchedCount = totalAdsWatchedResult.length > 0 ? totalAdsWatchedResult[0].total : 0;

        // Engagement Clients: Clients actifs (ayant un RDV confirmé récemment ou connecté récemment)
        const activeClientThreshold = new Date();
        activeClientThreshold.setDate(activeClientThreshold.getDate() - 30); // Actif si RDV confirmé dans les 30 derniers jours ou dernière connexion

        // Option 1: Clients avec RDV confirmé récemment (plus précis pour "engagement")
        const activeClientsByAppointments = await Appointment.distinct('client', {
            status: 'confirmed',
            date: { $gte: activeClientThreshold }
        });
        const countActiveClientsByAppointments = activeClientsByAppointments.length;

        // Option 2 (si vous avez un champ lastLogin) : Clients connectés récemment
        // const activeClientsByLogin = await User.countDocuments({
        //     role: 'client',
        //     lastLogin: { $gte: activeClientThreshold }
        // });


        res.status(200).json({
            success: true,
            message: 'Statistiques de fidélité et engagement récupérées.',
            data: {
                usersAboveLevel500,
                usersAboveLevel1000,
                totalAdsWatchedCount,
                activeClientsCount: countActiveClientsByAppointments,
                // retentionRate: 0.15 // Placeholder: le taux de rétention est complexe à calculer côté serveur sans plus de contexte
            }
        });
    } catch (error) {
        console.error("Erreur API lors de la récupération des stats de fidélité/engagement:", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la récupération des statistiques de fidélité et engagement.", error: error.message });
    }
});


// Route: GET /api/v1/users
router.get('/', authMiddleware, adminMiddleware, async (req, res) => { // AJOUT : authMiddleware, adminMiddleware
    const userList = await User.find()
        .select('-password')
        .sort({ 'createdAt': -1 });
    if (!userList) {
        res.status(500).send({
            success: false,
            message: 'Erreur lors de la récupération des utilisateurs.'
        });
    }
    res.status(200).send({
        success: true,
        message: 'Utilisateurs récupérés avec succès.',
        data: userList
    });
});

// Afficher les informations d'un seul utilisateur par son id
router.get('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Afficher les informations d'un seul utilisateur par son email
router.get('/email/:email', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email }).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});



// Création d'un compte utilisateur (par l'admin)
// Route: POST /api/v1/users/add
router.post('/add', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { firstName, lastName, email, password, role, phone } = req.body; // Récupère tous les champs nécessaires

        // Valider les champs requis pour la création par admin
        if (!firstName || !lastName || !email || !password || !role || !phone) {
            return res.status(400).send({ success: false, message: 'Tous les champs (prénom, nom, email, mot de passe, rôle, téléphone) sont requis.' });
        }

        // Vérifier si l'utilisateur existe déjà
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(409).send({ success: false, message: 'Un utilisateur avec cet email existe déjà.' });
        }

        // Valider le rôle : si un admin crée un utilisateur, il peut choisir le rôle,
        // mais assure-toi que les rôles envoyés sont valides (par ex. 'admin' ou 'client')
        // Tu peux ajouter une validation ici pour les rôles si tu veux restreindre les options.
        if (!['client', 'admin'].includes(role)) { // Assurez-vous que les rôles sont ceux définis dans votre enum
            return res.status(400).send({ success: false, message: 'Rôle utilisateur invalide.' });
        }

        // Hacher le mot de passe
        const hashedPassword = bcrypt.hashSync(password, 10);

        const newUser = new User({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            role, // Utilise le rôle envoyé dans le body
            phone,
            // Les champs de fidélité sont gérés par défaut dans le modèle
        });

        const savedUser = await newUser.save();

        res.status(201).send({
            success: true,
            message: `Utilisateur '${role}' créé avec succès.`,
            data: {
                id: savedUser._id,
                firstName: savedUser.firstName,
                lastName: savedUser.lastName,
                email: savedUser.email,
                role: savedUser.role,
                phone: savedUser.phone,
            },
        });
    } catch (err) {
        console.error("Erreur lors de la création de l'utilisateur par l'admin :", err);
        // Gérer les erreurs de validation Mongoose si `err.name === 'ValidationError'`
        res.status(500).send({ success: false, message: 'Erreur serveur lors de la création de l\'utilisateur.' });
    }
});





// Modifier les informations d'un utilisateur
router.put('/:id', authMiddleware, async (req, res) => {
    // console.log("pour modifier id",req.params.id)

    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'ID utilisateur invalide.' });
    }

    const updates = req.body;
    try {
        const updatedUser = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }
        res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route: PUT /api/v1/users/admin/:id
router.put('/admin/:id', authMiddleware, adminMiddleware, async (req, res) => { // AJOUT : authMiddleware, adminMiddleware
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'ID utilisateur invalide.' });
    }

    try {
        const userToUpdate = await User.findById(req.params.id);

        if (!userToUpdate) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }

        // --- LOGIQUE CLÉ : Autoriser la modification des admins seulement ---
        if (userToUpdate.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Accès refusé. Vous ne pouvez modifier que les utilisateurs avec le rôle "admin".' });
        }

        // Mettre à jour les champs autorisés.
        // N'autorise pas la modification du rôle ou du mot de passe via cette route directe ici
        // si c'est pour des raisons de sécurité ou si d'autres routes sont dédiées.
        // Pour l'instant, on laisse le rôle du userToUpdate inchangé.
        const { firstName, lastName, email, phone, role } = req.body; // Récupère les champs envoyés

        const updates = {};
        if (firstName !== undefined) updates.firstName = firstName;
        if (lastName !== undefined) updates.lastName = lastName;
        if (email !== undefined) updates.email = email;
        if (phone !== undefined) updates.phone = phone;

        // Si le rôle est envoyé, validez-le mais ne le permettez pas de changer si l'intention est de ne modifier que les admins.
        // Si tu veux permettre de changer le rôle d'un admin à un autre rôle, enlève cette condition.
        if (role !== undefined && userToUpdate.role !== role) {
            return res.status(400).json({ success: false, message: 'Le rôle d\'un utilisateur admin ne peut pas être modifié via cette interface.' });
        }


        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updates }, // Utilisez $set pour ne modifier que les champs spécifiés
            { new: true, runValidators: true } // new: true retourne le document mis à jour; runValidators: true exécute les validations du schéma
        ).select('-password'); // Ne renvoie pas le mot de passe

        if (!updatedUser) {
            // Cela ne devrait pas arriver si userToUpdate a été trouvé, mais par sécurité
            return res.status(500).json({ success: false, message: 'Erreur inattendue lors de la mise à jour de l\'utilisateur.' });
        }
        res.status(200).json({ success: true, message: 'Utilisateur "admin" mis à jour avec succès.', data: updatedUser });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de l'utilisateur par l'admin :", error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ success: false, message: errors.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la mise à jour de l\'utilisateur.', error: error.message });
    }
});

//Mise à jour de la photo de profile
router.put('/update-picture/:id', uploadOptions.single('profilePicture'), authMiddleware, async (req, res) => {

    const id = req.params.id;

    console.log("user id", id)

    const user = await User.findById(id);


    if (!user) return res.send({ succsess: false, message: 'User invalide' });

    const file = req.file;
    let imagePath;

    if (file) {
        const fileName = file.filename;
        const basePath = `${req.protocol}://${req.get('host')}/public/profile/`
        imagePath = `${basePath}${fileName}`
    } else {
        imagePath = user.profilePicture
    }

    const updatedPicture = await User.findByIdAndUpdate(
        id,
        {
            profilePicture: imagePath,
        },
        { new: true }
    );

    if (!updatedPicture)
        return res.send({
            success: false,
            message: 'Impossible de mettre à jour l\'image '
        });

    res.send({
        success: true,
        message: 'Photo enrégistrée',
        data: updatedPicture
    });
});



// Supprimer un utilisateur
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {


    try {

        const deletedUser = await User.findByIdAndDelete(req.params.id);

        if (!deletedUser) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }

        res.status(200).json({ success: true, message: 'Utilisateur supprimé avec succès.' });


    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;