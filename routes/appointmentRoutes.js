// server/routes/appointmentRoutes.js

const express = require('express');
const router = express.Router();
const Appointment = require('../models/appointment.model.js'); // Importe le modèle Appointment
const User = require('../models/user.model.js'); // Importe le modèle User (pour vérifier l'admin)
const Formula = require('../models/formula.model.js'); // Importe le modèle Formula (pour validation)
const authMiddleware = require('../middlewares/authMiddleware.js'); // Pour l'authentification
const adminMiddleware = require('../middlewares/adminMiddleware.js'); // Pour la vérification du rôle admin
const mongoose = require('mongoose');

// Helper pour formater l'heure de début/fin pour la comparaison
const parseTime = (timeString) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes; // Convertit en minutes depuis minuit
};

// --- ROUTES CLIENT (prise et gestion des rendez-vous) ---

// POST Créer un nouveau rendez-vous
// Route: POST /api/v1/appointments
// Le client doit être authentifié pour prendre un rendez-vous.
router.post('/', authMiddleware, async (req, res) => {

    try {
        const { date, startTime, endTime, formulaId } = req.body;
        const clientId = req.user.userId;  // ID du client authentifié


        // 1. Validation des champs requis
        if (!date || !startTime || !endTime || !formulaId) {
            return res.status(400).json({ success: false, message: 'La date, l\'heure de début, l\'heure de fin et la formule de soin sont requis.' });
        }

        // 2. Vérifier si la formule existe et est valide
        const formula = await Formula.findById(formulaId);
        if (!formula) {
            return res.status(404).json({ success: false, message: 'Formule de soin introuvable.' });
        }



        // 3. Vérifier que la date n'est pas passée et l'heure de début est future
        const appointmentDate = new Date(date);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());


        if (appointmentDate < today) {
            return res.status(400).json({ success: false, message: 'La date du rendez-vous ne peut pas être dans le passé.' });
        }

        // Si c'est aujourd'hui, vérifier l'heure de début
        if (appointmentDate.toDateString() === now.toDateString()) {
            const [currentHour, currentMinute] = [now.getHours(), now.getMinutes()];
            const currentTimeInMinutes = currentHour * 60 + currentMinute;
            const startTimeInMinutes = parseTime(startTime);

            if (startTimeInMinutes <= currentTimeInMinutes) {
                return res.status(400).json({ success: false, message: 'L\'heure de début du rendez-vous doit être dans le futur.' });
            }
        }


        // 4. Vérifier que l'heure de fin est après l'heure de début
        if (parseTime(endTime) <= parseTime(startTime)) {
            return res.status(400).json({ success: false, message: 'L\'heure de fin doit être après l\'heure de début.' });
        }

        // 5. Vérifier la disponibilité (pas de chevauchement d'autres rendez-vous pour ce créneau)
        const existingAppointment = await Appointment.findOne({
            date: appointmentDate,
            $or: [
                {
                    // Un rendez-vous existant commence pendant le nouveau rendez-vous
                    startTime: { $lt: endTime },
                    endTime: { $gt: startTime }
                },
                {
                    // Un rendez-vous existant se termine pendant le nouveau rendez-vous
                    startTime: { $lt: endTime },
                    endTime: { $gt: startTime }
                },
                {
                    // Un nouveau rendez-vous enveloppe un rendez-vous existant
                    startTime: { $lte: startTime },
                    endTime: { $gte: endTime }
                }
            ],
            // Exclure les rendez-vous annulés lors de la vérification de disponibilité
            status: { $nin: ['cancelled'] }
        });

        //console.log("existingAppointment  :", existingAppointment);

        if (existingAppointment) {
            return res.status(409).json({ success: false, message: 'Ce créneau horaire est déjà réservé. Veuillez choisir une autre heure.' });
        }

        // 6. Créer le rendez-vous
        const newAppointment = new Appointment({
            client: clientId,
            formula: formulaId,
            date: appointmentDate, // Date complète
            startTime,
            endTime,
            status: 'pending' // Par défaut en attente de confirmation
        });

        console.log("existingAppointment  :", newAppointment);

        const savedAppointment = await newAppointment.save();
        res.status(201).json({ success: true, message: 'Rendez-vous pris avec succès. En attente de confirmation.', data: savedAppointment });




    } catch (error) {
        console.error("Erreur lors de la prise de rendez-vous :", error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ success: false, message: errors.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la prise de rendez-vous.', error: error.message });
    }
});

