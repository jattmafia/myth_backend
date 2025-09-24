const express = require('express');
const router = express.Router();
const  chapter = require('../controllers/chapterController');
const { verifyToken } = require('../middleware/authMiddleware');



const upload = require('../middleware/uploadMiddleware');

router.post('/createChapter', verifyToken, upload.single('coverImage'), chapter.createChapter);
router.get('/getAllChapters/:novelId', verifyToken, chapter.getChaptersByNovel);
router.get('/getChapter/:chapterId', verifyToken, chapter.getChapterById);
router.put('/updateChapter/:chapterId', verifyToken, upload.single('coverImage'), chapter.updateChapter);

module.exports = router;