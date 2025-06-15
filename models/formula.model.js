// server/models/formula.model.js

const mongoose = require('mongoose');

const formulaSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            unique: true, // Chaque formule doit avoir un titre unique
        },
        etiquette: {
            type: String,
            trim: true,
            default: '', // Peut être vide si pas d'étiquette spécifique
        },
        price: {
            type: Number, // Garde-le en String si tu veux inclure le symbole "€" directement
            // Alternativement, utilise Number pour le prix et gère le symbole côté client
            // type: Number,
            required: true,
            min: 0, // Assure que le prix est positif
        },
        duration: {
            type: Number, // Ex: "45 min", "60 min", "1h30 min"
            required: true,
            trim: true,
        },
        soins: {
            type: [String], // Un tableau de chaînes de caractères pour la liste des soins
            default: [],
        },
        raison: {
            type: String,
            trim: true,
            maxlength: 1000, // Une limite raisonnable pour la description
        },
        isActive: { // Pour activer/désactiver une formule sans la supprimer
            type: Boolean,
            default: true,
        }
    },
    {
        timestamps: true, // Ajoute createdAt et updatedAt
    }
);

const Formula = mongoose.model('Formula', formulaSchema);

module.exports = Formula;