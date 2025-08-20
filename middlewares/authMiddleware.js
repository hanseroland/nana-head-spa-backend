// authMiddleware.js

const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const User = require('../models/user.model.js');
dotenv.config();

module.exports = async function (req, res, next) {
    try {
        // ✅ Lire le cookie nommé "token"
        const token = req.cookies?.token; // nécessite cookie-parser middleware dans Express

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token manquant (non trouvé dans le cookie)',
            });
        }

        // ✅ Vérifier le token
        const payload = jwt.verify(token, process.env.JWT_SECRET);


        const user = await User.findById(payload.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur introuvable.',
            });
        }
        req.user = { userId: payload.userId, role: user.role };

        next();
    } catch (error) {
        console.error("Middleware Erreur DÉTAILLÉE:", error);
        return res.status(401).send({
            success: false,
            message: `Authentication failed: ${error.message}`
        });
    }
};