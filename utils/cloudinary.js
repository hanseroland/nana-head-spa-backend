// backend/utils/cloudinary.js

const cloudinary = require('cloudinary').v2;
require('dotenv').config({ path: '../.env' }); // Charge les variables d'environnement


// Configure Cloudinary avec vos informations d'identification
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadImageToCloudinary = async (filePath) => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: 'nana-head-spa-articles', // Nom du dossier dans Cloudinary
            // Vous pouvez ajouter d'autres options comme `quality: 'auto:good'`, `fetch_format: 'auto'`
            // pour l'optimisation automatique
        });
        // `result` contiendra l'URL de l'image, son ID public, etc.
        return {
            success: true,
            public_id: result.public_id,
            url: result.secure_url, // Utilisez secure_url pour HTTPS
        };
    } catch (error) {
        console.error("Erreur lors de l'upload sur Cloudinary :", error);
        return { success: false, message: error.message };
    }
};

const deleteImageFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        if (result.result === 'ok') {
            return { success: true, message: 'Image Cloudinary supprimée.' };
        } else {
            return { success: false, message: result.result || 'Erreur lors de la suppression Cloudinary.' };
        }
    } catch (error) {
        console.error("Erreur lors de la suppression sur Cloudinary :", error);
        return { success: false, message: error.message };
    }
};

module.exports = { uploadImageToCloudinary, deleteImageFromCloudinary };