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
        loyaltyLevel: {
            type: Number,
            default: 0,
        },
        watchedAdToday: {
            type: Boolean,
            default: false,
        },
        lastAdWatchedDate: {
            type: Date,
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