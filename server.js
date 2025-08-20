//server.js
const express = require('express')
const app = express()
const http = require('http')
const { Server } = require('socket.io')
const cookieParser = require("cookie-parser");


const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

const Message = require('./models/message.model');
const Conversation = require('./models/conversation.model');


dotenv.config();
const api = process.env.API_URL;


app.use(bodyParser.json({ verify: function (req, res, buf) { req.rawBody = buf; } }));
app.use(cookieParser());
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
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
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
    console.log(`Utilisateur connecté via Socket.IO : ${socket.id}`);

    const userId = socket.handshake.query.userId;
    if (userId) {
        socket.join(userId); // chaque utilisateur rejoint sa salle
        console.log(`Utilisateur ${userId} a rejoint la salle ${userId}`);
    }

    // --- Réception d'un message ---
    socket.on('send_message', async (data) => {
        try {
            const { conversationId, sender, content, receiver } = data;

            // 1️⃣ Sauvegarde du message dans MongoDB
            const newMessage = new Message({
                conversationId,
                sender,
                content,
                readBy: [sender],
                timestamp: new Date(),
            });
            await newMessage.save();

            // 2️⃣ Mettre à jour lastMessage et updatedAt dans la conversation
            const conversation = await Conversation.findById(conversationId);
            if (conversation) {
                conversation.lastMessage = newMessage._id;
                conversation.updatedAt = new Date();
                await conversation.save();
            }

            // 3️⃣ Émettre le message à l'expéditeur
            socket.emit('receive_message', await newMessage.populate('sender', 'firstName lastName role _id'));

            // 4️⃣ Émettre le message au destinataire
            if (receiver) {
                io.to(receiver).emit('receive_message', await newMessage.populate('sender', 'firstName lastName role _id'));
            }

        } catch (err) {
            console.error("Erreur Socket.IO send_message :", err);
            socket.emit('error_message', { message: "Échec de l'envoi du message" });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Utilisateur déconnecté : ${socket.id}`);
    });
});
// --- FIN CONFIGURATION DE SOCKET.IO ---


server.listen(process.env.PORT || 5000, () => {
    console.log(api);
    console.log('App listening on port http://localhost:5000');
});