// server/routes/bannerRoutes.js

const express = require('express');
const router = express.Router();
const PageBanner = require('../models/pageBanner.model');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { uploadMediaToCloudinary, deleteMediaFromCloudinary } = require('../utils/cloudinary');


// Multer pour stockage temporaire
const upload = multer({
    dest: path.join(__dirname, '../temp_uploads/'),
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
            'video/mp4', 'video/webm', 'video/quicktime'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier de bannière invalide. Images (PNG, JPEG, JPG, WEBP) et Vidéos (MP4, WEBM, MOV) sont autorisées.'), false);
        }
    }
});

// --- Routes Admin pour les Bannières ---

// POST /api/v1/page-banners - Créer/Mettre à jour une bannière pour une page
// Cette route fonctionnera comme un upsert: elle créera si n'existe pas, ou mettra à jour.
// C'est pourquoi nous n'aurons probablement pas besoin d'une route PUT séparée pour l'ID.
router.post('/', authMiddleware, adminMiddleware, upload.single('media'), async (req, res) => {
    try {
        const { pageName, type, title, subtitle } = req.body;
        const file = req.file;

        if (!pageName || !type) {
            if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return res.status(400).json({ success: false, message: "Le nom de la page et le type de bannière sont requis." });
        }

        let existingBanner = await PageBanner.findOne({ pageName: pageName.toLowerCase() });

        if (file) {
            // Déterminez le resource_type basé sur le champ 'type' du formulaire
            const resourceType = type === 'video' ? 'video' : 'image';

            // Si une bannière existait déjà avec un média, supprime l'ancien média de Cloudinary
            if (existingBanner && existingBanner.media && existingBanner.media.public_id) {
                // ✅ Utilisez le type de ressource de l'ancien média pour la suppression
                const oldResourceType = existingBanner.type === 'video' ? 'video' : 'image';
                await deleteMediaFromCloudinary(existingBanner.media.public_id, oldResourceType);
            }

            // ✅ Appelez la fonction générique d'upload avec le resourceType correct
            const uploadResult = await uploadMediaToCloudinary(file.path, resourceType);
            fs.unlinkSync(file.path);

            if (!uploadResult.success) {
                return res.status(500).json({ success: false, message: uploadResult.message });
            }

            const mediaInfo = {
                public_id: uploadResult.public_id,
                url: uploadResult.url
            };

            const bannerData = {
                pageName: pageName.toLowerCase(),
                type,
                media: mediaInfo,
                title: title || '',
                subtitle: subtitle || '',
                lastUpdatedBy: req.user.userId
            };

            if (existingBanner) {
                Object.assign(existingBanner, bannerData);
                await existingBanner.save();
                return res.status(200).json({ success: true, message: "Bannière mise à jour avec succès.", data: existingBanner });
            } else {
                const newBanner = new PageBanner(bannerData);
                await newBanner.save();
                return res.status(201).json({ success: true, message: "Bannière créée avec succès.", data: newBanner });
            }

        } else {
            // Si aucun nouveau fichier n'est uploadé, on ne met à jour que le titre et le sous-titre
            // Ou on gère le cas `clearMedia`
            const clearMedia = req.body.clearMedia === 'true'; // Récupère le champ 'clearMedia' du FormData

            if (clearMedia && existingBanner && existingBanner.media && existingBanner.media.public_id) {
                // ✅ Supprimer le média existant si demandé
                const oldResourceType = existingBanner.type === 'video' ? 'video' : 'image';
                await deleteMediaFromCloudinary(existingBanner.media.public_id, oldResourceType);
                existingBanner.media = undefined; // Supprime le champ média
            } else if (!existingBanner && !clearMedia) {
                return res.status(400).json({ success: false, message: "Un fichier média est requis pour créer une nouvelle bannière." });
            }

            // Mise à jour des champs texte même sans nouveau fichier
            if (existingBanner) {
                existingBanner.title = title || '';
                existingBanner.subtitle = subtitle || '';
                existingBanner.type = type; // Le type peut changer même sans nouveau fichier
                existingBanner.lastUpdatedBy = req.user.userId;
                await existingBanner.save();
                return res.status(200).json({ success: true, message: "Bannière mise à jour avec succès (texte et/ou suppression média).", data: existingBanner });
            } else {
                // Cas où il n'y a pas de bannière existante, pas de fichier et pas de clearMedia (devrait être géré par la validation initiale)
                return res.status(400).json({ success: false, message: "Requête invalide: manque de données pour créer ou modifier." });
            }
        }

    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        console.error("Erreur lors de la gestion de la bannière:", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la gestion de la bannière.", error: error.message });
    }
});

// GET /api/v1/page-banners - Récupérer toutes les bannières (pour admin)
router.get('/', async (req, res) => {
    try {
        const banners = await PageBanner.find();
        res.status(200).json({ success: true, data: banners });
    } catch (error) {
        console.error("Erreur lors de la récupération des bannières:", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la récupération des bannières.", error: error.message });
    }
});

// GET /api/v1/page-banners/:pageName - Récupérer une bannière spécifique par nom de page (pour le frontend public)
router.get('/:pageName', async (req, res) => {
    try {
        const pageName = req.params.pageName.toLowerCase();
        const banner = await PageBanner.findOne({ pageName });
        if (!banner) {
            return res.status(404).json({ success: false, message: "Bannière introuvable pour cette page." });
        }
        res.status(200).json({ success: true, data: banner });
    } catch (error) {
        console.error("Erreur lors de la récupération de la bannière par nom de page:", error);
        res.status(500).json({ success: false, message: "Erreur serveur.", error: error.message });
    }
});

// DELETE /api/v1/page-banners/:id - Supprimer une bannière (admin seulement)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const deletedBanner = await PageBanner.findByIdAndDelete(req.params.id);
        if (!deletedBanner) {
            return res.status(404).json({ success: false, message: "Bannière introuvable." });
        }

        // Supprimer le média de Cloudinary
        if (deletedBanner.media && deletedBanner.media.public_id) {
            // ✅ Utilisez le type de ressource stocké dans la bannière pour la suppression
            const resourceTypeToDelete = deletedBanner.type === 'video' ? 'video' : 'image';
            await deleteMediaFromCloudinary(deletedBanner.media.public_id, resourceTypeToDelete);
        }

        res.status(200).json({ success: true, message: "Bannière supprimée avec succès." });
    } catch (error) {
        console.error("Erreur lors de la suppression de la bannière:", error);
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: "ID de bannière invalide." });
        }
        res.status(500).json({ success: false, message: "Erreur serveur lors de la suppression de la bannière.", error: error.message });
    }
});

module.exports = router;