const express = require('express');
const {
    createProfile,
    getUserProfile,
    getUserStatistics,
    updateUserProfile,
    changePassword
} = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post('/createProfile', verifyToken, upload.single('profilePicture'), createProfile);
router.get('/profile', verifyToken, getUserProfile);
router.get('/statistics', verifyToken, getUserStatistics);
router.put('/profile', verifyToken, upload.single('profilePicture'), updateUserProfile);
router.put('/change-password', verifyToken, changePassword);

module.exports = router;