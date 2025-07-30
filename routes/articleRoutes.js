// server/routes/articleRoutes.js

const express = require('express');
const router = express.Router();
const Article = require('../models/article.model.js');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// ✅ Importe les fonctions Cloudinary
const { uploadMediaToCloudinary, deleteMediaFromCloudinary } = require('../utils/cloudinary');


// --- Configuration de Multer pour les images d'articles ---
const FILE_TYPE_MAP = {
    'image/png': 'png',
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpg',
    'image/webp': 'webp', // Ajout de webp si tu veux le supporter
};

/*const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const isValid = FILE_TYPE_MAP[file.mimetype];
        let uploadError = new Error('Type de fichier image invalide.');

        if (isValid) {
            uploadError = null;
        }
        // Assure-toi que ce chemin correspond à ton dossier public pour les images d'articles
        // Par exemple, './public/articles_images/'
        cb(uploadError, './public/article_image/'); // <-- Modifier le chemin de destination si besoin
    },
    filename: function (req, file, cb) {
        const fileName = file.originalname.split(' ').join('-');
        const extension = FILE_TYPE_MAP[file.mimetype];
        cb(null, `${fileName}-${Date.now()}.${extension}`);
    }
});*/

//const uploadOptions = multer({ storage: storage });


// --- Configuration de Multer pour les images d'articles ---
const upload = multer({
    dest: path.join(__dirname, '../temp_uploads/'), // Dossier temporaire non public
    limits: { fileSize: 5 * 1024 * 1024 }, // Limite de taille de fichier (ex: 5 Mo)
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier image invalide. Seuls les PNG, JPEG, JPG, WEBP sont autorisés.'), false);
        }
    }
});
// --------------------------------------------------------


// --- ROUTES ADMINISTRATEUR (gestion des articles) ---
// Ces routes nécessitent d'être authentifié ET d'avoir le rôle 'admin'.
// Route: POST /api/v1/articles
router.post('/', authMiddleware, adminMiddleware, upload.single('image'), async (req, res) => {
    try {
        const { title, category, content, isPublished } = req.body;
        const authorId = req.user.userId;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: "Une image est requise pour l'article." });
        }

        if (!title || !category || !content || !authorId) {
            if (fs.existsSync(file.path)) { // S'assurer que le fichier existe avant de tenter de le supprimer
                fs.unlinkSync(file.path); // Nettoie le fichier temporaire
            }
            return res.status(400).json({ success: false, message: 'Les champs titre, catégorie, contenu et auteur sont requis.' });
        }

        let imageInfo = {}; // Objet pour stocker les détails de l'image Cloudinary

        // ✅ CORRECTION : Appel à uploadMediaToCloudinary
        // Spécifier 'image' comme resourceType et un dossier pour les articles
        const uploadResult = await uploadMediaToCloudinary(file.path, 'image', 'nana-head-spa-gallery');

        // ✅ Supprime le fichier temporaire de Multer après l'upload vers Cloudinary
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        if (!uploadResult.success) {
            return res.status(500).json({ success: false, message: uploadResult.message });
        }

        imageInfo = {
            public_id: uploadResult.public_id,
            url: uploadResult.url,
        };

        const newArticle = new Article({
            title,
            category,
            content,
            author: authorId,
            image: imageInfo, // Assigne les infos Cloudinary
            isPublished: isPublished !== undefined ? isPublished : false,
        });

        const savedArticle = await newArticle.save();
        res.status(201).json({ success: true, message: 'Article créé avec succès.', data: savedArticle });

    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path); // Nettoyage en cas d'erreur
        }
        if (error.code === 11000 && error.keyPattern) {
            if (error.keyPattern.title) {
                return res.status(409).json({ success: false, message: 'Un article avec ce titre existe déjà.' });
            }
            if (error.keyPattern.slug) {
                return res.status(409).json({ success: false, message: 'Un article avec un slug similaire existe déjà.' });
            }
        }
        console.error("Erreur lors de la création de l'article :", error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ success: false, message: errors.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la création de l\'article.', error: error.message });
    }
});

