// server/middlewares/adminMiddleware.js

module.exports = function (req, res, next) {

    if (req.user && req.user.role === 'admin') {
        next(); // L'utilisateur est un admin, on continue
    } else {
        // L'utilisateur n'est pas un admin, on refuse l'accès
        return res.status(403).json({ success: false, message: "Accès refusé. Admin requis." });
    }
};