//server.js
const express = require('express')
const app = express()
// ✅ Import du module http de Node.js
const http = require('http')
// ✅ Import de la classe Server de socket.io
const { Server } = require('socket.io')


const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken'); // ✅ Import jwt pour l'authentification Socket.IO


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
const allowedOrigins = process.env.CORS_ORIGIN_ONLINE
    ? process.env.CORS_ORIGIN_ONLINE.split(',')
    : ['http://localhost:3000', 'http://localhost:5000']; // Ajoutez d'autres origines locales si besoin


//cors
app.use(cors({
    origin: (origin, callback) => {
        // Permettre les requêtes sans origine (comme les applications mobiles ou curl)
        // ou si l'origine fait partie de notre liste blanche.
        // console.log("➡️ Requête reçue de l'origine :", origin); // AJOUTEZ CETTE LIGNE

        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Rejeter la requête si l'origine n'est pas autorisée.
            //  console.error("❌ Origine non autorisée :", origin);
            callback(new Error('Not allowed by CORS A'));
        }
    },
    credentials: true,
    methods: "GET,PUT,DELETE,POST,PATCH" // Spécifiez toutes les méthodes HTTP que votre API utilise
}));



//app.use('/public/profile', express.static(__dirname + '/public/profile'));
//app.use('/public/article_image', express.static(__dirname + '/public/article_image'));


// ✅ Création du serveur HTTP
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowedOrigins, // Socket.IO utilise sa propre configuration CORS
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.set('socketio', io); // Gardez cette ligne !


//routes
const usersRouter = require('./routes/userRoutes');
const authRouter = require('./routes/authRoutes');
const formulasRouter = require('./routes/formulaRoutes');
const articlesRouter = require('./routes/articleRoutes');
const appointmentsRouter = require('./routes/appointmentRoutes');
const fidelityRoutes = require('./routes/fidelityRoutes');
const chatRoutes = require('./routes/chatRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const bannerRoutes = require('./routes/bannerRoutes');






// http://localhost:5000/api/v1/ 
app.use(`${api}/auth`, authRouter);
app.use(`${api}/users`, usersRouter);
app.use(`${api}/formulas`, formulasRouter);
app.use(`${api}/articles`, articlesRouter);
app.use(`${api}/appointments`, appointmentsRouter);
app.use(`${api}/fidelity`, fidelityRoutes);
app.use(`${api}/chat`, chatRoutes);
app.use(`${api}/gallery-images`, galleryRoutes);
app.use(`${api}/page-banners`, bannerRoutes);





mongoose.set("strictQuery", false);
mongoose.connect(process.env.MONGODB_URL_ONLINE)
    .then(() => console.log('DBconnection succès!'))//message à afficher si mongoDB fonctionne normalement
    .catch((err) => {
        console.log(err);
    });

// ✅ Middleware d'authentification pour Socket.IO
// Il vérifie le JWT du cookie et attache les informations de l'utilisateur au socket
io.use(async (socket, next) => {
    try {
        const tokenCookie = socket.handshake.headers.cookie
            ?.split(';')
            .find(c => c.trim().startsWith('token='));

        if (!tokenCookie) {
            return next(new Error('Authentication error: No token provided'));
        }

        const token = tokenCookie.split('=')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        next();
    } catch (err) {
        console.error("Socket.IO Auth Error:", err.message);
        next(new Error('Authentication error: Invalid or expired token'));
    }
});


// GESTION DES CONNEXIONS SOCKET.IO
io.on('connection', (socket) => {
    console.log(`Un utilisateur s'est connecté via Socket.IO: ${socket.id}`);

    // Associe l'ID d'utilisateur au socket pour faciliter le ciblage
    // L'ID utilisateur devrait être envoyé depuis le client lors de la connexion Socket.IO
    const userId = socket.handshake.query.userId;
    if (userId) {
        socket.join(userId); // Chaque utilisateur rejoint une "salle" nommée avec son ID
        console.log(`Utilisateur ${userId} a rejoint la salle ${userId}`);
    }

    socket.on('send_message', async (messageData) => {

        try {
            if (messageData.sender !== userId) {
                console.warn(`Tentative d'envoi de message avec un senderId non correspondant au socket connecté.`);
                return;
            }


            const newMessage = {
                _id: new mongoose.Types.ObjectId(), // Génère un nouvel ID pour le message côté serveur Socket.IO
                conversationId: messageData.conversationId,
                sender: { _id: messageData.sender }, // Simule un objet sender populé pour le frontend
                content: messageData.content,
                timestamp: new Date(),
                readBy: [messageData.sender],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Émettre le message au destinataire
            // Si le destinataire est en ligne (dans sa "salle" Socket.IO)
            if (messageData.receiver) {
                // Émettre le message au destinataire spécifique
                io.to(messageData.receiver).emit('receive_message', {
                    ...newMessage,
                    sender: { _id: messageData.sender, firstName: 'SenderFirstName', lastName: 'SenderLastName' } // Info de base pour affichage rapide
                });
            }
            // Émettre le message à l'expéditeur lui-même pour confirmation (s'il n'est pas dans la même salle que le destinataire)
            socket.emit('receive_message', {
                ...newMessage,
                sender: { _id: messageData.sender, firstName: 'SenderFirstName', lastName: 'SenderLastName' }
            });

            // Pour une gestion plus robuste de la population, il est préférable que l'API REST /send-message
            // renvoie le message complétement populé (avec le sender complet) après sa persistance.
            // Le socket peut ensuite recevoir cette confirmation ou un événement dédié.
            // Pour l'instant, nous émettons une version simplifiée.


        } catch (error) {
            console.error('Erreur lors de l\'envoi du message via Socket.IO :', error);
        }
    })

    socket.on('disconnect', () => {
        console.log(`Un utilisateur s'est déconnecté via Socket.IO: ${socket.id}`);
        // Logique de nettoyage si nécessaire (ex: retirer l'utilisateur de ses salles)
    });
});
// --- FIN CONFIGURATION DE SOCKET.IO ---


server.listen(process.env.PORT || 5000, () => {
    console.log(api);
    console.log('App listening on port http://localhost:5000');
});