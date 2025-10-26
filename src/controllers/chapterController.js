
const Chapter = require('../models/chapter');
const ReadingProgress = require('../models/readingProgress');
const ChapterView = require('../models/chapterView');
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


        const savedChapter = await chapter.save();
        //adding chapter to novel's chapters array
        const Novel = require('../models/novel');
        const novel = await Novel.findById(novelId);
        if (novel) {
            novel.chapters.push(savedChapter._id);
            novel.updatedAt = new Date();
            await novel.save();
        }
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

//get chapter by id with reading progress
exports.getChapterById = async (req, res) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user?.id;

        const chapter = await Chapter.findById(chapterId)
            .populate('author', 'username profilePicture')
            .populate('novel', 'title');

        if (!chapter) {
            return res.status(404).json({ message: 'Chapter not found' });
        }

        const chapterData = chapter.toObject();

        // Add reading progress if user is logged in
        if (userId) {
            const progress = await ReadingProgress.findOne({
                user: userId,
                chapter: chapterId
            }).select('scrollPosition progressPercent isCompleted lastReadAt');

            chapterData.readingProgress = progress || {
                scrollPosition: 0,
                progressPercent: 0,
                isCompleted: false,
                lastReadAt: null
            };
        } else {
            chapterData.readingProgress = {
                scrollPosition: 0,
                progressPercent: 0,
                isCompleted: false,
                lastReadAt: null
            };
        }

        res.status(200).json(chapterData);
    } catch (error) {
        console.error('Error fetching chapter by ID:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update chapter
exports.updateChapter = async (req, res) => {
    try {
        const { chapterId } = req.params;
        const { console, title, authorMessage, chapterNumber, status, content } = req.body;
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


//get published chapters by novel id
exports.getPublishedChapters = async (req, res) => {
    try {
        const { novelId } = req.params;
        const chapters = await Chapter.find({ novel: novelId, status: 'published' }).populate('author', 'username');
        res.status(200).json(chapters);
    } catch (error) {
        console.error('Error fetching published chapters by novel:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update or create reading progress
exports.updateReadingProgress = async (req, res) => {
    try {
        const { chapterId } = req.params;
        const {
            scrollPosition,
            progressPercent,
            totalContentHeight
        } = req.body;

        // Validate input
        if (progressPercent === undefined) {
            return res.status(400).json({ message: 'progressPercent is required' });
        }

        if (progressPercent < 0 || progressPercent > 100) {
            return res.status(400).json({ message: 'Progress percent must be between 0 and 100' });
        }

        // Find the chapter to get the novel ID
        const chapter = await Chapter.findById(chapterId);
        if (!chapter) {
            return res.status(404).json({ message: 'Chapter not found' });
        }

        // Check if chapter is completed (progress >= 95%)
        const isCompleted = progressPercent >= 95;

        // Update or create reading progress
        // If record was soft-deleted, restore it by setting isDeleted to false
        const progress = await ReadingProgress.findOneAndUpdate(
            { user: req.user.id, chapter: chapterId },
            {
                novel: chapter.novel,
                scrollPosition: scrollPosition || 0,
                progressPercent: progressPercent,
                totalContentHeight: totalContentHeight || 0,
                isCompleted,
                isDeleted: false,  // Restore if was deleted
                lastReadAt: new Date(),
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );

        res.status(200).json({
            message: 'Reading progress updated successfully',
            progress
        });
    } catch (error) {
        console.error('Error updating reading progress:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get reading progress for a specific chapter
exports.getChapterProgress = async (req, res) => {
    try {
        const { chapterId } = req.params;

        const progress = await ReadingProgress.findOne({
            user: req.user.id,
            chapter: chapterId
        }).populate('chapter', 'title chapterNumber');

        if (!progress) {
            return res.status(200).json({
                scrollPosition: 0,
                progressPercent: 0,
                totalContentHeight: 0,
                isCompleted: false
            });
        }

        res.status(200).json(progress);
    } catch (error) {
        console.error('Error fetching chapter progress:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get all reading progress for a novel
exports.getNovelProgress = async (req, res) => {
    try {
        const { novelId } = req.params;

        const progressList = await ReadingProgress.find({
            user: req.user.id,
            novel: novelId
        })
            .populate('chapter', 'title chapterNumber')
            .sort({ 'chapter.chapterNumber': 1 });

        // Calculate overall novel progress
        const totalChapters = await Chapter.countDocuments({
            novel: novelId,
            status: 'published'
        });

        const completedChapters = progressList.filter(p => p.isCompleted).length;
        const overallProgress = totalChapters > 0
            ? Math.round((completedChapters / totalChapters) * 100)
            : 0;

        res.status(200).json({
            progressList,
            stats: {
                totalChapters,
                completedChapters,
                overallProgress
            }
        });
    } catch (error) {
        console.error('Error fetching novel progress:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get user's currently reading novels (novels with progress)
exports.getCurrentlyReading = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Get unique novels the user has reading progress for
        const progress = await ReadingProgress.find({ user: req.user.id })
            .populate({
                path: 'novel',
                populate: {
                    path: 'author',
                    select: 'username profilePicture'
                }
            })
            .populate('chapter', 'title chapterNumber')
            .sort({ lastReadAt: -1 })
            .skip(skip)
            .limit(limitNum);

        // Group by novel and get the latest read chapter for each
        const novelsMap = new Map();

        for (const p of progress) {
            if (p.novel && !novelsMap.has(p.novel._id.toString())) {
                novelsMap.set(p.novel._id.toString(), {
                    novel: p.novel,
                    lastReadChapter: p.chapter,
                    progressPercent: p.progressPercent,
                    lastReadAt: p.lastReadAt
                });
            }
        }

        const currentlyReading = Array.from(novelsMap.values());

        const total = await ReadingProgress.distinct('novel', { user: req.user.id });

        res.status(200).json({
            currentlyReading,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(total.length / limitNum),
                totalNovels: total.length
            }
        });
    } catch (error) {
        console.error('Error fetching currently reading novels:', error);
        res.status(500).json({ error: error.message });
    }
};
