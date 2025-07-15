// server/models/galleryImage.model.js

const mongoose = require('mongoose');

const galleryImageSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Le titre de l'image est requis."],
        trim: true,
        maxlength: [200, "Le titre ne peut pas dépasser 200 caractères."]
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, "La description ne peut pas dépasser 500 caractères."]
    },
    // Stockage des infos Cloudinary
    image: {
        public_id: {
            type: String,
            required: [true, "L'ID public de l'image Cloudinary est requis."],
            unique: true
        },
        url: {
            type: String,
            required: [true, "L'URL de l'image Cloudinary est requise."]
        }
    },
    // Pour ordonner les images dans la galerie
    order: {
        type: Number,
        default: 0
    },
    // Qui a ajouté l'image (optionnel)
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Peut être true si vous voulez l'associer à un admin
    }
}, {
    timestamps: true // Ajoute createdAt et updatedAt
});

const GalleryImage = mongoose.model('GalleryImage', galleryImageSchema);

module.exports = GalleryImage;