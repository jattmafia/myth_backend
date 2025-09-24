const express = require('express');
const router = express.Router();
const  novel = require('../controllers/novelController');
const { verifyToken } = require('../middleware/authMiddleware');

const upload = require('../middleware/uploadMiddleware');

router.post('/createNovel', verifyToken, upload.single('coverImage'), novel.createNovel);
router.get('/getNovels', verifyToken, novel.getNovels);
router.get('/getNovelsByUser', verifyToken, novel.getNovelsByUser);

module.exports = router;
