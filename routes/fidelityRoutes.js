const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware'); // Pour l'authentification
const User = require('../models/user.model');
const AdHistory = require('../models/adHistory.model');

// Fonction utilitaire pour vérifier si un jour s'est écoulé
const isNewDay = (lastAdWatchedAt) => {
    if (!lastAdWatchedAt) return true; // Jamais regardé de pub, donc c'est un nouveau jour

    const lastDate = new Date(lastAdWatchedAt);
    const now = new Date();

    // Comparaison basée sur la date sans l'heure
    return (
        now.getFullYear() > lastDate.getFullYear() ||
        now.getMonth() > lastDate.getMonth() ||
        now.getDate() > lastDate.getDate()
    );
};

// POST : Permet au client de regarder une pub et de passer un niveau
// Route: POST /api/v1/fidelity/watch-ad
router.post('/watch-ad', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId; // ID du client authentifié
        const { adId } = req.body; // Optionnel: ID de la pub si vous en avez plusieurs

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
        }

        const currentLevel = user.fidelity.level;
        const lastAdTime = user.fidelity.lastAdWatchedAt;

        // Vérifier si un nouveau jour s'est écoulé depuis la dernière pub visionnée
        if (!isNewDay(lastAdTime)) {
            return res.status(400).json({ success: false, message: 'Vous avez déjà progressé aujourd\'hui. Revenez demain !' });
        }

        // Vérifier la limite de 1000 niveaux
        if (currentLevel >= 1000) {
            return res.status(400).json({ success: false, message: 'Félicitations ! Vous avez atteint le niveau maximum de 1000.' });
        }

        // Mettre à jour le niveau de l'utilisateur
        user.fidelity.level += 1;
        user.fidelity.lastAdWatchedAt = new Date(); // Enregistrer l'heure actuelle
        await user.save();

        // Enregistrer l'historique de la pub visionnée
        const adHistoryEntry = new AdHistory({
            user: userId,
            adId: adId,
            watchedAt: user.fidelity.lastAdWatchedAt,
            levelBeforeAd: currentLevel,
            levelAfterAd: user.fidelity.level
        });
        await adHistoryEntry.save();

        res.status(200).json({
            success: true,
            message: `Félicitations ! Vous êtes passé au niveau ${user.fidelity.level}.`,
            data: {
                newLevel: user.fidelity.level,
                lastAdWatchedAt: user.fidelity.lastAdWatchedAt
            }
        });

    } catch (error) {
        console.error("Erreur lors du visionnage de la publicité :", error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la progression de fidélité.', error: error.message });
    }
});

// GET : Récupérer le niveau de fidélité et la dernière date de progression du client
// Route: GET /api/v1/fidelity/my-level
router.get('/my-level', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId).select('fidelity.level fidelity.lastAdWatchedAt'); // Sélectionne uniquement les champs nécessaires

        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
        }

        res.status(200).json({
            success: true,
            message: 'Niveau de fidélité récupéré avec succès.',
            data: user.fidelity
        });

    } catch (error) {
        console.error("Erreur lors de la récupération du niveau de fidélité :", error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération du niveau de fidélité.', error: error.message });
    }
});

// GET : Récupérer l'historique des publicités visionnées par le client
// Route: GET /api/v1/fidelity/ad-history
router.get('/ad-history', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const history = await AdHistory.find({ user: userId })
            .sort({ watchedAt: -1 }) // Du plus récent au plus ancien
            .limit(50); // Limite l'historique pour ne pas surcharger

        res.status(200).json({ success: true, message: 'Historique des publicités récupéré avec succès.', data: history });

    } catch (error) {
        console.error("Erreur lors de la récupération de l'historique des publicités :", error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération de l\'historique des publicités.', error: error.message });
    }
});


module.exports = router;