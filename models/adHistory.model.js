const mongoose = require('mongoose');

const adHistorySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    adId: { // Si les publicités ont des IDs uniques (e.g., ID de la vidéo, ID de la campagne)
        type: String,
        required: false // Peut être optionnel si juste un marqueur de "pub vue"
    },
    watchedAt: {
        type: Date,
        default: Date.now,
        required: true
    },
    levelBeforeAd: { // Utile pour l'historique : quel était le niveau avant de regarder cette pub
        type: Number,
        required: true
    },
    levelAfterAd: { // Utile pour l'historique : quel est le niveau après avoir regardé cette pub
        type: Number,
        required: true
    }
}, { timestamps: true });

const AdHistory = mongoose.model('AdHistory', adHistorySchema);

module.exports = AdHistory;