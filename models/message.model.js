// backend/models/messageModel.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation', // Fait référence au modèle Conversation
        required: true,
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Fait référence à votre modèle User
        required: true,
    },
    content: {
        type: String,
        required: true,
        trim: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
    readBy: [ // Pour savoir qui a lu le message (utile pour les accusés de lecture ou les compteurs de non lus)
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    ],
}, {
    timestamps: true, // Ajoute automatiquement createdAt et updatedAt
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;