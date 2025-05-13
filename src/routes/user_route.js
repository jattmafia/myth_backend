const express = require('express');
const { createProfile } = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');


const router = express.Router();


router.post('/createProfile', verifyToken,  upload.single('profilePicture'), createProfile);

module.exports = router;