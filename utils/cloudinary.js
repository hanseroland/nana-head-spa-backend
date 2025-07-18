// server/utils/cloudinary.js

const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * @function uploadMediaToCloudinary
 * @description Uploads a file (image or video) to Cloudinary.
 * @param {string} filePath - The temporary path of the file on the server.
 * @param {string} resourceType - 'image' or 'video'.
 * @param {string} folder - The target folder in Cloudinary (e.g., 'nana-head-spa-banners').
 * @returns {Promise<{success: boolean, public_id?: string, url?: string, message?: string}>}
 */
const uploadMediaToCloudinary = async (filePath, resourceType = 'image', folder = 'nana-head-spa-banners') => {
    try {
        const options = {
            folder: folder,
            resource_type: resourceType, // Crucial: 'image' or 'video'
            // Vous pouvez ajouter d'autres options ici, par ex. pour la transformation vidéo si besoin
            // par ex. chunk_size: 6000000 (pour les grandes vidéos)
        };

        const result = await cloudinary.uploader.upload(filePath, options);

        return {
            success: true,
            public_id: result.public_id,
            url: result.secure_url
        };
    } catch (error) {
        console.error(`Erreur lors de l'upload ${resourceType} sur Cloudinary :`, error);
        // Cloudinary renvoie des erreurs avec `error.message` et `error.http_code`
        return {
            success: false,
            message: error.message || "Erreur inconnue lors de l'upload sur Cloudinary."
        };
    }
};

/**
 * @function deleteMediaFromCloudinary
 * @description Deletes a media file (image or video) from Cloudinary.
 * @param {string} publicId - The public ID of the media file to delete.
 * @param {string} resourceType - 'image' or 'video'. (Must match the original upload type)
 * @returns {Promise<{success: boolean, message?: string}>}
 */
const deleteMediaFromCloudinary = async (publicId, resourceType = 'image') => {
    try {
        // La destruction nécessite le bon 'resource_type' si ce n'est pas 'image'
        const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });

        if (result.result === 'ok') {
            return { success: true, message: "Média supprimé de Cloudinary." };
        } else {
            console.warn(`Cloudinary deletion not 'ok' for public_id: ${publicId}. Result:`, result);
            return { success: false, message: result.result || "Échec de la suppression du média sur Cloudinary." };
        }
    } catch (error) {
        console.error(`Erreur lors de la suppression du média ${resourceType} sur Cloudinary :`, error);
        return { success: false, message: error.message || "Erreur inconnue lors de la suppression sur Cloudinary." };
    }
};

module.exports = {
    uploadMediaToCloudinary, // Renommez ou gardez l'ancien nom si vous le souhaitez
    deleteMediaFromCloudinary // Renommez ou gardez l'ancien nom si vous le souhaitez
};