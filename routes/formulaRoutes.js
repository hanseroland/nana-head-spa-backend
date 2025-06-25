// server/routes/formulaRoutes.js

const express = require('express');
const router = express.Router();
const Formula = require('../models/formula.model.js'); // Importe le modèle Formula
const authMiddleware = require('../middlewares/authMiddleware'); // Pour l'authentification
const adminMiddleware = require('../middlewares/adminMiddleware'); // Pour la vérification du rôle admin
const mongoose = require('mongoose'); // Pour isValidObjectId

// --- ROUTES PUBLIQUES (consultation) ---

// GET toutes les formules (y compris inactives, à affiner si besoin)
router.get('/', async (req, res) => {
    try {
        const formulas = await Formula.find({ isActive: true }).sort({ createdAt: 1 });

        // --- MODIFICATION ICI ---
        // Renvoie toujours 200 OK pour une liste, même si elle est vide.
        // C'est la sémantique HTTP correcte pour une collection.
        res.status(200).json({
            success: true,
            message: formulas.length > 0 ? 'Formules récupérées avec succès.' : 'Aucune formule active trouvée.',
            data: formulas
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des formules :", error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération des formules.', error: error.message });
    }
});

// GET une formule par ID (pour les détails d'une formule spécifique)
router.get('/:id', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'ID de formule invalide.' });
    }
    try {
        const formula = await Formula.findById(req.params.id);
        if (!formula || !formula.isActive) {
            // Ici, 404 est correct car une ressource spécifique n'a pas été trouvée ou est inactive
            return res.status(404).json({ success: false, message: 'Formule introuvable ou inactive.' });
        }
        res.status(200).json({ success: true, message: 'Formule récupérée avec succès.', data: formula });
    } catch (error) {
        console.error("Erreur lors de la récupération de la formule :", error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération de la formule.', error: error.message });
    }
});



// --- ROUTES ADMINISTRATEUR (gestion) ---
// Ces routes nécessitent d'être authentifié ET d'avoir le rôle 'admin'.

// POST Créer une nouvelle formule
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { title, etiquette, price, duration, soins, raison, isActive } = req.body;

        // Validation simple côté serveur avant Mongoose
        if (!title || !price || !duration) {
            return res.status(400).json({ success: false, message: 'Les champs titre, prix, durée sont requis.' });
        }

        const newFormula = new Formula({
            title,
            etiquette,
            price,
            duration,
            soins: soins || [], // S'assure que c'est un tableau
            raison,
            isActive: isActive !== undefined ? isActive : true, // Gère isActive si fourni, sinon true
        });

        const savedFormula = await newFormula.save();
        res.status(201).json({ success: true, message: 'Formule créée avec succès.', data: savedFormula });

    } catch (error) {
        // Gérer spécifiquement l'erreur d'unicité du titre (code 11000)
        if (error.code === 11000 && error.keyPattern && error.keyPattern.title) {
            return res.status(409).json({ success: false, message: 'Une formule avec ce titre existe déjà.' });
        }
        console.error("Erreur lors de la création de la formule :", error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la création de la formule.', error: error.message });
    }
});

// PUT Mettre à jour une formule existante par ID
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'ID de formule invalide.' });
    }
    try {
        const updatedFormula = await Formula.findByIdAndUpdate(
            req.params.id,
            req.body, // req.body doit contenir les champs à mettre à jour
            { new: true, runValidators: true } // new: true pour retourner le doc mis à jour, runValidators pour revalider
        );

        if (!updatedFormula) {
            return res.status(404).json({ success: false, message: 'Formule introuvable.' });
        }
        res.status(200).json({ success: true, message: 'Formule mise à jour avec succès.', data: updatedFormula });

    } catch (error) {
        if (error.code === 11000 && error.keyPattern && error.keyPattern.title) {
            return res.status(409).json({ success: false, message: 'Une autre formule avec ce titre existe déjà.' });
        }
        console.error("Erreur lors de la mise à jour de la formule :", error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la mise à jour de la formule.', error: error.message });
    }
});

// DELETE Supprimer une formule par ID
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'ID de formule invalide.' });
    }
    try {
        const deletedFormula = await Formula.findByIdAndDelete(req.params.id);
        if (!deletedFormula) {
            return res.status(404).json({ success: false, message: 'Formule introuvable.' });
        }
        res.status(200).json({ success: true, message: 'Formule supprimée avec succès.' });
    } catch (error) {
        console.error("Erreur lors de la suppression de la formule :", error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la suppression de la formule.', error: error.message });
    }
});

module.exports = router;