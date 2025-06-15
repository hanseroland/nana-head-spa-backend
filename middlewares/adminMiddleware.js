// server/middlewares/adminMiddleware.js

module.exports = function (req, res, next) {
    // req.user.userId est défini par authMiddleware
    // Nous devons récupérer l'utilisateur complet pour vérifier son rôle
    // Ou, si tu modifies authMiddleware pour inclure le rôle directement dans req.user, ce serait plus performant.
    // Pour l'instant, partons du principe que authMiddleware a déjà attaché le rôle si possible.

    // Si tu as modifié authMiddleware pour attacher le rôle comme ceci:
    // req.user = { userId: decryptedData.userId, role: decryptedData.role };
    if (req.user && req.user.role === 'admin') {
        next(); // L'utilisateur est un admin, on continue
    } else {
        // Optionnel : tu pourrais récupérer l'utilisateur de la base de données ici
        // pour vérifier son rôle si authMiddleware ne l'attache pas.
        // Mais pour la performance, il est préférable de le faire dans authMiddleware
        // ou de s'assurer que le token contient le rôle.

        return res.status(403).json({ success: false, message: "Accès refusé. Admin requis." });
    }
};