// PUT Mettre à jour un article existant par son slug, avec possibilité de changer l'image
// Route: PUT /api/v1/articles/:slug
router.put('/:slug', authMiddleware, adminMiddleware, upload.single('image'), async (req, res) => {
    try {
        const { slug } = req.params;
        const { clearImage, ...updates } = req.body;
        const file = req.file;

        const articleToUpdate = await Article.findOne({ slug: slug });
        if (!articleToUpdate) {
            if (file && fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
            return res.status(404).json({ success: false, message: 'Article introuvable.' });
        }

        // Logique de gestion de l'image
        if (file) {
            // Un nouveau fichier a été uploadé. Supprimer l'ancienne image si elle existe et uploader la nouvelle.
            if (articleToUpdate.image && articleToUpdate.image.public_id) {
                // ✅ CORRECTION : Appel à deleteMediaFromCloudinary
                const deleteResult = await deleteMediaFromCloudinary(articleToUpdate.image.public_id, 'image');
                if (!deleteResult.success) {
                    console.warn(`Avertissement: Impossible de supprimer l'ancienne image Cloudinary ${articleToUpdate.image.public_id}: ${deleteResult.message}`);
                }
            }

            // ✅ CORRECTION : Uploader la nouvelle image sur Cloudinary
            const uploadResult = await uploadMediaToCloudinary(file.path, 'image', 'nana-head-spa-gallery');
            // ✅ Supprimer le fichier temporaire de Multer
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }

            if (!uploadResult.success) {
                return res.status(500).json({ success: false, message: uploadResult.message });
            }
            updates.image = {
                public_id: uploadResult.public_id,
                url: uploadResult.url,
            };
        } else if (clearImage === 'true') {
            // L'utilisateur a explicitement demandé de supprimer l'image existante
            if (articleToUpdate.image && articleToUpdate.image.public_id) {
                // ✅ CORRECTION : Appel à deleteMediaFromCloudinary
                const deleteResult = await deleteMediaFromCloudinary(articleToUpdate.image.public_id, 'image');
                if (!deleteResult.success) {
                    console.warn(`Avertissement: Impossible de supprimer l'ancienne image Cloudinary ${articleToUpdate.image.public_id}: ${deleteResult.message}`);
                }
            }
            updates.image = null; // Définissez le champ 'image' à null pour le modèle Mongoose
        }

        const updatedArticle = await Article.findOneAndUpdate(
            { slug: slug },
            updates,
            { new: true, runValidators: true }
        );

        if (!updatedArticle) {
            return res.status(404).json({ success: false, message: 'Article introuvable après mise à jour.' });
        }
        res.status(200).json({ success: true, message: 'Article mis à jour avec succès.', data: updatedArticle });

    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        if (error.code === 11000 && error.keyPattern && error.keyPattern.title) {
            return res.status(409).json({ success: false, message: 'Un autre article avec ce titre existe déjà.' });
        }
        console.error("Erreur lors de la mise à jour de l'article :", error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ success: false, message: errors.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la mise à jour de l\'article.', error: error.message });
    }
});

// DELETE Supprimer un article par son slug
// Route: DELETE /api/v1/articles/:slug
router.delete('/:slug', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const deletedArticle = await Article.findOneAndDelete({ slug: slug });
        if (!deletedArticle) {
            return res.status(404).json({ success: false, message: 'Article introuvable.' });
        }

        // ✅ CORRECTION : Supprimer l'image associée de Cloudinary si elle existe
        if (deletedArticle.image && deletedArticle.image.public_id) {
            const deleteResult = await deleteMediaFromCloudinary(deletedArticle.image.public_id, 'image');
            if (!deleteResult.success) {
                console.warn(`Avertissement: Impossible de supprimer l'image Cloudinary ${deletedArticle.image.public_id} lors de la suppression de l'article: ${deleteResult.message}`);
            }
        }

        res.status(200).json({ success: true, message: 'Article supprimé avec succès.' });
    } catch (error) {
        console.error("Erreur lors de la suppression de l'article :", error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la suppression de l\'article.', error: error.message });
    }
});

