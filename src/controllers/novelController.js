
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
        const novels = await Novel.find().populate('author', 'username');

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
            novelObj.isFavorite = !!favoritesMap[novel._id.toString()];

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
        const progressRecords = await ReadingProgress.find({ user: userId })
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
        const progressRecords = await ReadingProgress.find({ user: userId })
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

        for (const progress of progressRecords) {
            if (!progress.novel) continue;

            const novelId = progress.novel._id.toString();

            if (!novelsMap.has(novelId)) {
                // Get total chapters for this novel
                const totalChapters = progress.novel.chapters ? progress.novel.chapters.length : 0;

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
        const completedNovels = Array.from(novelsMap.values())
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

        res.status(200).json({
            completedNovels,
            total: completedNovels.length
        });
    } catch (error) {
        console.error('Error fetching completed novels:', error);
        res.status(500).json({ error: error.message });
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