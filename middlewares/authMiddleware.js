// authMiddleware.js

const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const User = require('../models/user.model.js');
dotenv.config();

module.exports = async function (req, res, next) {
    try {
        const authorizationHeader = req.header('authorization');
        // console.log("Middleware: Header d'autorisation reçu:", authorizationHeader); // Décommente pour déboguer
        if (!authorizationHeader) {
            return res.status(401).send({
                success: false,
                message: 'Authorization header missing'
            });
        }

        const token = authorizationHeader.replace("Bearer ", "");
        // console.log("Middleware: Token extrait:", token); // Décommente pour déboguer

        // VÉRIFICATION CRUCIALE ICI
        // console.log("Middleware: JWT_SECRET utilisé:", process.env.JWT_SECRET); // <-- AJOUTE CECI

        const decryptedData = jwt.verify(token, process.env.JWT_SECRET);
        // console.log("Middleware: Données décryptées du token:", decryptedData); // Décommente pour déboguer

        const user = await User.findById(decryptedData.userId);

        // console.log("Middleware: Utilisateur trouvé dans la BD (via ID du token):", user); // Décommente pour déboguer
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur introuvable.',
            });
        }

        // --- MODIFICATION CRUCIALE ICI ---
        // Attache l'ID de l'utilisateur ET son rôle (récupéré de la BD) à req.user
        req.user = { userId: decryptedData.userId, role: user.role }; // Assure-toi que ton modèle User a un champ 'role'
        // ---------------------------------

        next();
    } catch (error) {
        console.error("Middleware Erreur DÉTAILLÉE:", error); // <-- Affiche l'objet erreur complet

        // C'est le message d'erreur réel de jwt.verify qui est capturé ici.
        // console.error("Middleware Erreur:", error.message); // <-- AJOUTE CECI POUR VOIR L'ERREUR RÉELLE
        return res.status(401).send({
            success: false,
            message: `Authentication failed: ${error.message}` // Ce message cache l'erreur réelle de JWT
        });
    }
};