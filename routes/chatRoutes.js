// backend/routes/chatRoutes.js
const router = require('express').Router();
const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const User = require('../models/user.model');
const authMiddleware = require('../middlewares/authMiddleware'); // Assurez-vous que le chemin est correct

// Fonction helper pour populer les conversations
// Cette fonction prend un objet de requête Mongoose comme entrée (ex: Conversation.find(...))
const populateConversationQuery = (query) => {
    return query
        .populate({
            path: 'participants',
            model: 'User',
            select: 'firstName lastName role _id'
        })
        .populate({
            path: 'lastMessage',
            populate: {
                path: 'sender',
                model: 'User',
                select: 'firstName lastName role _id'
            }
        });
};

// @route   GET /api/v1/chat
// @desc    Obtenir toutes les conversations de l'utilisateur connecté
// @access  Privé (nécessite d'être connecté)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Construire la requête, puis la passer à la fonction de peuplement
        let query = Conversation.find({ participants: userId })
            .sort('-updatedAt');

        // Appliquer le peuplement à la requête AVANT de l'exécuter avec await
        let conversations = await populateConversationQuery(query);

        // Optionnel : Calculer le nombre de messages non lus pour chaque conversation
        const conversationsWithUnread = await Promise.all(conversations.map(async (conv) => {
            const unreadCount = await Message.countDocuments({
                conversationId: conv._id,
                sender: { $ne: userId }, // Messages envoyés par quelqu'un d'autre
                readBy: { $nin: [userId] } // Non lus par l'utilisateur actuel
            });
            return { ...conv.toObject(), unreadCount };
        }));

        res.status(200).json({ success: true, data: conversationsWithUnread });
    } catch (error) {
        console.error('Erreur lors de la récupération des conversations :', error);
        res.status(500).json({ success: false, message: 'Échec de la récupération des conversations.' });
    }
});

// @route   GET /api/v1/chat/:conversationId/messages
// @desc    Obtenir les messages d'une conversation spécifique
// @access  Privé (nécessite d'être connecté et d'être participant)
router.get('/:conversationId/messages', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const conversationId = req.params.conversationId;

        // Peuplement direct sur le findById pour s'assurer que les participants sont là pour la vérification
        const conversation = await Conversation.findById(conversationId)
            .populate('participants', '_id'); // Seulement l'ID est nécessaire pour la vérification ici

        // Vérifier si l'utilisateur est un participant de cette conversation
        if (!conversation || !conversation.participants.some(p => p._id.toString() === userId.toString())) {
            return res.status(403).json({ success: false, message: 'Accès refusé à cette conversation.' });
        }

        const messages = await Message.find({ conversationId })
            .populate('sender', 'firstName lastName role _id')
            .sort('timestamp');

        // Marquer les messages comme lus par l'utilisateur actuel (sauf ceux qu'il a envoyés)
        await Message.updateMany(
            { conversationId: conversationId, sender: { $ne: userId }, 'readBy': { $nin: [userId] } },
            { $addToSet: { readBy: userId } }
        );

        res.status(200).json({ success: true, data: messages });
    } catch (error) {
        console.error('Erreur lors de la récupération des messages :', error);
        res.status(500).json({ success: false, message: 'Échec de la récupération des messages.' });
    }
});

// @route   POST /api/v1/chat/start-with-admin
// @desc    Pour un client : démarrer ou accéder à sa conversation unique avec un admin
// @access  Privé (réservé aux clients)
router.post('/start-with-admin', authMiddleware, async (req, res) => {
    try {
        const clientId = req.user.userId;
        if (req.user.role !== 'client') {
            return res.status(403).json({ success: false, message: 'Seuls les clients peuvent démarrer des conversations avec les administrateurs via cette route.' });
        }

        const adminUser = await User.findOne({ role: 'admin' });
        if (!adminUser) {
            return res.status(404).json({ success: false, message: 'Aucun administrateur disponible pour discuter.' });
        }
        const adminId = adminUser._id;

        let conversation = await Conversation.findOne({
            participants: { $all: [clientId, adminId] }
        });

        if (!conversation) {
            conversation = new Conversation({
                participants: [clientId, adminId],
            });
            await conversation.save();
        }

        // Populer la conversation après l'avoir trouvée ou créée
        conversation = await populateConversationQuery(Conversation.findById(conversation._id));

        res.status(200).json({ success: true, data: conversation });

    } catch (error) {
        console.error('Erreur lors du démarrage de la conversation avec l\'administrateur :', error);
        res.status(500).json({ success: false, message: 'Échec du démarrage de la conversation avec l\'administrateur.' });
    }
});

// @route   POST /api/v1/chat/admin/start-conversation/:clientId
// @desc    Pour un admin : démarrer ou accéder à une conversation avec un client spécifique
// @access  Privé (réservé aux admins)
router.post('/admin/start-conversation/:clientId', authMiddleware, async (req, res) => {
    try {
        const adminId = req.user.userId;
        const targetClientId = req.params.clientId;

        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Seuls les administrateurs peuvent utiliser cette route.' });
        }

        const targetClient = await User.findById(targetClientId);
        if (!targetClient || targetClient.role !== 'client') {
            return res.status(404).json({ success: false, message: 'Client cible introuvable ou n\'est pas un client.' });
        }

        let conversation = await Conversation.findOne({
            participants: { $all: [adminId, targetClientId] }
        });

        if (!conversation) {
            conversation = new Conversation({
                participants: [adminId, targetClientId],
            });
            await conversation.save();
        }

        // Populer la conversation après l'avoir trouvée ou créée
        conversation = await populateConversationQuery(Conversation.findById(conversation._id));

        res.status(200).json({ success: true, data: conversation });

    } catch (error) {
        console.error('Erreur dans /admin/start-conversation :', error);
        res.status(500).json({ success: false, message: 'Échec du démarrage de la conversation avec le client.' });
    }
});

// @route   POST /api/v1/chat/send-message
// @desc    Envoyer un message dans une conversation existante
// @access  Privé (nécessite d'être connecté et d'être participant)
router.post('/send-message', authMiddleware, async (req, res) => {
    try {
        const { conversationId, content, receiverId } = req.body;
        const senderId = req.user.userId;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.some(pId => pId.toString() === senderId.toString())) {
            return res.status(403).json({ success: false, message: 'Accès refusé ou conversation introuvable.' });
        }

        const newMessage = new Message({
            conversationId,
            sender: senderId,
            content,
            readBy: [senderId],
        });
        await newMessage.save();

        conversation.lastMessage = newMessage._id;
        conversation.updatedAt = new Date();
        await conversation.save();

        const populatedMessage = await Message.findById(newMessage._id)
            .populate('sender', 'firstName lastName role   _id');

        res.status(200).json({ success: true, data: populatedMessage });

    } catch (error) {
        console.error('Erreur lors de l\'envoi du message :', error);
        res.status(500).json({ success: false, message: 'Échec de l\'envoi du message.' });
    }
});

module.exports = router;