const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const api = process.env.API_URL;

app.use(
    bodyParser.json({
        verify: function (req, res, buf) {
            req.rawBody = buf;
        }
    })
);

app.use(express.urlencoded({ extended: true }));


// Récupérer la ou les origines CORS depuis les variables d'environnement.
// Si process.env.CORS_ORIGIN n'est pas défini, nous mettons une valeur par défaut pour le développement local.
// On divise la chaîne par des virgules pour gérer plusieurs origines si nécessaire.
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3000', 'http://localhost:5000']; // Ajoutez d'autres origines locales si besoin


//cors
app.use(cors({
    origin: (origin, callback) => {
        // Permettre les requêtes sans origine (comme les applications mobiles ou curl)
        // ou si l'origine fait partie de notre liste blanche.
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Rejeter la requête si l'origine n'est pas autorisée.
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: "GET,PUT,DELETE,POST,PATCH" // Spécifiez toutes les méthodes HTTP que votre API utilise
}));

app.use('/public/profile', express.static(__dirname + '/public/profile'));
app.use('/public/article_image', express.static(__dirname + '/public/article_image'));



//routes
const usersRouter = require('./routes/userRoutes');
const authRouter = require('./routes/authRoutes');
const formulasRouter = require('./routes/formulaRoutes');
const articlesRouter = require('./routes/articleRoutes');
const appointmentsRouter = require('./routes/appointmentRoutes');
const fidelityRoutes = require('./routes/fidelityRoutes');




// http://localhost:5000/api/v1/ 
app.use(`${api}/auth`, authRouter);
app.use(`${api}/users`, usersRouter);
app.use(`${api}/formulas`, formulasRouter);
app.use(`${api}/articles`, articlesRouter);
app.use(`${api}/appointments`, appointmentsRouter);
app.use(`${api}/fidelity`, fidelityRoutes);




mongoose.set("strictQuery", false);
mongoose.connect(process.env.MONGODB_URL)
    .then(() => console.log('DBconnection succès!'))//message à afficher si mongoDB fonctionne normalement
    .catch((err) => {
        console.log(err);
    });

app.listen(process.env.PORT || 5000, () => {
    console.log(api);
    console.log('App listening on port http://localhost:5000');
});