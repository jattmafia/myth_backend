
const AWS = require('aws-sdk');
const Novel = require('../models/novel'); // Import the Novel model
const User = require('../models/user'); // Import the User model
const ReadingProgress = require('../models/readingProgress'); // Import ReadingProgress model

// Configure AWS SDK for Cloudflare R2
const s3 = new AWS.S3({
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT, // Example: https://<account_id>.r2.cloudflarestorage.com
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, // User API Access Key
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY, // User API Secret Key
    region: 'auto', // Cloudflare R2 does not require a specific region
});


exports.createNovel = async (req, res) => {


    try {
        const { title, description, hookupDescription, language } = req.body;
        const coverImage = req.file;
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('Received data:', { title, description, hookupDescription, language, coverImage });

        if (title === undefined || description === undefined || coverImage === undefined) {
            return res.status(400).json({ message: 'title, description, and cover image are required' });
        }

        const uploadParams = {
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME, // Your R2 bucket name
            Key: `novel-pictures/${Date.now()}-${coverImage.originalname}`, // Unique file name
            Body: coverImage.buffer, // File buffer
            ContentType: coverImage.mimetype, // File MIME type
            ACL: 'public-read',
        };

        const uploadResult = await s3.upload(uploadParams).promise();

        console.log('File uploaded successfully:', uploadResult);
        const newNovel = new Novel({
            title,
            description,
            coverImage: uploadResult.Key,
            author: req.user.id,
            hookupDescription,
            language
        });

        await newNovel.save();
        res.status(201).json(newNovel);
    } catch (error) {
        console.error('Error creating novel:', error);
        res.status(500).json({ error: error.message });
    }
};

//fetch all novels which one is published
exports.getNovels = async (req, res) => {
    try {
        const novels = await Novel.find().populate('author', 'username');
        res.status(200).json(novels);
    } catch (error) {
        console.error('Error fetching novels:', error);
        res.status(500).json({ error: error.message });
    }
};


//fetch novel by user id
exports.getNovelsByUser = async (req, res) => {
    try {
        const novels = await Novel.find({ author: req.user.id }).populate('author', 'username');
        res.status(200).json(novels);
    } catch (error) {
        console.error('Error fetching novels by user:', error);
        res.status(500).json({ error: error.message });
    }
};

//update novel by id

exports.updateNovel = async (req, res) => {
    try {
        const { novelId } = req.params;



        // Check if req.body exists and is not null/undefined
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ message: 'Request body is required and must be valid JSON' });
        }

        const { title, description, hookupDescription, language, status } = req.body;

        const novel = await Novel.findById(novelId);

        if (!novel) {
            return res.status(404).json({ message: `Novel not found for ${novelId}` });
        }
        if (novel.author.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Update fields only if they are provided
        if (title !== undefined) novel.title = title;
        if (description !== undefined) novel.description = description;
        if (hookupDescription !== undefined) novel.hookupDescription = hookupDescription;
        if (language !== undefined) novel.language = language;
        if (status !== undefined) novel.status = status;

        await novel.save();
        res.status(200).json(novel);
    } catch (error) {
        console.error('Error updating novel:', error);
        res.status(500).json({ error: error.message });
    }
};

//get novel by id and populate chapters title, number, cover image with reading progress
exports.getNovelById = async (req, res) => {
    try {
        const { novelId } = req.params;
        const userId = req.user?.id; // Optional - user might not be logged in

        // Populate author and chapters with their authors
        const novel = await Novel.findById(novelId)
            .populate('author', 'username profilePicture email')
            .populate({
                path: 'chapters',
                populate: {
                    path: 'author',
                    select: 'username profilePicture'
                }
            });

        if (!novel) {
            return res.status(404).json({ message: 'Novel not found' });
        }

        // If user is logged in, fetch their reading progress for all chapters
        let progressMap = {};
        if (userId && novel.chapters && novel.chapters.length > 0) {
            const chapterIds = novel.chapters.map(ch => ch._id);

            const progressList = await ReadingProgress.find({
                user: userId,
                chapter: { $in: chapterIds }
            }).select('chapter scrollPosition progressPercent isCompleted lastReadAt');

            // Create a map for easy lookup
            progressList.forEach(progress => {
                progressMap[progress.chapter.toString()] = {
                    scrollPosition: progress.scrollPosition,
                    progressPercent: progress.progressPercent,
                    isCompleted: progress.isCompleted,
                    lastReadAt: progress.lastReadAt
                };
            });
        }

        // Add progress data to each chapter
        const chaptersWithProgress = novel.chapters.map(chapter => {
            const chapterObj = chapter.toObject();
            const chapterId = chapter._id.toString();

            // Add reading progress if available
            chapterObj.readingProgress = progressMap[chapterId] || {
                scrollPosition: 0,
                progressPercent: 0,
                isCompleted: false,
                lastReadAt: null
            };

            return chapterObj;
        });

        // Calculate overall novel progress
        let overallProgress = 0;
        let completedChapters = 0;

        if (userId && chaptersWithProgress.length > 0) {
            completedChapters = chaptersWithProgress.filter(ch => ch.readingProgress.isCompleted).length;
            overallProgress = Math.round((completedChapters / chaptersWithProgress.length) * 100);
        }

        // Build response
        const novelData = novel.toObject();
        novelData.chapters = chaptersWithProgress;
        novelData.userProgress = {
            overallProgress,
            completedChapters,
            totalChapters: chaptersWithProgress.length
        };

        console.log('Novel data being sent with progress:', novelData);
        res.status(200).json(novelData);
    } catch (error) {
        console.error('Error fetching novel by ID:', error);
        res.status(500).json({ error: error.message });
    }
};
