// backend/models/conversationModel.js
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    participants: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // Fait référence à votre modèle User
            required: true,
        },
    ],
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message', // Fait référence au modèle Message que nous allons créer
        default: null, // Peut être null si aucune message n'a encore été envoyé
    },

}, {
    timestamps: true, // Ajoute automatiquement createdAt et updatedAt
});

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;