const express = require('express');
const router = express.Router();
const novel = require('../controllers/novelController');
const { verifyToken } = require('../middleware/authMiddleware');

const upload = require('../middleware/uploadMiddleware');

router.post('/createNovel', verifyToken, upload.single('coverImage'), novel.createNovel);
router.get('/getNovels', verifyToken, novel.getNovels);
router.get('/getNovelsByUser', verifyToken, novel.getNovelsByUser);
router.put('/updateNovel/:novelId', verifyToken, novel.updateNovel);
router.get('/getNovelById/:novelId', verifyToken, novel.getNovelById);
router.get('/discover', verifyToken, novel.getDiscoverNovels);

// Reading progress routes
router.get('/currently-reading', verifyToken, novel.getCurrentlyReading);
router.get('/completed', verifyToken, novel.getCompletedNovels);
router.get('/reading-history', verifyToken, novel.getReadingHistory);
router.delete('/reading-history/:novelId', verifyToken, novel.deleteReadingHistory);
router.delete('/reading-history', verifyToken, novel.deleteAllReadingHistory);

// View tracking routes
router.post('/view/chapter/:chapterId', verifyToken, novel.recordChapterView);
router.get('/view/chapter/:chapterId/stats', verifyToken, novel.getChapterViewStats);
router.get('/view/novel/:novelId/stats', verifyToken, novel.getNovelViewStats);
router.get('/view/recently-viewed', verifyToken, novel.getUserRecentlyViewed);

// Favorite/Like routes (both American and British spellings)
router.post('/favorite/:novelId', verifyToken, novel.toggleNovelFavorite);
router.post('/favourite/:novelId', verifyToken, novel.toggleNovelFavorite); // British spelling
router.get('/favorites', verifyToken, novel.getUserFavorites);
router.get('/favourites', verifyToken, novel.getUserFavorites); // British spelling
router.get('/favorite/status/:novelId', verifyToken, novel.checkNovelFavoriteStatus);
router.get('/favourite/status/:novelId', verifyToken, novel.checkNovelFavoriteStatus); // British spelling
router.get('/favorite/stats/:novelId', verifyToken, novel.getNovelLikeStats);
router.get('/favourite/stats/:novelId', verifyToken, novel.getNovelLikeStats); // British spelling
router.get('/most-liked', verifyToken, novel.getMostLikedNovels);

// Bookshelf routes
router.post('/bookshelf/:novelId', verifyToken, novel.addToBookshelf);
router.delete('/bookshelf/:novelId', verifyToken, novel.removeFromBookshelf);
router.get('/bookshelf', verifyToken, novel.getUserBookshelf);
router.put('/bookshelf/:novelId', verifyToken, novel.updateBookshelfEntry);
router.get('/bookshelf/status/:novelId', verifyToken, novel.checkBookshelfStatus);

module.exports = router;
