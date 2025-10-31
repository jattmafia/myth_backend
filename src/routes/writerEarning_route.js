const express = require('express');
const router = express.Router();
const writerEarningController = require('../controllers/writerEarningController');
const { verifyToken } = require('../middleware/authMiddleware');

// Check if novel is eligible for monetization
router.get('/eligibility/:novelId', verifyToken, writerEarningController.checkMonetizationEligibility);

// Get all earnings for writer
router.get('/all', verifyToken, writerEarningController.getWriterEarnings);

// Get earnings for a specific novel
router.get('/novel/:novelId', verifyToken, writerEarningController.getNovelEarnings);

// Get ad unlock statistics and estimated earnings for a novel
router.get('/ad-stats/:novelId', verifyToken, writerEarningController.getAdUnlockStats);

// Get earnings breakdown for a specific chapter
router.get('/chapter/:novelId/:chapterId', verifyToken, writerEarningController.getChapterEarnings);

module.exports = router;
