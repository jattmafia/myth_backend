const express = require('express');
const router = express.Router();
const chapterAccessController = require('../controllers/chapterAccessController');
const { verifyToken } = require('../middleware/authMiddleware');

// Check if user can access a chapter (public endpoint, but optional auth)
router.get('/check/:chapterId', chapterAccessController.checkChapterAccess);

// Purchase a chapter (requires auth)
router.post('/purchase/:chapterId', verifyToken, chapterAccessController.purchaseChapter);

// Unlock chapter by coins (requires auth)
router.post('/unlock-coins/:chapterId', verifyToken, chapterAccessController.unlockByCoins);

// Unlock chapter by ads (requires auth)
router.post('/unlock-ads/:chapterId', verifyToken, chapterAccessController.unlockByAds);

// Record ad watch for a novel (requires auth)
router.post('/record-ad/:novelId', verifyToken, chapterAccessController.recordAdWatch);

// Get user's access history for a novel (requires auth)
router.get('/user-access/:novelId', verifyToken, chapterAccessController.getUserNovelAccess);

// Get user's unlock history (all methods) (requires auth)
router.get('/unlock-history/:novelId', verifyToken, chapterAccessController.getUnlockHistory);

// Get ad unlock status for a novel (requires auth)
router.get('/ad-status/:novelId', verifyToken, chapterAccessController.getAdUnlockStatus);

// Get chapter access statistics (for authors - requires auth)
router.get('/stats/:chapterId', verifyToken, chapterAccessController.getChapterAccessStats);

module.exports = router;
