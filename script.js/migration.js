// scripts/migrateFormulasDuration.js

const mongoose = require('mongoose');
const Formula = require('../models/formula.model'); // Ajuste le chemin

// Remplace par ton URL de connexion MongoDB
const DB_URI = 'mongodb://localhost:27017/spa';


// Parse une chaîne de durée en minutes (Number)
const parseDurationToMinutes = (durationValue) => {
    if (typeof durationValue === 'number') {
        return durationValue; // Déjà un nombre
    }
    if (typeof durationValue === 'string') {
        durationValue = durationValue.trim();
        // Cas 1: "60 min", "45 min"
        const matchMin = durationValue.match(/(\d+)\s*min/i);
        if (matchMin) {
            return parseInt(matchMin[1], 10);
        }
        // Cas 2: "1h30", "1h30m", "1h"
        const matchHourMin = durationValue.match(/(\d+)\s*h\s*(\d*)\s*m?/i);
        if (matchHourMin) {
            const hours = parseInt(matchHourMin[1] || 0, 10);
            const minutes = parseInt(matchHourMin[2] || 0, 10);
            return hours * 60 + minutes;
        }
        // Cas 3: "45" (juste une chaîne numérique)
        const numOnly = parseInt(durationValue, 10);
        if (!isNaN(numOnly)) {
            return numOnly;
        }
    }
    return 0; // Valeur par défaut pour les formats non reconnus ou undefined/null
};

// Parse une chaîne de prix en nombre (Number)
const parsePriceToNumber = (priceValue) => {
    if (typeof priceValue === 'number') {
        return priceValue; // Déjà un nombre
    }
    if (typeof priceValue === 'string') {
        // Supprime tout sauf les chiffres et les points/virgules, puis remplace virgules par points
        const cleanedPriceStr = priceValue.replace(',', '.').replace(/[^\d.]/g, '');
        const num = parseFloat(cleanedPriceStr);
        if (!isNaN(num)) {
            return num;
        }
    }
    return 0; // Valeur par défaut pour les formats non reconnus ou undefined/null
};

// --- Logique de Migration ---

mongoose.connect(DB_URI)
    .then(async () => {
        console.log('Connecté à MongoDB pour la migration...');

        try {
            // Trouve toutes les formules
            const formulas = await Formula.find({});
            let updatedCount = 0;

            for (const formula of formulas) {
                let needsSave = false;

                // --- Migration de la durée ---
                const originalDuration = formula.duration;
                const newDuration = parseDurationToMinutes(originalDuration);

                // Si la durée actuelle n'est PAS un nombre et que la nouvelle durée est valide
                if (typeof originalDuration !== 'number' && newDuration > 0) {
                    formula.duration = newDuration;
                    needsSave = true;
                    console.log(`Formule "${formula.title}" : Durée mise à jour de "${originalDuration}" (string) à ${newDuration} (number) minutes.`);
                } else if (typeof originalDuration === 'number') {
                    // Si c'était déjà un nombre, on ne touche pas, mais on le log
                    console.log(`Formule "${formula.title}" : Durée (${originalDuration}) est déjà au format Number. Aucune action requise.`);
                } else {
                    // Si le parsing a échoué (0), ou si la durée est undefined/null
                    console.warn(`Formule "${formula.title}" : Impossible de parser la durée (valeur: "${originalDuration}"). Peut-être invalide ou manquante. Défini à ${newDuration}.`);
                    // Optionnel: tu peux forcer la sauvegarde d'un 0 ici si tu veux nettoyer
                    if (formula.duration !== newDuration) { // Pour éviter de sauvegarder si c'est déjà 0
                        formula.duration = newDuration;
                        needsSave = true;
                    }
                }

                // --- Migration du prix ---
                const originalPrice = formula.price;
                const newPrice = parsePriceToNumber(originalPrice);

                // Si le prix actuel n'est PAS un nombre et que le nouveau prix est valide
                if (typeof originalPrice !== 'number' && newPrice >= 0) { // Le prix peut être 0
                    formula.price = newPrice;
                    needsSave = true;
                    console.log(`Formule "${formula.title}" : Prix mis à jour de "${originalPrice}" (string) à ${newPrice} (number) €.`);
                } else if (typeof originalPrice === 'number') {
                    console.log(`Formule "${formula.title}" : Prix (${originalPrice}) est déjà au format Number. Aucune action requise.`);
                } else {
                    console.warn(`Formule "${formula.title}" : Impossible de parser le prix (valeur: "${originalPrice}"). Peut-être invalide ou manquante. Défini à ${newPrice}.`);
                    // Optionnel: tu peux forcer la sauvegarde d'un 0 ici si tu veux nettoyer
                    if (formula.price !== newPrice) {
                        formula.price = newPrice;
                        needsSave = true;
                    }
                }


                // --- Sauvegarde si des changements ont eu lieu ---
                if (needsSave) {
                    await formula.save();
                    updatedCount++;
                }
            }
            console.log(`Migration terminée. ${updatedCount} formules mises à jour.`);

        } catch (error) {
            console.error('Erreur lors de la migration:', error);
        } finally {
            await mongoose.disconnect();
            console.log('Déconnecté de MongoDB.');
        }
    })
    .catch(err => {
        console.error('Échec de la connexion à MongoDB:', err);
    });