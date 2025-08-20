// server/services/emailService.js

const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

// ✅ Mise à jour de la configuration du transporteur Nodemailer pour Gandi
const transporter = nodemailer.createTransport({
    host: process.env.GANDI_EMAIL_HOST,
    port: process.env.GANDI_EMAIL_PORT,
    secure: process.env.GANDI_EMAIL_SECURE === 'true', // `true` pour le port 465 (SSL/TLS)
    auth: {
        user: process.env.GANDI_EMAIL_USER,
        pass: process.env.GANDI_EMAIL_PASS,
    },
});

// En-tête des e-mails pour la marque
const emailHeader = `<div style="background-color: #f4f4f4; padding: 20px; text-align: center;">
    <h1 style="color: #6a1b9a;">Nana Head Spa</h1>
</div>`;

// Pied de page des e-mails
const emailFooter = `<div style="text-align: center; margin-top: 20px; color: #888;">
    <p>Ce mail a été envoyé automatiquement, veuillez ne pas y répondre.</p>
    <p>© ${new Date().getFullYear()} Nana Head Spa. Tous droits réservés.</p>
</div>`;

// Fonction générique pour envoyer un e-mail
const sendEmail = async (to, subject, htmlContent) => {
    try {
        const mailOptions = {
            from: `"Nana Head Spa" <${process.env.GANDI_EMAIL_USER}>`, // Utilise ton adresse e-mail professionnelle ici
            to,
            subject,
            html: `${emailHeader}${htmlContent}${emailFooter}`,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email envoyé à ${to} avec succès via Gandi.`);
    } catch (error) {
        console.error(`❌ Erreur lors de l'envoi de l'e-mail à ${to} via Gandi:`, error);
        // Ajoute ces lignes pour plus de détails sur l'erreur
        if (error.responseCode) {
            console.error(`Code de réponse SMTP: ${error.responseCode}`);
        }
        if (error.response) {
            console.error(`Réponse du serveur SMTP: ${error.response}`);
        }
    }
};

// Fonctions spécifiques pour chaque scénario (pas de changement ici)
const sendAppointmentConfirmationEmail = (to, clientName) => {
    const subject = 'Votre demande de rendez-vous chez Nana Head Spa';
    const htmlContent = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
            <h2>Bonjour ${clientName},</h2>
            <p>Merci d'avoir réservé un rendez-vous chez Nana Head Spa.</p>
            <p>Votre demande a bien été reçue. Nous allons la vérifier et vous enverrons un autre e-mail dès qu'elle sera confirmée.</p>
            <p>À bientôt !</p>
        </div>
    `;
    return sendEmail(to, subject, htmlContent);
};

const sendAppointmentConfirmedEmail = (to, clientName, appointmentDetails) => {
    const subject = 'Votre rendez-vous chez Nana Head Spa est confirmé !';
    const htmlContent = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
            <h2>Bonjour ${clientName},</h2>
            <p>Nous sommes heureux de vous confirmer votre rendez-vous.</p>
            <p>Détails du rendez-vous :</p>
            <ul>
                <li><strong>Date :</strong> ${appointmentDetails.date}</li>
                <li><strong>Heure :</strong> ${appointmentDetails.startTime}</li>
                <li><strong>Formule :</strong> ${appointmentDetails.formulaName}</li>
            </ul>
            <p>Nous vous attendons !</p>
        </div>
    `;
    return sendEmail(to, subject, htmlContent);
};

const sendAppointmentCancelledEmail = (to, clientName, appointmentDetails, reason) => {
    const subject = 'Annulation de votre rendez-vous chez Nana Head Spa';
    const htmlContent = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
            <h2>Bonjour ${clientName},</h2>
            <p>Nous vous informons que votre rendez-vous a été annulé.</p>
            <p>Détails du rendez-vous annulé :</p>
            <ul>
                <li><strong>Date :</strong> ${appointmentDetails.date}</li>
                <li><strong>Heure :</strong> ${appointmentDetails.startTime}</li>
                <li><strong>Raison :</strong> ${reason || 'Non spécifiée'}</li>
            </ul>
            <p>N'hésitez pas à nous contacter pour reprogrammer un rendez-vous.</p>
        </div>
    `;
    return sendEmail(to, subject, htmlContent);
};

module.exports = {
    sendAppointmentConfirmationEmail,
    sendAppointmentConfirmedEmail,
    sendAppointmentCancelledEmail,
};