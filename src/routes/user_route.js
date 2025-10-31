const express = require('express');
const {
    createProfile,
    getUserProfile,
    getUserStatistics,
    updateUserProfile,
    changePassword
    , followUser
    , unfollowUser
    , getFollowers
    , getFollowing
    , rewardAdCoins
    , getUserCoins
    , deductCoins
    , getCoinTransactionHistory
} = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post('/createProfile', verifyToken, upload.single('profilePicture'), createProfile);
router.get('/profile', verifyToken, getUserProfile);
router.get('/statistics', verifyToken, getUserStatistics);
router.put('/profile', verifyToken, upload.single('profilePicture'), updateUserProfile);
router.put('/change-password', verifyToken, changePassword);

// Follow/unfollow routes
router.post('/follow/:id', verifyToken, followUser);
router.post('/unfollow/:id', verifyToken, unfollowUser);

// Get followers / following - explicit routes to avoid optional-param parsing issues
router.get('/followers', verifyToken, getFollowers);
router.get('/followers/:id', verifyToken, getFollowers);
router.get('/following', verifyToken, getFollowing);
router.get('/following/:id', verifyToken, getFollowing);

// Coin reward routes
router.post('/reward-ad', verifyToken, rewardAdCoins);
router.get('/coins', verifyToken, getUserCoins);
router.post('/deduct-coins', verifyToken, deductCoins);
router.get('/coin-history', verifyToken, getCoinTransactionHistory);

module.exports = router;