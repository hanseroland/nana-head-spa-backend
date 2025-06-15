// server/models/rdv.model.js

const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Fait référence au modèle User (le client)
        required: [true, "Le client est requis pour le rendez-vous."]
    },
    formula: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Formula', // Fait référence au modèle Formula (la formule de soin choisie)
        required: [true, "La formule de soin est requise pour le rendez-vous."]
    },
    date: {
        type: Date,
        required: [true, "La date du rendez-vous est requise."],
        // Assure que seule la partie date est stockée pour une comparaison facile du jour
        // ou stocke-la comme une chaîne si tu veux une gestion plus simple côté frontend/backend
        // Pour l'instant, on la garde comme Date, mais tu peux la formater au besoin.
    },
    startTime: {
        type: String, // Heure de début au format "HH:MM" (ex: "09:00", "14:30")
        required: [true, "L'heure de début du rendez-vous est requise."],
        match: [/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, "L'heure de début doit être au format HH:MM."]
    },
    endTime: {
        type: String, // Heure de fin calculée au format "HH:MM"
        required: [true, "L'heure de fin du rendez-vous est requise."],
        match: [/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, "L'heure de fin doit être au format HH:MM."]
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'in_progress', 'completed'],
        default: 'pending', // Statut initial du rendez-vous
        required: true
    },
    adminNotes: {
        type: String,
        trim: true,
        maxlength: [500, "Les notes de l'administrateur ne peuvent pas dépasser 500 caractères."]
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Référence au modèle User (l'administrateur)
        // Non requis à la création, seulement quand un admin agit sur le RDV
    },
    cancellationReason: {
        type: String,
        trim: true,
        maxlength: [200, "Le motif d'annulation ne peut pas dépasser 200 caractères."]
    }
}, {
    timestamps: true // Ajoute createdAt et updatedAt automatiquement
});


const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;