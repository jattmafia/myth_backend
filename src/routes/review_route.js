const express = require('express');
const router = express.Router();
const review = require('../controllers/reviewController');
const { verifyToken } = require('../middleware/authMiddleware');

// Review CRUD operations
router.post('/novel/:novelId', verifyToken, review.addReview);
router.get('/novel/:novelId', verifyToken, review.getNovelReviews);
router.put('/:reviewId', verifyToken, review.updateReview);
router.delete('/:reviewId', verifyToken, review.deleteReview);

// Review interactions
router.post('/:reviewId/like', verifyToken, review.toggleReviewLike);
router.post('/:reviewId/reply', verifyToken, review.addReplyToReview);

// Review queries
router.get('/user/novel/:novelId', verifyToken, review.getUserReviewForNovel);
router.get('/stats/novel/:novelId', verifyToken, review.getNovelReviewStats);

module.exports = router;