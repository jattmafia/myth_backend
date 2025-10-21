
const AWS = require('aws-sdk');
const Novel = require('../models/novel'); // Import the Novel model
const User = require('../models/user'); // Import the User model
const ReadingProgress = require('../models/readingProgress'); // Import ReadingProgress model
const ChapterView = require('../models/chapterView'); // Import ChapterView model
const Favorite = require('../models/favorite'); // Import Favorite model
const Review = require('../models/review'); // Import Review model

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
        const userId = req.user?.id;
        const novels = await Novel.find({ status: { $in: ['published', 'ongoing'] } })
            .populate('author', 'username')
            .populate({
                path: 'chapters',
                match: { status: 'published' },
                select: 'title chapterNumber createdAt'
            });

        // Initialize favoritesMap and reviewsMap
        let favoritesMap = {};
        let reviewsMap = {};

        if (userId) {
            // Get user favorites
            const userFavorites = await Favorite.find({ user: userId }).select('novel');
            userFavorites.forEach(fav => {
                favoritesMap[fav.novel.toString()] = true;
            });

            // Get user's reviews for these novels
            const novelIds = novels.map(n => n._id);
            const userReviews = await Review.find({
                user: userId,
                novel: { $in: novelIds }
            }).select('novel likes');

            userReviews.forEach(review => {
                reviewsMap[review.novel.toString()] = {
                    likesCount: review.likes.length,
                    isLikedByUser: review.likes.some(likeUserId => likeUserId.toString() === userId)
                };
            });
        }

        // Add favorite status and review info to each novel
        const novelsWithExtras = novels.map(novel => {
            const novelObj = novel.toObject();
            novelObj.isFavourite = !!favoritesMap[novel._id.toString()];

            // Add review info
            const reviewInfo = reviewsMap[novel._id.toString()];
            if (reviewInfo) {
                novelObj.userReview = {
                    likesCount: reviewInfo.likesCount,
                    isLikedByUser: reviewInfo.isLikedByUser
                };
            } else {
                novelObj.userReview = null;
            }

            return novelObj;
        });

        res.status(200).json(novelsWithExtras);
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