// GET Obtenir les rendez-vous du client connecté
// Route: GET /api/v1/appointments/my
router.get('/my', authMiddleware, async (req, res) => {
    try {
        const clientId = req.user.userId;
        const clientAppointments = await Appointment.find({ client: clientId })
            .populate('formula') // Popule les détails de la formule
            .sort({ date: -1, startTime: -1 }); // Tri du plus récent au plus ancien

        res.status(200).json({ success: true, message: 'Vos rendez-vous ont été récupérés.', data: clientAppointments });
    } catch (error) {
        console.error("Erreur lors de la récupération des rendez-vous du client :", error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération de vos rendez-vous.', error: error.message });
    }
});


// Dans server/routes/appointmentRoutes.js
// Nouvelle route ou modification de l'existante
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const clientId = req.user.userId;
        const clientHistory = await Appointment.find({ client: clientId, status: 'completed' }) // FILTRE CLÉ ICI
            .populate('formula', 'title price',) // Popule le titre de la formule
            .populate('processedBy', 'firstName lastName') // Popule l'esthéticienne/admin
            .sort({ date: -1, startTime: -1 }); // Tri du plus récent au plus ancien

        res.status(200).json({ success: true, message: 'Votre historique de soins a été récupéré.', data: clientHistory });
    } catch (error) {
        console.error("Erreur lors de la récupération de l'historique des soins :", error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération de votre historique de soins.', error: error.message });
    }
});

// PUT Annuler un rendez-vous (par le client ou l'admin)
// Route: PUT /api/v1/appointments/:id/cancel
router.put('/:id/cancel', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { cancellationReason } = req.body;
        const userId = req.user.userId;
        const userRole = req.user.role;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de rendez-vous invalide.' });
        }

        const appointment = await Appointment.findById(id);

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Rendez-vous introuvable.' });
        }

        // Vérifier si l'utilisateur est le client du rendez-vous OU un administrateur
        if (appointment.client.toString() !== userId && userRole !== 'admin') {
            return res.status(403).json({ success: false, message: 'Accès refusé. Vous n\'êtes pas autorisé à annuler ce rendez-vous.' });
        }

        // Empêcher l'annulation si le rendez-vous est déjà passé ou déjà annulé/terminé
        const appointmentDateTime = new Date(`${appointment.date.toISOString().split('T')[0]}T${appointment.startTime}:00`);
        if (appointmentDateTime < new Date()) {
            return res.status(400).json({ success: false, message: 'Impossible d\'annuler un rendez-vous qui est déjà passé.' });
        }
        if (appointment.status === 'cancelled' || appointment.status === 'completed') {
            return res.status(400).json({ success: false, message: 'Ce rendez-vous est déjà annulé ou terminé.' });
        }

        appointment.status = 'cancelled';
        if (cancellationReason) {
            appointment.cancellationReason = cancellationReason;
        }
        // Si c'est un admin qui annule, enregistrer qui a traité
        if (userRole === 'admin') {
            appointment.processedBy = userId;
        }

        const updatedAppointment = await appointment.save();
        res.status(200).json({ success: true, message: 'Rendez-vous annulé avec succès.', data: updatedAppointment });

    } catch (error) {
        console.error("Erreur lors de l'annulation du rendez-vous :", error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ success: false, message: errors.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'annulation du rendez-vous.', error: error.message });
    }
});


// --- ROUTES ADMINISTRATEUR (gestion des rendez-vous) ---
// Ces routes nécessitent d'être authentifié ET d'avoir le rôle 'admin'.

// GET Obtenir tous les rendez-vous (pour l'admin)
// Route: GET /api/v1/appointments/admin
// Permet de filtrer par statut, date, etc.
router.get('/admin', authMiddleware, adminMiddleware, async (req, res) => {


    try {
        const { status, date, client } = req.query; // Filtres optionnels
        let query = {};

        if (status) {
            query.status = status;
        }
        if (date) {
            // Pour rechercher des rendez-vous à une date spécifique (ignorer l'heure)
            const startOfDay = new Date(date);
            startOfDay.setUTCHours(0, 0, 0, 0); // Début de la journée UTC
            const endOfDay = new Date(date);
            endOfDay.setUTCHours(23, 59, 59, 999); // Fin de la journée UTC
            query.date = { $gte: startOfDay, $lte: endOfDay };
        }
        if (client) {
            // Assurez-vous que client est un ObjectId valide si vous le recherchez par ID
            if (!mongoose.Types.ObjectId.isValid(client)) {
                return res.status(400).json({ success: false, message: 'ID client invalide pour le filtre.' });
            }
            query.client = client;
        }

        const allAppointments = await Appointment.find(query)
            .populate('client', 'firstName lastName email phone') // Popule les infos client
            .populate('formula', 'title price duration') // Popule les infos formule
            .populate('processedBy', 'firstName lastName') // Popule l'admin qui a traité
            .sort({ date: 1, startTime: 1 }); // Tri du plus ancien au plus récent


        res.status(200).json({ success: true, message: 'Rendez-vous récupérés avec succès.', data: allAppointments });
    } catch (error) {
        console.error("Erreur lors de la récupération de tous les rendez-vous :", error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération des rendez-vous.', error: error.message });
    }
});

// GET Obtenir un rendez-vous spécifique par ID (pour l'admin, peut être utilisé par client pour détails)
// Route: GET /api/v1/appointments/:id
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const userRole = req.user.role;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de rendez-vous invalide.' });
        }

        const appointment = await Appointment.findById(id)
            .populate('client', 'firstName lastName email phone')
            .populate('formula', 'title price duration')
            .populate('processedBy', 'firstName lastName');

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Rendez-vous introuvable.' });
        }

        // Vérifier si l'utilisateur est le client du rendez-vous OU un administrateur
        if (appointment.client.toString() !== userId && userRole !== 'admin') {
            return res.status(403).json({ success: false, message: 'Accès refusé. Vous n\'êtes pas autorisé à consulter ce rendez-vous.' });
        }

        res.status(200).json({ success: true, message: 'Rendez-vous récupéré avec succès.', data: appointment });
    } catch (error) {
        console.error("Erreur lors de la récupération du rendez-vous par ID :", error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération du rendez-vous.', error: error.message });
    }
});

