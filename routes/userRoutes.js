const User = require('../models/user.model.js');
const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const multer = require('multer');
const dotenv = require('dotenv');
const authMiddleware = require('../middlewares/authMiddleware');


dotenv.config();


const FILE_TYPE_MAP = {
    'image/png': 'png',
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpg',
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const isValid = FILE_TYPE_MAP[file.mimetype];
        let uploadError = new Error('Image invalide');

        if (isValid) {
            uploadError = null
        }
        cb(null, './public/profile/')
    },
    filename: function (req, file, cb) {

        const fileName = file.originalname.split(' ').join('-')
        const extension = FILE_TYPE_MAP[file.mimetype];
        cb(null, `${fileName}-${Date.now()}.${extension}`)
    }
})

const uploadOptions = multer({ storage: storage });


//afficher toutes les utilisateurs
router.get('/', async (req, res) => {
    const userList = await User.find()
        .select('-password')
        .sort({ 'createdAt': -1 });
    if (!userList) {
        res.status(500).send({
            success: false
        });
    }
    res.status(200).send({
        success: true,
        message: 'User fetched successfuly',
        data: userList
    });
});

// Obtenir les infos de l'utilisateur en cours
router.get('/current-user', authMiddleware, async (req, res) => {
    //console.log("cc");

    // Récupérer userId du middleware
    const userId = req.user.userId;

    try {
        //const userId = mongoose.Types.ObjectId(id);
        // console.log("current", userId);

        const user = await User.findById(userId)
            .select('-password');

        if (!user) {
            return res.status(404).send({
                success: false,
                message: 'User not found'
            });
        }

        return res.send({
            success: true,
            message: 'User fetched successfully',
            data: user,
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
});

//  Route pour compter les utilisateurs
router.get('/count', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        res.status(200).json({
            success: true,
            message: "Compteur à jour",
            count: userCount
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors du comptage des cartes NFC actives.' });
    }
});

router.get('/recent', async (req, res) => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    try {
        const recentUsers = await User.find({ createdAt: { $gte: oneWeekAgo } });
        res.status(200).json({
            success: true,
            message: "Compteur à jour",
            count: recentUsers.length
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs récents.' });
    }
});

// Afficher les informations d'un seul utilisateur par son id
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Afficher les informations d'un seul utilisateur par son email
router.get('/email/:email', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email }).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});






//Création d'un compte utilisateur
router.post('/add', async (req, res) => {
    //  console.log("body",req.body)


    try {
        // Vérifier si l'utilisateur existe déjà
        const userExists = await User.findOne({ email: req.body.email });
        if (userExists) {
            return res.status(409).send({ success: false, message: 'Cet utilisateur existe déjà.' });
        }
        // console.log("userExists",userExists)

        // Création d'un nouvel utilisateur
        const hashedPassword = bcrypt.hashSync(req.body.password, 10);
        // console.log("password",hashedPassword)

        const newUser = new User({
            email: req.body.email,
            password: hashedPassword,
            isAdmin: req.body.isAdmin || false, // Prend la valeur transmise ou utilise false par défaut
        });

        // console.log("new user",newUser)

        const savedUser = await newUser.save();

        //console.log(savedUser)
        res.status(201).send({
            success: true,
            message: 'Utilisateur créé avec succès.',
            data: {
                id: savedUser._id,
                email: savedUser.email,
                isAdmin: savedUser.isAdmin,
            },
        });
    } catch (err) {
        res.status(500).send({ success: false, message: 'Erreur serveur.' });

    }

})

// Modifier les informations d'un utilisateur
router.put('/:id', async (req, res) => {
    // console.log("pour modifier id",req.params.id)

    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'ID utilisateur invalide.' });
    }

    const updates = req.body;
    try {
        const updatedUser = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }
        res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});



//Mise à jour de la photo de profile
router.put('/update-picture/:id', uploadOptions.single('profilePicture'), async (req, res) => {

    const id = req.params.id;

    console.log("user id", id)

    const user = await User.findById(id);


    if (!user) return res.send({ succsess: false, message: 'User invalide' });

    const file = req.file;
    let imagePath;

    if (file) {
        const fileName = file.filename;
        const basePath = `${req.protocol}://${req.get('host')}/public/profile/`
        imagePath = `${basePath}${fileName}`
    } else {
        imagePath = user.profilePicture
    }

    const updatedPicture = await User.findByIdAndUpdate(
        id,
        {
            profilePicture: imagePath,
        },
        { new: true }
    );

    if (!updatedPicture)
        return res.send({
            success: false,
            message: 'Impossible de mettre à jour l\'image '
        });

    res.send({
        success: true,
        message: 'Photo enrégistrée',
        data: updatedPicture
    });
});



// Supprimer un utilisateur
router.delete('/:id', async (req, res) => {


    try {

        const deletedUser = await User.findByIdAndDelete(req.params.id);

        if (!deletedUser) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }

        res.status(200).json({ success: true, message: 'Utilisateur supprimé avec succès.' });


    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;