// Get discover novels (latest releases, most popular, recommended)
exports.getDiscoverNovels = async (req, res) => {
    try {
        const userId = req.user?.id;
        const limit = parseInt(req.query.limit) || 10;

        // Get latest releases (recently created novels) - only published/ongoing
        const latestReleases = await Novel.find({ status: { $in: ['published', 'ongoing'] } })
            .populate('author', 'username profilePicture')
            .populate({
                path: 'chapters',
                match: { status: 'published' },
                select: 'title chapterNumber createdAt'
            })
            .sort({ createdAt: -1 })
            .limit(limit);

        // Get most popular novels (based on favorites count) - only published/ongoing
        const mostPopular = await Novel.aggregate([
            {
                $match: { status: { $in: ['published', 'ongoing'] } }
            },
            {
                $lookup: {
                    from: 'favorites',
                    localField: '_id',
                    foreignField: 'novel',
                    as: 'favorites'
                }
            },
            {
                $addFields: {
                    favoritesCount: { $size: '$favorites' }
                }
            },
            {
                $sort: { favoritesCount: -1 }
            },
            {
                $limit: limit
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'author',
                    foreignField: '_id',
                    as: 'author',
                    pipeline: [
                        { $project: { username: 1, profilePicture: 1 } }
                    ]
                }
            },
            {
                $unwind: '$author'
            },
            {
                $lookup: {
                    from: 'chapters',
                    localField: '_id',
                    foreignField: 'novel',
                    as: 'chapters',
                    pipeline: [
                        { $match: { status: 'published' } },
                        { $project: { title: 1, chapterNumber: 1, createdAt: 1 } }
                    ]
                }
            }
        ]);

        // Get recommended novels (highest rated novels) - only published/ongoing
        const recommended = await Novel.find({
            averageRating: { $gte: 4.0 },
            status: { $in: ['published', 'ongoing'] }
        })
            .populate('author', 'username profilePicture')
            .populate({
                path: 'chapters',
                match: { status: 'published' },
                select: 'title chapterNumber createdAt'
            })
            .sort({ averageRating: -1, totalReviews: -1 })
            .limit(limit);

        // If user is logged in, add favorite status and user review info
        let favoritesMap = {};
        let reviewsMap = {};

        if (userId) {
            // Get user favorites for all novels
            const allNovelIds = [
                ...latestReleases.map(n => n._id),
                ...mostPopular.map(n => n._id),
                ...recommended.map(n => n._id)
            ];

            const userFavorites = await Favorite.find({
                user: userId,
                novel: { $in: allNovelIds }
            }).select('novel');

            userFavorites.forEach(fav => {
                favoritesMap[fav.novel.toString()] = true;
            });

            // Get user's reviews for these novels
            const userReviews = await Review.find({
                user: userId,
                novel: { $in: allNovelIds }
            }).select('novel likes');

            userReviews.forEach(review => {
                reviewsMap[review.novel.toString()] = {
                    likesCount: review.likes.length,
                    isLikedByUser: review.likes.some(likeUserId => likeUserId.toString() === userId)
                };
            });
        }

        // Transform novels to add extra info
        const transformNovels = (novels) => {
            return novels.map(novel => {
                const novelObj = novel.toObject ? novel.toObject() : novel;
                novelObj.isFavourite = !!favoritesMap[novelObj._id.toString()];

                const reviewInfo = reviewsMap[novelObj._id.toString()];
                if (reviewInfo) {
                    novelObj.userReview = {
                        likesCount: reviewInfo.likesCount,
                        isLikedByUser: reviewInfo.isLikedByUser
                    };
                } else {
                    novelObj.userReview = null;
                }

                return novelObj;
            });
        };

        res.status(200).json({
            success: true,
            data: {
                latestReleases: transformNovels(latestReleases),
                mostPopular: transformNovels(mostPopular),
                recommended: transformNovels(recommended)
            }
        });

    } catch (error) {
        console.error('Error fetching discover novels:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
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

        // Populate author and chapters with their authors (only published chapters)
        const novel = await Novel.findById(novelId)
            .populate('author', 'username profilePicture email')
            .populate({
                path: 'chapters',
                match: { status: 'published' },
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

        // Get chapter statistics (including all chapters, not just published)
        const Chapter = require('../models/chapter');
        const allChapters = await Chapter.find({ novel: novelId });

        const chapterStats = {
            totalChapters: allChapters.length,
            publishedChapters: allChapters.filter(ch => ch.status === 'published').length,
            draftChapters: allChapters.filter(ch => ch.status === 'draft').length,
            totalViews: allChapters.reduce((sum, ch) => sum + (ch.viewCount || 0), 0),
            latestChapter: allChapters.length > 0 ? {
                title: allChapters[allChapters.length - 1].title,
                chapterNumber: allChapters[allChapters.length - 1].chapterNumber,
                createdAt: allChapters[allChapters.length - 1].createdAt,
                status: allChapters[allChapters.length - 1].status
            } : null
        };

        // Build response
        const novelData = novel.toObject();
        novelData.chapters = chaptersWithProgress;
        novelData.chapterStats = chapterStats;
        novelData.userProgress = {
            overallProgress,
            completedChapters,
            totalChapters: chaptersWithProgress.length
        };

        // Check if novel is in user's bookshelf
        if (userId) {
            const Bookshelf = require('../models/bookshelf');
            const bookshelfEntry = await Bookshelf.findOne({
                user: userId,
                novel: novelId
            });
            novelData.isBookshelf = !!bookshelfEntry;
        } else {
            novelData.isBookshelf = false;
        }

        res.status(200).json(novelData);
    } catch (error) {
        console.error('Error fetching novel by ID:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get user's currently reading novels (in progress, not finished)
exports.getCurrentlyReading = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get all novels where user has reading progress
        const progressRecords = await ReadingProgress.find({
            user: userId
        })
            .populate({
                path: 'novel',
                populate: {
                    path: 'author',
                    select: 'username profilePicture'
                }
            })
            .sort({ lastReadAt: -1 });

        // Group by novel and calculate progress
        const novelsMap = new Map();

        for (const progress of progressRecords) {
            if (!progress.novel) continue;

            const novelId = progress.novel._id.toString();

            if (!novelsMap.has(novelId)) {
                // Get total chapters for this novel
                const totalChapters = progress.novel.chapters ? progress.novel.chapters.length : 0;

                // Get all progress for this novel to calculate completion
                const allNovelProgress = progressRecords.filter(
                    p => p.novel && p.novel._id.toString() === novelId
                );

                const completedChapters = allNovelProgress.filter(p => p.isCompleted).length;
                const overallProgress = totalChapters > 0
                    ? Math.round((completedChapters / totalChapters) * 100)
                    : 0;

                // Only include if novel is not 100% complete
                if (overallProgress < 100) {
                    // Find the most recently read chapter
                    const latestProgress = allNovelProgress.reduce((latest, current) => {
                        return new Date(current.lastReadAt) > new Date(latest.lastReadAt)
                            ? current
                            : latest;
                    });

                    novelsMap.set(novelId, {
                        novel: progress.novel,
                        lastReadAt: latestProgress.lastReadAt,
                        progressPercent: latestProgress.progressPercent,
                        overallProgress,
                        completedChapters,
                        totalChapters
                    });
                }
            }
        }

        // Convert map to array and sort by last read date
        const currentlyReading = Array.from(novelsMap.values())
            .sort((a, b) => new Date(b.lastReadAt) - new Date(a.lastReadAt));

        res.status(200).json({
            currentlyReading,
            total: currentlyReading.length
        });
    } catch (error) {
        console.error('Error fetching currently reading novels:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get user's completed novels (100% finished)
exports.getCompletedNovels = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get all novels where user has reading progress
        const progressRecords = await ReadingProgress.find({
            user: userId
        })
            .populate({
                path: 'novel',
                populate: {
                    path: 'author',
                    select: 'username profilePicture'
                }
            })
            .sort({ lastReadAt: -1 });

        // Group by novel and check if completed
        const novelsMap = new Map();
        const Chapter = require('../models/chapter');

        for (const progress of progressRecords) {
            if (!progress.novel) continue;

            const novelId = progress.novel._id.toString();

            if (!novelsMap.has(novelId)) {
                // Get total PUBLISHED chapters for this novel (not drafts)
                const totalChapters = await Chapter.countDocuments({
                    novel: novelId,
                    status: 'published'
                });

                // Get all progress for this novel
                const allNovelProgress = progressRecords.filter(
                    p => p.novel && p.novel._id.toString() === novelId
                );

                const completedChapters = allNovelProgress.filter(p => p.isCompleted).length;
                const overallProgress = totalChapters > 0
                    ? Math.round((completedChapters / totalChapters) * 100)
                    : 0;

                // Only include if novel is 100% complete
                if (overallProgress === 100) {
                    // Find the last completed chapter
                    const latestProgress = allNovelProgress
                        .filter(p => p.isCompleted)
                        .reduce((latest, current) => {
                            return new Date(current.lastReadAt) > new Date(latest.lastReadAt)
                                ? current
                                : latest;
                        });

                    novelsMap.set(novelId, {
                        novel: progress.novel,
                        completedAt: latestProgress.lastReadAt,
                        overallProgress,
                        completedChapters,
                        totalChapters
                    });
                }
            }
        }

        // Convert map to array and sort by completion date
        let completedNovels = Array.from(novelsMap.values())
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

        // Get user's favorites to add isFavourite flag
        const Favorite = require('../models/favorite');
        const novelIds = completedNovels.map(item => item.novel._id);
        const favorites = await Favorite.find({
            user: userId,
            novel: { $in: novelIds }
        }).select('novel');

        // Create a map of favorite novel IDs
        const favoritesMap = {};
        favorites.forEach(fav => {
            favoritesMap[fav.novel.toString()] = true;
        });

        // Add isFavourite flag to each novel
        completedNovels = completedNovels.map(item => {
            const novelObj = item.novel.toObject ? item.novel.toObject() : item.novel;
            novelObj.isFavourite = !!favoritesMap[item.novel._id.toString()];

            return {
                ...item,
                novel: novelObj
            };
        });

        res.status(200).json({
            completedNovels,
            total: completedNovels.length
        });
    } catch (error) {
        console.error('Error fetching completed novels:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get all reading history (all novels user has read, both completed and in progress)
exports.getReadingHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('🔍 getReadingHistory - userId:', userId);

        // Get all novels where user has reading progress (only non-deleted)
        // Include records where isDeleted is false OR doesn't exist (for backward compatibility)
        const progressRecords = await ReadingProgress.find({
            user: userId,
            $or: [
                { isDeleted: false },
                { isDeleted: { $exists: false } }
            ]
        })
            .populate({
                path: 'novel',
                populate: {
                    path: 'author',
                    select: 'username profilePicture'
                }
            })
            .sort({ lastReadAt: -1 });

        console.log('📚 progressRecords found:', progressRecords.length);
        console.log('📋 progressRecords details:', progressRecords.map(p => ({
            novelId: p.novel?._id,
            isDeleted: p.isDeleted,
            lastReadAt: p.lastReadAt
        })));

        // Group by novel and calculate progress
        const novelsMap = new Map();
        const Chapter = require('../models/chapter');

        for (const progress of progressRecords) {
            if (!progress.novel) continue;

            const novelId = progress.novel._id.toString();

            if (!novelsMap.has(novelId)) {
                // Get total PUBLISHED chapters for this novel (not drafts)
                const totalChapters = await Chapter.countDocuments({
                    novel: novelId,
                    status: 'published'
                });

                // Get all progress for this novel
                const allNovelProgress = progressRecords.filter(
                    p => p.novel && p.novel._id.toString() === novelId
                );

                const completedChapters = allNovelProgress.filter(p => p.isCompleted).length;
                const overallProgress = totalChapters > 0
                    ? Math.round((completedChapters / totalChapters) * 100)
                    : 0;

                // Find the most recently read chapter
                const latestProgress = allNovelProgress.reduce((latest, current) => {
                    return new Date(current.lastReadAt) > new Date(latest.lastReadAt)
                        ? current
                        : latest;
                });

                novelsMap.set(novelId, {
                    novel: progress.novel,
                    lastReadAt: latestProgress.lastReadAt,
                    progressPercent: latestProgress.progressPercent,
                    overallProgress,
                    completedChapters,
                    totalChapters,
                    status: overallProgress === 100 ? 'completed' : 'reading' // completed or reading
                });
            }
        }

        // Convert map to array and sort by last read date
        let readingHistory = Array.from(novelsMap.values())
            .sort((a, b) => new Date(b.lastReadAt) - new Date(a.lastReadAt));

        // Get user's favorites to add isFavourite flag
        const Favorite = require('../models/favorite');
        const novelIds = readingHistory.map(item => item.novel._id);
        const favorites = await Favorite.find({
            user: userId,
            novel: { $in: novelIds }
        }).select('novel');

        // Create a map of favorite novel IDs
        const favoritesMap = {};
        favorites.forEach(fav => {
            favoritesMap[fav.novel.toString()] = true;
        });

        // Add isFavourite flag to each novel
        readingHistory = readingHistory.map(item => {
            const novelObj = item.novel.toObject ? item.novel.toObject() : item.novel;
            novelObj.isFavourite = !!favoritesMap[item.novel._id.toString()];

            return {
                ...item,
                novel: novelObj
            };
        });

        console.log('✅ Final readingHistory:', readingHistory.length, 'novels');
        console.log('📊 Response data:', JSON.stringify({
            total: readingHistory.length,
            novels: readingHistory.map(h => ({
                novelId: h.novel._id,
                novelTitle: h.novel.title,
                isDeleted: h.novel.isDeleted,
                status: h.status
            }))
        }, null, 2));

        res.status(200).json({
            success: true,
            readingHistory,
            total: readingHistory.length
        });
    } catch (error) {
        console.error('Error fetching reading history:', error);
        res.status(500).json({ error: error.message });
    }
};

// Delete reading history for a specific novel
exports.deleteReadingHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { novelId } = req.params;

        const ReadingProgress = require('../models/readingProgress');
        const result = await ReadingProgress.updateMany(
            {
                user: userId,
                novel: novelId,
                $or: [
                    { isDeleted: false },
                    { isDeleted: { $exists: false } }
                ]
            },
            {
                isDeleted: true,
                updatedAt: new Date()
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'No reading history found for this novel'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Reading history deleted successfully',
            deletedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error deleting reading history:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Delete all reading history
exports.deleteAllReadingHistory = async (req, res) => {
    try {
        const userId = req.user.id;

        const ReadingProgress = require('../models/readingProgress');
        const result = await ReadingProgress.updateMany(
            {
                user: userId,
                $or: [
                    { isDeleted: false },
                    { isDeleted: { $exists: false } }
                ]
            },
            {
                isDeleted: true,
                updatedAt: new Date()
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'No reading history found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'All reading history deleted successfully',
            deletedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error deleting all reading history:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Record a chapter view (24-hour cooldown per user per chapter)
exports.recordChapterView = async (req, res) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user.id;

        // Get chapter details to find novel ID
        const Chapter = require('../models/chapter');
        const chapter = await Chapter.findById(chapterId);

        if (!chapter) {
            return res.status(404).json({
                success: false,
                message: 'Chapter not found'
            });
        }

        // Record the view
        const result = await ChapterView.recordChapterView(
            userId,
            chapterId,
            chapter.novel
        );

        if (result.success) {
            // Get updated counts
            const chapterViewCount = await ChapterView.getChapterViewCount(chapterId);
            const novelViewCount = await ChapterView.getNovelViewCount(chapter.novel);

            return res.status(201).json({
                success: true,
                message: 'Chapter view recorded successfully',
                data: {
                    chapterId,
                    novelId: chapter.novel,
                    chapterViewCount,
                    novelViewCount,
                    viewedAt: result.view.viewedAt
                }
            });
        } else {
            return res.status(200).json({
                success: false,
                message: result.message,
                alreadyViewed: result.alreadyViewed,
                data: {
                    chapterId,
                    novelId: chapter.novel
                }
            });
        }

    } catch (error) {
        console.error('Error recording chapter view:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get chapter view statistics
exports.getChapterViewStats = async (req, res) => {
    try {
        const { chapterId } = req.params;
        const { timeframe } = req.query; // Optional: 24h, 7d, 30d

        let timeframeMs = null;
        if (timeframe) {
            switch (timeframe) {
                case '24h':
                    timeframeMs = 24 * 60 * 60 * 1000;
                    break;
                case '7d':
                    timeframeMs = 7 * 24 * 60 * 60 * 1000;
                    break;
                case '30d':
                    timeframeMs = 30 * 24 * 60 * 60 * 1000;
                    break;
            }
        }

        const viewCount = await ChapterView.getChapterViewCount(chapterId, timeframeMs);

        res.status(200).json({
            success: true,
            data: {
                chapterId,
                viewCount,
                timeframe: timeframe || 'all-time'
            }
        });

    } catch (error) {
        console.error('Error fetching chapter view stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get novel view statistics (sum of all chapter views)
exports.getNovelViewStats = async (req, res) => {
    try {
        const { novelId } = req.params;
        const { timeframe } = req.query; // Optional: 24h, 7d, 30d

        let timeframeMs = null;
        if (timeframe) {
            switch (timeframe) {
                case '24h':
                    timeframeMs = 24 * 60 * 60 * 1000;
                    break;
                case '7d':
                    timeframeMs = 7 * 24 * 60 * 60 * 1000;
                    break;
                case '30d':
                    timeframeMs = 30 * 24 * 60 * 60 * 1000;
                    break;
            }
        }

        const totalViews = await ChapterView.getNovelViewCount(novelId, timeframeMs);

        // Get per-chapter breakdown
        const Chapter = require('../models/chapter');
        const chapters = await Chapter.find({ novel: novelId }).select('_id title chapterNumber viewCount');

        const chapterStats = [];
        for (const chapter of chapters) {
            const chapterViews = await ChapterView.getChapterViewCount(chapter._id, timeframeMs);
            chapterStats.push({
                chapterId: chapter._id,
                title: chapter.title,
                chapterNumber: chapter.chapterNumber,
                viewCount: chapterViews,
                totalViewCount: chapter.viewCount
            });
        }

        res.status(200).json({
            success: true,
            data: {
                novelId,
                totalViews,
                timeframe: timeframe || 'all-time',
                chapters: chapterStats
            }
        });

    } catch (error) {
        console.error('Error fetching novel view stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get user's recently viewed chapters
exports.getUserRecentlyViewed = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 10 } = req.query;

        const recentlyViewed = await ChapterView.getUserRecentlyViewedChapters(
            userId,
            parseInt(limit)
        );

        res.status(200).json({
            success: true,
            data: {
                recentlyViewed,
                total: recentlyViewed.length
            }
        });

    } catch (error) {
        console.error('Error fetching recently viewed chapters:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Toggle novel favorite (like/unlike)
exports.toggleNovelFavorite = async (req, res) => {
    try {
        const { novelId } = req.params;
        const userId = req.user.id;

        // Check if novel exists
        const novel = await Novel.findById(novelId);
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: 'Novel not found'
            });
        }

        // Toggle favorite
        const result = await Favorite.toggleFavorite(userId, novelId);

        if (result.success) {
            // Get updated like count
            const totalLikes = await Favorite.getNovelLikesCount(novelId);

            return res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    novelId,
                    action: result.action,
                    isFavorited: result.isFavorited,
                    totalLikes
                }
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.message,
                data: {
                    novelId,
                    isFavorited: result.isFavorited
                }
            });
        }

    } catch (error) {
        console.error('Error toggling novel favorite:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get user's favorite novels
exports.getUserFavorites = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 20 } = req.query;

        const favorites = await Favorite.getUserFavorites(userId, parseInt(limit));

        res.status(200).json({
            success: true,
            data: {
                favorites: favorites.map(fav => ({
                    _id: fav._id,
                    novel: fav.novel,
                    favoriteAt: fav.createdAt
                })),
                total: favorites.length
            }
        });

    } catch (error) {
        console.error('Error fetching user favorites:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get novel like statistics
exports.getNovelLikeStats = async (req, res) => {
    try {
        const { novelId } = req.params;

        // Check if novel exists
        const novel = await Novel.findById(novelId).select('title totalLikes');
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: 'Novel not found'
            });
        }

        const totalLikes = await Favorite.getNovelLikesCount(novelId);

        res.status(200).json({
            success: true,
            data: {
                novelId,
                title: novel.title,
                totalLikes,
                storedLikes: novel.totalLikes
            }
        });

    } catch (error) {
        console.error('Error fetching novel like stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Check if user has favorited a novel
exports.checkNovelFavoriteStatus = async (req, res) => {
    try {
        const { novelId } = req.params;
        const userId = req.user.id;

        const isFavorited = await Favorite.isFavorited(userId, novelId);
        const totalLikes = await Favorite.getNovelLikesCount(novelId);

        res.status(200).json({
            success: true,
            data: {
                novelId,
                isFavorited,
                totalLikes
            }
        });

    } catch (error) {
        console.error('Error checking favorite status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get most liked novels
exports.getMostLikedNovels = async (req, res) => {
    try {
        const { limit = 10, timeframe } = req.query;

        let timeframeMs = null;
        if (timeframe) {
            switch (timeframe) {
                case '24h':
                    timeframeMs = 24 * 60 * 60 * 1000;
                    break;
                case '7d':
                    timeframeMs = 7 * 24 * 60 * 60 * 1000;
                    break;
                case '30d':
                    timeframeMs = 30 * 24 * 60 * 60 * 1000;
                    break;
            }
        }

        const mostLiked = await Favorite.getMostLikedNovels(parseInt(limit), timeframeMs);

        res.status(200).json({
            success: true,
            data: {
                novels: mostLiked,
                total: mostLiked.length,
                timeframe: timeframe || 'all-time'
            }
        });

    } catch (error) {
        console.error('Error fetching most liked novels:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Add novel to bookshelf
exports.addToBookshelf = async (req, res) => {
    try {
        const userId = req.user.id;
        const { novelId } = req.params;
        const { rating = 0, notes = '' } = req.body;

        // Validate rating
        if (rating < 0 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 0 and 5'
            });
        }

        // Check if novel exists
        const novel = await Novel.findById(novelId);
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: 'Novel not found'
            });
        }

        // Add or update bookshelf entry
        const Bookshelf = require('../models/bookshelf');
        const bookshelfEntry = await Bookshelf.findOneAndUpdate(
            { user: userId, novel: novelId },
            {
                rating,
                notes,
                updatedAt: new Date()
            },
            { upsert: true, new: true, runValidators: true }
        ).populate('novel', 'title coverImage author').populate('user', 'username');

        res.status(200).json({
            success: true,
            message: 'Novel added to bookshelf successfully',
            bookshelf: bookshelfEntry
        });
    } catch (error) {
        console.error('Error adding to bookshelf:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Remove novel from bookshelf
exports.removeFromBookshelf = async (req, res) => {
    try {
        const userId = req.user.id;
        const { novelId } = req.params;

        const Bookshelf = require('../models/bookshelf');
        const result = await Bookshelf.findOneAndDelete({
            user: userId,
            novel: novelId
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Bookshelf entry not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Novel removed from bookshelf successfully'
        });
    } catch (error) {
        console.error('Error removing from bookshelf:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get user's bookshelf (with filtering by status)
exports.getUserBookshelf = async (req, res) => {
    try {
        const userId = req.user.id;

        const Bookshelf = require('../models/bookshelf');
        const bookshelfEntries = await Bookshelf.find({ user: userId })
            .populate({
                path: 'novel',
                select: 'title coverImage author rating description genres status',
                populate: {
                    path: 'author',
                    select: 'username profilePicture'
                }
            })
            .sort({ updatedAt: -1 });

        // Format response similar to completed novels
        let bookshelf = bookshelfEntries.map(entry => {
            const novelObj = entry.novel.toObject ? entry.novel.toObject() : entry.novel;

            return {
                _id: entry._id,
                novel: novelObj,
                rating: entry.rating,
                notes: entry.notes,
                addedAt: entry.addedAt,
                updatedAt: entry.updatedAt
            };
        });

        // Get user's favorites to add isFavourite flag
        const Favorite = require('../models/favorite');
        const novelIds = bookshelf.map(item => item.novel._id);
        const favorites = await Favorite.find({
            user: userId,
            novel: { $in: novelIds }
        }).select('novel');

        // Create a map of favorite novel IDs
        const favoritesMap = {};
        favorites.forEach(fav => {
            favoritesMap[fav.novel.toString()] = true;
        });

        // Add isFavourite flag to each novel
        bookshelf = bookshelf.map(item => {
            item.novel.isFavourite = !!favoritesMap[item.novel._id.toString()];
            return item;
        });

        res.status(200).json({
            success: true,
            bookshelf,
            total: bookshelf.length
        });
    } catch (error) {
        console.error('Error fetching bookshelf:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Update bookshelf entry
exports.updateBookshelfEntry = async (req, res) => {
    try {
        const userId = req.user.id;
        const { novelId } = req.params;
        const { rating, notes } = req.body;

        // Validate rating if provided
        if (rating !== undefined) {
            if (rating < 0 || rating > 5) {
                return res.status(400).json({
                    success: false,
                    message: 'Rating must be between 0 and 5'
                });
            }
        }

        const Bookshelf = require('../models/bookshelf');
        const updateData = { updatedAt: new Date() };
        if (rating !== undefined) updateData.rating = rating;
        if (notes !== undefined) updateData.notes = notes;

        const bookshelfEntry = await Bookshelf.findOneAndUpdate(
            { user: userId, novel: novelId },
            updateData,
            { new: true, runValidators: true }
        ).populate('novel', 'title coverImage author').populate('user', 'username');

        if (!bookshelfEntry) {
            return res.status(404).json({
                success: false,
                message: 'Bookshelf entry not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Bookshelf entry updated successfully',
            bookshelf: bookshelfEntry
        });
    } catch (error) {
        console.error('Error updating bookshelf entry:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Check if novel is in user's bookshelf
exports.checkBookshelfStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const { novelId } = req.params;

        const Bookshelf = require('../models/bookshelf');
        const bookshelfEntry = await Bookshelf.findOne({
            user: userId,
            novel: novelId
        });

        res.status(200).json({
            success: true,
            inBookshelf: !!bookshelfEntry,
            bookshelf: bookshelfEntry || null
        });
    } catch (error) {
        console.error('Error checking bookshelf status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Toggle bookshelf - add or remove with one API
exports.toggleBookshelf = async (req, res) => {
    try {
        const { novelId } = req.params;
        const userId = req.user.id;

        // Check if novel exists
        const novel = await Novel.findById(novelId);
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: 'Novel not found'
            });
        }

        const Bookshelf = require('../models/bookshelf');

        // Check if already in bookshelf
        const existingEntry = await Bookshelf.findOne({
            user: userId,
            novel: novelId
        });

        let action, bookshelfEntry;

        if (existingEntry) {
            // Remove from bookshelf
            await Bookshelf.findOneAndDelete({
                user: userId,
                novel: novelId
            });
            action = 'removed';

            return res.status(200).json({
                success: true,
                message: 'Novel removed from bookshelf',
                data: {
                    novelId,
                    action,
                    inBookshelf: false
                }
            });
        } else {
            // Add to bookshelf
            bookshelfEntry = await Bookshelf.findOneAndUpdate(
                { user: userId, novel: novelId },
                {
                    rating: 0,
                    notes: '',
                    updatedAt: new Date()
                },
                { upsert: true, new: true, runValidators: true }
            ).populate('novel', 'title coverImage author').populate('user', 'username');

            action = 'added';

            return res.status(200).json({
                success: true,
                message: 'Novel added to bookshelf',
                data: {
                    novelId,
                    action,
                    inBookshelf: true,
                    bookshelf: bookshelfEntry
                }
            });
        }

    } catch (error) {
        console.error('Error toggling bookshelf:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};