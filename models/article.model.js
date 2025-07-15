// server/models/article.model.js

const mongoose = require('mongoose');
const slugify = require('slugify');

const articleSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Le titre de l'article est requis."],
        unique: true, // Assure que chaque titre est unique
        trim: true, // Supprime les espaces blancs inutiles
        minlength: [3, "Le titre doit contenir au moins 3 caractères."],
        maxlength: [200, "Le titre ne peut pas dépasser 200 caractères."]
    },
    slug: {
        type: String,
        unique: true, // Le slug doit également être unique
        lowercase: true, // Convertit le slug en minuscules
        index: true // Crée un index pour des recherches rapides
    },
    category: {
        type: String,
        required: [true, "La catégorie de l'article est requise."],
        enum: ['nouveauté', 'conseil'], // Limite les valeurs possibles pour la catégorie
        lowercase: true
    },
    content: {
        type: String,
        required: [true, "Le contenu de l'article est requis."],
        minlength: [50, "Le contenu doit contenir au moins 50 caractères."]
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Fait référence au modèle User (assure-toi d'avoir un modèle User)
        required: [true, "L'auteur de l'article est requis."]
    },
    // ✅ MODIFICATION ICI : Structure l'image pour Cloudinary
    image: {
        public_id: {
            type: String,
            // Ne pas mettre 'required' ici si l'image peut être optionnelle ou avoir une valeur par défaut
        },
        url: {
            type: String,
            default: 'https://via.placeholder.com/600x400?text=Article+Image', // URL d'image par défaut
        }
    },
    publishedAt: {
        type: Date,
        default: Date.now // Définit la date de publication par défaut à la date actuelle
    },
    isPublished: {
        type: Boolean,
        default: false // Par défaut, un article n'est pas publié
    }
}, {
    timestamps: true // Ajoute createdAt et updatedAt automatiquement
});

// Middleware Mongoose pour générer le slug avant de sauvegarder
articleSchema.pre('save', function (next) {
    if (this.isModified('title') || !this.slug) { // Génère le slug si le titre est modifié ou s'il n'y a pas de slug
        this.slug = slugify(this.title, { lower: true, strict: true });
    }
    next();
});

// Gérer les cas où un slug unique ne peut pas être généré immédiatement (ex: titre similaire)
articleSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate();
    if (update.title) {
        update.slug = slugify(update.title, { lower: true, strict: true });
    }
    next();
});


const Article = mongoose.model('Article', articleSchema);

module.exports = Article;