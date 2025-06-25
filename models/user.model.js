// server/models/user.model.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            required: true,
            trim: true,
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            match: [/.+\@.+\..+/, 'Veuillez entrer une adresse email valide'],
        },
        password: {
            type: String,
            required: true,
            minlength: 6,
            trim: true,
            // On ne veut pas que le mot de passe soit renvoyé dans les requêtes par défaut
            select: false,
        },
        role: {
            type: String,
            enum: ['client', 'admin'],
            default: 'client',
        },
        phone: {
            type: String,
            trim: true,
            required: true,
        },
        // --- Début des modifications pour la fidélisation ---
        fidelity: { // Regroupement des champs de fidélité dans un objet imbriqué
            level: {
                type: Number,
                default: 1, // Le client commence au niveau 1 (non 0, pour 1000 niveaux)
                min: 1,
                max: 1000 // Limite max de 1000 niveaux comme spécifié
            },
            lastAdWatchedAt: { // Stocke la date et l'heure de la dernière publicité vue pour le passage de niveau
                type: Date,
                default: null // Initialisation à null pour les nouveaux utilisateurs
            }
            // watchedAdToday est géré par la logique du `lastAdWatchedAt` et non un champ booléen persistant
            // Car 'aujourd'hui' est relatif et change chaque jour
        },
        // --- Fin des modifications pour la fidélisation ---,
        watchedAdToday: {
            type: Boolean,
            default: false,
        },
        lastAdWatchedDate: {
            type: Date,
        },
        totalAdsWatched: { // <-- AJOUTE CE CHAMP pour le compteur global par utilisateur
            type: Number,
            default: 0
        },
        resetPasswordToken: String,
        resetPasswordExpires: Date,
    },
    {
        timestamps: true, // Ajoute automatiquement les champs createdAt et updatedAt
    }
);



const User = mongoose.model('User', userSchema);

module.exports = User;