// Route: PUT /api/v1/appointments/:id
// Cette route permettra la modification de plusieurs champs.
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {

    console.log("Requête de mise à jour de rendez-vous (admin) :", req.body);
    try {


        const { id } = req.params;
        const adminId = req.user.userId;
        const { date, startTime, endTime, formulaId, status, adminNotes, cancellationReason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de rendez-vous invalide.' });
        }

        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Rendez-vous introuvable.' });
        }

        // Mettre à jour les champs si présents dans la requête
        if (date !== undefined) {
            const newDate = new Date(date);
            // Validation de date si nécessaire (ex: pas dans le passé)
            if (newDate.toDateString() !== appointment.date.toDateString()) {
                // Si la date change, il faudra probablement re-valider la disponibilité
                // Pour l'instant, on se contente de la mise à jour, mais une validation complète
                // serait nécessaire pour une application robuste.
                appointment.date = newDate;
            }
        }
        if (startTime !== undefined) {
            // Validation du format HH:MM
            if (!/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(startTime)) {
                return res.status(400).json({ success: false, message: "L'heure de début doit être au format HH:MM." });
            }
            appointment.startTime = startTime;
        }
        if (endTime !== undefined) {
            // Validation du format HH:MM
            if (!/^(0[0-9]|1[0[0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)) {
                return res.status(400).json({ success: false, message: "L'heure de fin doit être au format HH:MM." });
            }
            // Vérifier que l'heure de fin est après l'heure de début si les deux sont fournis
            if (startTime !== undefined && parseTime(endTime) <= parseTime(startTime)) {
                return res.status(400).json({ success: false, message: 'L\'heure de fin doit être après l\'heure de début.' });
            } else if (startTime === undefined && parseTime(endTime) <= parseTime(appointment.startTime)) {
                return res.status(400).json({ success: false, message: 'L\'heure de fin doit être après l\'heure de début existante.' });
            }
            appointment.endTime = endTime;
        }
        if (formulaId !== undefined) {
            if (!mongoose.Types.ObjectId.isValid(formulaId)) {
                return res.status(400).json({ success: false, message: 'ID de formule invalide.' });
            }
            const formula = await Formula.findById(formulaId);
            if (!formula) {
                return res.status(404).json({ success: false, message: 'Formule de soin introuvable.' });
            }
            appointment.formula = formulaId;
        }
        if (status !== undefined) {
            if (!['pending', 'confirmed', 'cancelled', 'in_progress', 'completed'].includes(status)) {
                return res.status(400).json({ success: false, message: 'Statut invalide fourni.' });
            }
            appointment.status = status;
        }
        if (adminNotes !== undefined) {
            appointment.adminNotes = adminNotes;
        }
        if (cancellationReason !== undefined) {
            appointment.cancellationReason = cancellationReason;
        }

        // Toujours enregistrer l'admin qui a traité la modification
        appointment.processedBy = adminId;

        const updatedAppointment = await appointment.save();
        res.status(200).json({ success: true, message: 'Rendez-vous mis à jour avec succès.', data: updatedAppointment });

    } catch (error) {
        console.error("Erreur lors de la mise à jour du rendez-vous (admin):", error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ success: false, message: errors.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la mise à jour du rendez-vous.', error: error.message });
    }
});


// PUT Mettre à jour le statut d'un rendez-vous (par l'admin)
// Route: PUT /api/v1/appointments/:id/status
router.put('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNotes } = req.body;
        const adminId = req.user.userId; // ID de l'administrateur qui effectue l'action

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de rendez-vous invalide.' });
        }

        if (!status || !['pending', 'confirmed', 'cancelled', 'in_progress', 'completed'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Statut invalide fourni.' });
        }

        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Rendez-vous introuvable.' });
        }

        // Mettre à jour le statut et les notes si fournis
        appointment.status = status;
        if (adminNotes !== undefined) { // Permet de vider les notes si adminNotes est null/vide
            appointment.adminNotes = adminNotes;
        }
        appointment.processedBy = adminId; // Enregistre l'admin qui a modifié le statut

        const updatedAppointment = await appointment.save();
        res.status(200).json({ success: true, message: `Statut du rendez-vous mis à jour à '${status}'.`, data: updatedAppointment });

    } catch (error) {
        console.error("Erreur lors de la mise à jour du statut du rendez-vous :", error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ success: false, message: errors.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la mise à jour du statut du rendez-vous.', error: error.message });
    }
});







module.exports = router;