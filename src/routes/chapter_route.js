const express = require('express');
const router = express.Router();
const chapter = require('../controllers/chapterController');
const { verifyToken } = require('../middleware/authMiddleware');



const upload = require('../middleware/uploadMiddleware');

router.post('/createChapter', verifyToken, upload.single('coverImage'), chapter.createChapter);
router.get('/getAllChapters/:novelId', verifyToken, chapter.getChaptersByNovel);
router.get('/getChapter/:chapterId', verifyToken, chapter.getChapterById);
router.put('/updateChapter/:chapterId', verifyToken, upload.single('coverImage'), chapter.updateChapter);
router.get('/getPublishedChapters/:novelId', verifyToken, chapter.getPublishedChapters);

// Reading progress routes
router.put('/chapter-progress/:chapterId', verifyToken, chapter.updateReadingProgress);
router.get('/chapter-progress/:chapterId', verifyToken, chapter.getChapterProgress);
router.get('/novel-progress/:novelId', verifyToken, chapter.getNovelProgress);
router.get('/currently-reading', verifyToken, chapter.getCurrentlyReading);

module.exports = router;