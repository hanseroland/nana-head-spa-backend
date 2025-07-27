// server/routes/galleryRoutes.js

const express = require('express');
const router = express.Router();
const GalleryImage = require('../models/galleryImage.model');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { uploadMediaToCloudinary, deleteMediaFromCloudinary } = require('../utils/cloudinary');

// Multer pour stockage temporaire
const upload = multer({
    dest: path.join(__dirname, '../temp_uploads/'),
    limits: { fileSize: 10 * 1024 * 1024 }, // Limite de taille: 10 Mo
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier image invalide. Seuls les PNG, JPEG, JPG, WEBP, GIF sont autorisés.'), false);
        }
    }
});

// --- Routes Admin pour la Galerie ---

// POST /api/v1/gallery-images - Ajouter une nouvelle image à la galerie
router.post('/', authMiddleware, adminMiddleware, upload.single('image'), async (req, res) => {
    try {
        const { title, description, order } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: "Un fichier image est requis." });
        }

        if (!title) {
            fs.unlinkSync(file.path); // Nettoie le fichier temporaire
            return res.status(400).json({ success: false, message: "Le titre de l'image est requis." });
        }

        // ✅ CORRECTION : Appel à uploadMediaToCloudinary
        const uploadResult = await uploadMediaToCloudinary(file.path, 'image', 'nana-head-spa-gallery');
        fs.unlinkSync(file.path); // Supprime le fichier temporaire

        if (!uploadResult.success) {
            return res.status(500).json({ success: false, message: uploadResult.message });
        }

        const newGalleryImage = new GalleryImage({
            title,
            description,
            order: order !== undefined ? order : 0,
            image: {
                public_id: uploadResult.public_id,
                url: uploadResult.url
            },
            uploadedBy: req.user.userId // Si vous voulez associer l'image à l'admin qui l'a uploadée
        });

        const savedImage = await newGalleryImage.save();
        res.status(201).json({ success: true, message: "Image ajoutée à la galerie.", data: savedImage });

    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        console.error("Erreur lors de l'ajout de l'image de galerie:", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de l'ajout de l'image.", error: error.message });
    }
});

// GET /api/v1/gallery-images - Récupérer toutes les images de la galerie (pour admin et public)
router.get('/', async (req, res) => {
    try {
        // Optionnel: trier par ordre, puis par date de création si l'ordre est identique
        const images = await GalleryImage.find().sort({ order: 1, createdAt: 1 });
        res.status(200).json({ success: true, data: images });
    } catch (error) {
        console.error("Erreur lors de la récupération des images de la galerie:", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la récupération des images.", error: error.message });
    }
});

// GET /api/v1/gallery-images/:id - Récupérer une image de galerie par ID (utile pour modification)
router.get('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const image = await GalleryImage.findById(req.params.id);
        if (!image) {
            return res.status(404).json({ success: false, message: "Image de galerie introuvable." });
        }
        res.status(200).json({ success: true, data: image });
    } catch (error) {
        console.error("Erreur lors de la récupération de l'image de galerie par ID:", error);
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: "ID d'image de galerie invalide." });
        }
        res.status(500).json({ success: false, message: "Erreur serveur.", error: error.message });
    }
});

// PUT /api/v1/gallery-images/:id - Modifier une image de la galerie
router.put('/:id', authMiddleware, adminMiddleware, upload.single('image'), async (req, res) => {
    try {
        const { title, description, order, clearImage } = req.body;
        const file = req.file;

        const galleryImage = await GalleryImage.findById(req.params.id);
        if (!galleryImage) {
            if (file && fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
            return res.status(404).json({ success: false, message: "Image de galerie introuvable." });
        }

        const updates = { title, description, order: order !== undefined ? order : galleryImage.order };

        // Logique de gestion de l'image
        // Logique de gestion de l'image
        if (file) {
            // Nouvelle image uploadée: supprimer l'ancienne et uploader la nouvelle
            if (galleryImage.image && galleryImage.image.public_id) {
                // ✅ CORRECTION : Appel à deleteMediaFromCloudinary avec 'image' comme resourceType
                await deleteMediaFromCloudinary(galleryImage.image.public_id, 'image');
            }
            // ✅ CORRECTION : Appel à uploadMediaToCloudinary
            const uploadResult = await uploadMediaToCloudinary(file.path, 'image', 'nana-head-spa-gallery');
            fs.unlinkSync(file.path);

            if (!uploadResult.success) {
                return res.status(500).json({ success: false, message: uploadResult.message });
            }
            updates.image = {
                public_id: uploadResult.public_id,
                url: uploadResult.url
            };
        } else if (clearImage === 'true') {

            if (galleryImage.image && galleryImage.image.public_id) {
                // ✅ CORRECTION : Appel à deleteMediaFromCloudinary
                await deleteMediaFromCloudinary(galleryImage.image.public_id, 'image');
            }
            updates.image = { public_id: null, url: 'https://via.placeholder.com/600x400?text=Image+Supprimée' }; // Ou un placeholder approprié
        }
        // Si ni file ni clearImage, l'image existante n'est pas modifiée.

        const updatedImage = await GalleryImage.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );

        res.status(200).json({ success: true, message: "Image de galerie mise à jour.", data: updatedImage });

    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        console.error("Erreur lors de la mise à jour de l'image de galerie:", error);
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: "ID d'image de galerie invalide." });
        }
        res.status(500).json({ success: false, message: "Erreur serveur lors de la mise à jour de l'image.", error: error.message });
    }
});

// DELETE /api/v1/gallery-images/:id - Supprimer une image de la galerie
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const deletedImage = await GalleryImage.findByIdAndDelete(req.params.id);
        if (!deletedImage) {
            return res.status(404).json({ success: false, message: "Image de galerie introuvable." });
        }

        // Supprimer l'image de Cloudinary
        if (deletedImage.image && deletedImage.image.public_id) {
            await deleteMediaFromCloudinary(deletedImage.image.public_id, 'image');
        }

        res.status(200).json({ success: true, message: "Image de galerie supprimée." });
    } catch (error) {
        console.error("Erreur lors de la suppression de l'image de galerie:", error);
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: "ID d'image de galerie invalide." });
        }
        res.status(500).json({ success: false, message: "Erreur serveur lors de la suppression de l'image.", error: error.message });
    }
});

module.exports = router;