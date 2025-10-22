const express = require('express');
const router = express.Router();
const chapterReview = require('../controllers/chapterReviewController');
const { verifyToken } = require('../middleware/authMiddleware');

// Chapter Review CRUD operations
router.post('/chapter/:chapterId', verifyToken, chapterReview.addChapterReview);
router.get('/chapter/:chapterId', verifyToken, chapterReview.getChapterReviews);
router.put('/:reviewId', verifyToken, chapterReview.updateChapterReview);
router.delete('/:reviewId', verifyToken, chapterReview.deleteChapterReview);

// Chapter Review interactions
router.post('/:reviewId/like', verifyToken, chapterReview.toggleChapterReviewLike);
router.post('/:reviewId/reply', verifyToken, chapterReview.addReplyToChapterReview);

// Chapter Review queries
router.get('/user/chapter/:chapterId', verifyToken, chapterReview.getUserChapterReview);
router.get('/stats/chapter/:chapterId', verifyToken, chapterReview.getChapterReviewStats);

module.exports = router;