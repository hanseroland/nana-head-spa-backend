// server/models/pageBanner.model.js

const mongoose = require('mongoose');

const pageBannerSchema = new mongoose.Schema({
    pageName: {
        type: String,
        required: [true, "Le nom de la page est requis."],
        unique: true, // Chaque page aura une seule bannière
        enum: ['accueil', 'presentation', 'reservations', 'formules', 'contact', 'nouveautes', 'qui-suis-je', 'univers-de-nana-head-spa'], // Pages spécifiques
        lowercase: true,
        trim: true
    },
    type: {
        type: String,
        required: [true, "Le type de bannière (image ou vidéo) est requis."],
        enum: ['image', 'video']
    },
    // Stockage des infos Cloudinary pour l'image ou la vidéo
    media: {
        public_id: {
            type: String,
            required: [true, "L'ID public du média Cloudinary est requis."],
            unique: true // Public ID doit être unique pour chaque média
        },
        url: {
            type: String,
            required: [true, "L'URL du média Cloudinary est requise."]
        }
    },
    title: { // Titre affiché sur la bannière
        type: String,
        trim: true,
        maxlength: [200, "Le titre ne peut pas dépasser 200 caractères."]
    },
    subtitle: { // Sous-titre affiché sur la bannière
        type: String,
        trim: true,
        maxlength: [500, "Le sous-titre ne peut pas dépasser 500 caractères."]
    },
    lastUpdatedBy: { // Qui a mis à jour la bannière (optionnel)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    }
}, {
    timestamps: true // Ajoute createdAt et updatedAt
});

const PageBanner = mongoose.model('PageBanner', pageBannerSchema);

module.exports = PageBanner;