// --- ROUTES PUBLIQUES (consultation des articles) ---
// Ces routes peuvent être consultées par tous les utilisateurs (authentifiés ou non)

// GET tous les articles (filtrés pour n'afficher que les publiés si non admin)
// Route: GET /api/v1/articles
// Peut inclure des filtres par catégorie ou des options de pagination/tri à l'avenir.
router.get('/', async (req, res) => {
    try {
        let query = {};
        let limit = parseInt(req.query.limit) || 10;
        let skip = parseInt(req.query.skip) || 0;
        let sortOrder = req.query.sortOrder === 'asc' ? 1 : -1; // -1 pour décroissant (plus récent en premier)

        // Filtrage par statut de publication
        // Par défaut, seulement les articles publiés pour les routes publiques
        // `req.user` sera défini si l'utilisateur est authentifié et que le middleware `authMiddleware` est avant cette route
        // Cependant, cette route est publique, donc `req.user` ne sera probablement pas défini ici.
        // Nous allons donc toujours filtrer par `isPublished: true` pour la route publique `/articles`.
        query.isPublished = true;


        // Optionnel : filtre par catégorie
        if (req.query.category && req.query.category !== 'Toutes les catégories') {
            const category = req.query.category.toLowerCase();
            if (['nouveauté', 'conseil'].includes(category)) {
                query.category = category;
            }
        }

        // Optionnel : filtre par terme de recherche (titre ou contenu)
        if (req.query.searchTerm) {
            const searchTerm = req.query.searchTerm;
            query.$or = [
                { title: { $regex: searchTerm, $options: 'i' } },
                { content: { $regex: searchTerm, $options: 'i' } },
            ];
            // Si vous voulez rechercher aussi sur le nom de l'auteur, cela devient plus complexe
            // car l'auteur est dans une collection différente. Il faudrait faire une agrégation.
            // Pour l'instant, on se limite au titre et contenu.
        }

        // Compter le nombre total d'articles correspondant aux filtres
        const totalCount = await Article.countDocuments(query);

        // Récupérer les articles avec tous les filtres, la pagination, le tri et le peuplement de l'auteur
        const articles = await Article.find(query)
            .populate('author', 'firstName lastName avatar') // ✅ PEUPLEMENT DE L'AUTEUR ICI
            .sort({ publishedAt: sortOrder, createdAt: sortOrder }) // Tri par date de publication
            .limit(limit)
            .skip(skip);

        // Si aucune article n'est trouvée, renvoie un tableau vide avec 200 OK
        res.status(200).json({
            success: true,
            message: articles.length > 0 ? 'Articles récupérés avec succès.' : 'Aucun article trouvé.',
            data: articles,
            totalCount: totalCount // ✅ Renvoie le nombre total pour la pagination côté client
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des articles :", error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération des articles.', error: error.message });
    }
});

// GET un article spécifique par son slug
// Route: GET /api/v1/articles/:slug
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const article = await Article.findOne({ slug: slug }).populate('author', 'username email'); // Populate l'auteur (affiche son username et email)

        if (!article) {
            return res.status(404).json({ success: false, message: 'Article introuvable.' });
        }

        // Si l'utilisateur n'est pas un admin, il ne peut voir que les articles publiés
        if ((!req.user || req.user.role !== 'admin') && !article.isPublished) {
            return res.status(403).json({ success: false, message: 'Accès refusé. Cet article n\'est pas publié.' });
        }

        res.status(200).json({ success: true, message: 'Article récupéré avec succès.', data: article });
    } catch (error) {
        console.error("Erreur lors de la récupération de l'article par slug :", error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération de l\'article.', error: error.message });
    }
});

module.exports = router;