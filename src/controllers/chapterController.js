
const Chapter = require('../models/chapter');
const AWS = require('aws-sdk');

// Configure AWS SDK for Cloudflare R2
const s3 = new AWS.S3({
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT, // Example: https://<account_id>.r2.cloudflarestorage.com
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, // User API Access Key
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY, // User API Secret Key
    region: 'auto', // Cloudflare R2 does not require a specific region
});


exports.createChapter = async (req, res) => {
    try {
        const coverImage = req.file;
        const { title, novelId, authorMessage, chapterNumber, status } = req.body;
        //check chapter number is unique for the novel 
        const existingChapter = await Chapter.findOne({ novel: novelId, chapterNumber: chapterNumber });

        if (existingChapter) {
            return res.status(400).json({ message: 'Chapter number already exists for this novel' });
        }
        const uploadParams = {
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME, // Your R2 bucket name
            Key: `novel-chapters/${novelId}/${Date.now()}-${coverImage.originalname}`, // Unique file name
            Body: coverImage.buffer, // File buffer
            ContentType: coverImage.mimetype, // File MIME type
            ACL: 'public-read',
        };
        const uploadResult = await s3.upload(uploadParams).promise();
        const chapter = new Chapter({
            title,
            novel: novelId,
            author: req.user.id,
            authorMessage,
            chapterNumber: chapterNumber,
            coverImage: uploadResult.Key,
            status: status || 'draft'
        });
        await chapter.save();
        res.status(201).json(chapter);
    } catch (error) {
        console.error('Error creating chapter:', error);
        res.status(500).json({ error: error.message });
    }
};

//get chapters by novel id
exports.getChaptersByNovel = async (req, res) => {
    try {
        const { novelId } = req.params;
        const chapters = await Chapter.find({ novel: novelId }).populate('author', 'username');
        res.status(200).json(chapters);
    } catch (error) {
        console.error('Error fetching chapters by novel:', error);
        res.status(500).json({ error: error.message });
    }
};

//get chapter by id
exports.getChapterById = async (req, res) => {
    try {
        const { chapterId } = req.params;
        const chapter = await Chapter.findById(chapterId).populate('author', 'username');
        if (!chapter) {
            return res.status(404).json({ message: 'Chapter not found' });
        }
        res.status(200).json(chapter);
    } catch (error) {
        console.error('Error fetching chapter by ID:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update chapter
exports.updateChapter = async (req, res) => {
    try {
        const { chapterId } = req.params;
        const { console,title, authorMessage, chapterNumber, status } = req.body;
        const coverImage = req.file;
        const chapter = await Chapter.findById(chapterId);
        if (!chapter) {
            return res.status(404).json({ message: 'Chapter not found' });
        }
        if (chapter.author.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        if (coverImage) {
            const uploadParams = {
                Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME, // Your R2 bucket name
                Key: `novel-chapters/${chapter.novel}/${Date.now()}-${coverImage.originalname}`, // Unique file name
                Body: coverImage.buffer, // File buffer
                ContentType: coverImage.mimetype, // File MIME type
                ACL: 'public-read',
            };
            const uploadResult = await s3.upload(uploadParams).promise();
            chapter.coverImage = uploadResult.Key;
        }
        if (title) chapter.title = title;
        if (authorMessage) chapter.authorMessage = authorMessage;
        if (chapterNumber) chapter.chapterNumber = chapterNumber;
        chapter.content = content;
        chapter.status = status || 'draft';
        await chapter.save();
        res.status(200).json(chapter);
    } catch (error) {
        console.error('Error updating chapter:', error);
        res.status(500).json({ error: error.message });
    }
};
