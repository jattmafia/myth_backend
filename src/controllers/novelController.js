
const AWS = require('aws-sdk');
const Novel = require('../models/novel'); // Import the Novel model
const User = require('../models/user'); // Import the User model
const Category = require('../models/category');
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
        const { title, description, hookupDescription, language, categories, subcategories, pricingModel } = req.body;
        const coverImage = req.file;
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('Received data:', { title, description, hookupDescription, language, coverImage, pricingModel });

        if (title === undefined || description === undefined || coverImage === undefined) {
            return res.status(400).json({ message: 'title, description, and cover image are required' });
        }

        // Validate pricing model
        const pricing = pricingModel || 'free';
        if (!['free', 'paid'].includes(pricing)) {
            return res.status(400).json({ message: 'pricingModel must be either "free" or "paid"' });
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
        // Resolve categories (accept slugs or ids) and store ObjectId refs
        let categoryIds = [];
        if (Array.isArray(categories) && categories.length > 0) {
            for (const item of categories) {
                let cat = null;
                if (item && typeof item === 'string') {
                    if (require('mongoose').Types.ObjectId.isValid(item)) {
                        cat = await Category.findById(item);
                    }
                    if (!cat) {
                        const slug = item.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        cat = await Category.findOne({ slug });
                    }
                }
                if (!cat) {
                    return res.status(400).json({ message: `Category not found: ${item}` });
                }
                categoryIds.push(cat._id);
            }
        }

        // Resolve subcategories similarly
        let subcategoryIds = [];
        if (Array.isArray(subcategories) && subcategories.length > 0) {
            for (const item of subcategories) {
                let sub = null;
                if (item && typeof item === 'string') {
                    if (require('mongoose').Types.ObjectId.isValid(item)) {
                        sub = await Category.findById(item);
                    }
                    if (!sub) {
                        const slug = item.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        sub = await Category.findOne({ slug });
                    }
                }
                if (!sub) {
                    return res.status(400).json({ message: `Subcategory not found: ${item}` });
                }
                subcategoryIds.push(sub._id);
            }
        }

        // Create novel document
        const newNovel = new Novel({
            title,
            description,
            hookupDescription,
            language,
            coverImage: uploadResult.Key,
            author: user._id,
            categories: categoryIds,
            subcategories: subcategoryIds,
            pricingModel: pricing
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

        // Initialize favoritesMap
        let favoritesMap = {};

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
        const novels = await Novel.find({ author: req.user.id })
            .populate('author', 'username profilePicture')
            .populate('categories', 'name slug')
            .populate('subcategories', 'name slug')
            .select('title author chapters language coverImage description categories subcategories status totalViews totalLikes averageRating totalReviews pricingModel createdAt updatedAt');

        res.status(200).json(novels);
    } catch (error) {
        console.error('Error fetching novels by user:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get discover novels (latest releases, most popular, recommended, premium, free)
// Query params: pricing=free|paid|all (default: all), premium=true (alias for paid)
// Separate limit params: latestLimit=1-10, popularLimit=1-10, recommendedLimit=1-10, premiumLimit=1-10, freeLimit=1-10 (each default: 10, max 10)
exports.getDiscoverNovels = async (req, res) => {
    try {
        const userId = req.user?.id;

        // Parse individual limits for each section (default 10, max 10)
        const latestLimit = Math.min(Math.max(parseInt(req.query.latestLimit) || 10, 1), 10);
        const popularLimit = Math.min(Math.max(parseInt(req.query.popularLimit) || 10, 1), 10);
        const recommendedLimit = Math.min(Math.max(parseInt(req.query.recommendedLimit) || 10, 1), 10);
        const premiumLimit = Math.min(Math.max(parseInt(req.query.premiumLimit) || 10, 1), 10);
        const freeLimit = Math.min(Math.max(parseInt(req.query.freeLimit) || 10, 1), 10);

        // pricing filter: 'free', 'paid', or 'all'
        let pricing = (req.query.pricing || req.query.premium === 'true' ? 'paid' : 'all').toString().toLowerCase();
        if (!['free', 'paid', 'all'].includes(pricing)) pricing = 'all';

        // base match for status and optional pricing
        const baseMatch = { status: { $in: ['published', 'ongoing'] } };
        if (pricing !== 'all') baseMatch.pricingModel = pricing;

        // Get latest releases (recently created novels)
        const latestReleases = await Novel.find(baseMatch)
            .select('title coverImage')
            .sort({ createdAt: -1 })
            .limit(latestLimit);

        // Get most popular novels (based on favorites count)
        const mostPopular = await Novel.aggregate([
            { $match: baseMatch },
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
            { $sort: { favoritesCount: -1 } },
            { $limit: popularLimit },
            { $project: { title: 1, coverImage: 1 } }
        ]);

        // Get recommended novels (highest rated novels)
        const recommendedMatch = { ...baseMatch, averageRating: { $gte: 4.0 } };
        const recommended = await Novel.find(recommendedMatch)
            .select('title coverImage')
            .sort({ averageRating: -1, totalReviews: -1 })
            .limit(recommendedLimit);

        // Get premium (paid) novels
        const premiumMatch = { status: { $in: ['published', 'ongoing'] }, pricingModel: 'paid' };
        const premium = await Novel.find(premiumMatch)
            .select('title coverImage')
            .sort({ createdAt: -1 })
            .limit(premiumLimit);

        // Get free novels
        const freeMatch = { status: { $in: ['published', 'ongoing'] }, pricingModel: 'free' };
        const free = await Novel.find(freeMatch)
            .select('title coverImage')
            .sort({ createdAt: -1 })
            .limit(freeLimit);

        // If user is logged in, add favorite status
        let favoritesMap = {};

        if (userId) {
            // Get user favorites for all novels
            const allNovelIds = [
                ...latestReleases.map(n => n._id),
                ...mostPopular.map(n => n._id),
                ...recommended.map(n => n._id),
                ...premium.map(n => n._id),
                ...free.map(n => n._id)
            ].filter(Boolean);

            if (allNovelIds.length > 0) {
                const userFavorites = await Favorite.find({
                    user: userId,
                    novel: { $in: allNovelIds }
                }).select('novel');

                userFavorites.forEach(fav => {
                    favoritesMap[fav.novel.toString()] = true;
                });
            }
        }

        // Transform novels to add extra info
        const transformNovels = (novels) => {
            return novels.map(novel => {
                const novelObj = novel.toObject ? novel.toObject() : novel;
                novelObj.isFavourite = !!favoritesMap[novelObj._id.toString()];

                return novelObj;
            });
        };

        res.status(200).json({
            success: true,
            data: {
                latestReleases: transformNovels(latestReleases),
                mostPopular: transformNovels(mostPopular),
                recommended: transformNovels(recommended),
                premium: transformNovels(premium),
                free: transformNovels(free)
            },
            meta: {
                pricing,
                limits: {
                    latestLimit,
                    popularLimit,
                    recommendedLimit,
                    premiumLimit,
                    freeLimit
                }
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

// Get paginated results for a specific discover section
// Query params: section=latestReleases|mostPopular|recommended|premium|free (required)
// page=1 (default), limit=1-50 (default: 10, max 50)
// pricing=free|paid|all (filters for latestReleases, mostPopular, recommended only; default: all)
exports.getDiscoverSection = async (req, res) => {
    try {
        const userId = req.user?.id;
        const sectionInput = (req.query.section || '').toLowerCase();
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
        const skip = (page - 1) * limit;

        // Map lowercase input to camelCase section names
        const sectionMap = {
            'latestreleases': 'latestReleases',
            'mostpopular': 'mostPopular',
            'recommended': 'recommended',
            'premium': 'premium',
            'free': 'free'
        };

        const section = sectionMap[sectionInput];

        // Validate section
        if (!section) {
            const validSections = Object.keys(sectionMap);
            return res.status(400).json({
                success: false,
                message: `Invalid section. Must be one of: ${validSections.join(', ')}`
            });
        }

        // pricing filter: 'free', 'paid', or 'all'
        let pricing = (req.query.pricing || 'all').toString().toLowerCase();
        if (!['free', 'paid', 'all'].includes(pricing)) pricing = 'all';

        let query = { status: { $in: ['published', 'ongoing'] } };
        let sortBy = { createdAt: -1 };
        let usesAggregation = false;
        let aggregationPipeline = null;

        // Set query and sorting based on section
        switch (section) {
            case 'latestReleases':
                if (pricing !== 'all') query.pricingModel = pricing;
                usesAggregation = true;
                aggregationPipeline = [
                    { $match: query },
                    { $group: { _id: '$_id', title: { $first: '$title' }, coverImage: { $first: '$coverImage' }, createdAt: { $first: '$createdAt' } } },
                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: limit },
                    { $project: { _id: 1, title: 1, coverImage: 1 } }
                ];
                break;

            case 'mostPopular':
                if (pricing !== 'all') query.pricingModel = pricing;
                usesAggregation = true;
                aggregationPipeline = [
                    { $match: query },
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
                    { $group: { _id: '$_id', title: { $first: '$title' }, coverImage: { $first: '$coverImage' }, favoritesCount: { $first: '$favoritesCount' } } },
                    { $sort: { favoritesCount: -1 } },
                    { $skip: skip },
                    { $limit: limit },
                    { $project: { _id: 1, title: 1, coverImage: 1, favoritesCount: 1 } }
                ];
                break;

            case 'recommended':
                if (pricing !== 'all') query.pricingModel = pricing;
                query.averageRating = { $gte: 4.0 };
                sortBy = { averageRating: -1, totalReviews: -1 };
                break;

            case 'premium':
                query.pricingModel = 'paid';
                sortBy = { createdAt: -1 };
                break;

            case 'free':
                query.pricingModel = 'free';
                sortBy = { createdAt: -1 };
                break;
        }

        // Fetch paginated results
        let novels = [];
        let totalCount = 0;

        if (usesAggregation) {
            novels = await Novel.aggregate(aggregationPipeline);
            totalCount = await Novel.countDocuments(query);
        } else {
            // For other sections using find
            totalCount = await Novel.countDocuments(query);
            novels = await Novel.find(query)
                .select('title coverImage')
                .sort(sortBy)
                .skip(skip)
                .limit(limit);
        }

        // If user is logged in, add favorite status
        let favoritesMap = {};

        if (userId && novels.length > 0) {
            const novelIds = novels.map(n => n._id);
            const userFavorites = await Favorite.find({
                user: userId,
                novel: { $in: novelIds }
            }).select('novel');

            userFavorites.forEach(fav => {
                favoritesMap[fav.novel.toString()] = true;
            });
        }

        // Transform novels to add extra info
        const transformedNovels = novels.map(novel => {
            const novelObj = novel.toObject ? novel.toObject() : novel;
            novelObj.isFavourite = !!favoritesMap[novelObj._id.toString()];
            return novelObj;
        });

        const totalPages = Math.ceil(totalCount / limit);

        res.status(200).json({
            success: true,
            data: transformedNovels,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: totalCount,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            },
            meta: {
                section,
                pricing: (section === 'premium' || section === 'free') ? null : pricing
            }
        });

    } catch (error) {
        console.error('Error fetching discover section:', error);
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

        const { title, description, hookupDescription, language, status, categories, subcategories, pricingModel } = req.body;

        const novel = await Novel.findById(novelId);

        if (!novel) {
            return res.status(404).json({ message: `Novel not found for ${novelId}` });
        }
        if (novel.author.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Validate pricing model if provided
        if (pricingModel !== undefined) {
            if (!['free', 'paid'].includes(pricingModel)) {
                return res.status(400).json({ message: 'pricingModel must be either "free" or "paid"' });
            }
        }

        // Update fields only if they are provided
        if (title !== undefined) novel.title = title;
        if (description !== undefined) novel.description = description;
        if (hookupDescription !== undefined) novel.hookupDescription = hookupDescription;
        if (language !== undefined) novel.language = language;
        if (status !== undefined) novel.status = status;
        if (categories !== undefined) {
            // Resolve categories to ObjectIds
            if (!Array.isArray(categories)) {
                return res.status(400).json({ message: 'categories must be an array of ids or slugs' });
            }
            const resolved = [];
            for (const item of categories) {
                let cat = null;
                if (item && typeof item === 'string') {
                    if (require('mongoose').Types.ObjectId.isValid(item)) {
                        cat = await Category.findById(item);
                    }
                    if (!cat) {
                        const slug = item.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        cat = await Category.findOne({ slug });
                    }
                }
                if (!cat) {
                    return res.status(400).json({ message: `Category not found: ${item}` });
                }
                resolved.push(cat._id);
            }
            novel.categories = resolved;
        }
        if (subcategories !== undefined) {
            // Resolve subcategories to ObjectIds
            if (!Array.isArray(subcategories)) {
                return res.status(400).json({ message: 'subcategories must be an array of ids or slugs' });
            }
            const resolvedSubs = [];
            for (const item of subcategories) {
                let cat = null;
                if (item && typeof item === 'string') {
                    if (require('mongoose').Types.ObjectId.isValid(item)) {
                        cat = await Category.findById(item);
                    }
                    if (!cat) {
                        const slug = item.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        cat = await Category.findOne({ slug });
                    }
                }
                if (!cat) {
                    return res.status(400).json({ message: `Subcategory not found: ${item}` });
                }
                resolvedSubs.push(cat._id);
            }
            novel.subcategories = resolvedSubs;
        }
        if (pricingModel !== undefined) novel.pricingModel = pricingModel;

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
            .populate('categories', 'name slug')
            .populate('subcategories', 'name slug')
            .populate({
                path: 'chapters',
                match: { status: 'published' },
                select: 'title chapterNumber createdAt viewCount coverImage coinCost' // Exclude content and author to make API lighter
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

        // Get chapter access info for paid novels
        const ChapterAccess = require('../models/chapterAccess');
        let userAccessMap = {};

        if (userId && novel.pricingModel === 'paid' && novel.chapters && novel.chapters.length > 0) {
            const chapterIds = novel.chapters.map(ch => ch._id);
            const userAccess = await ChapterAccess.find({
                user: userId,
                chapter: { $in: chapterIds }
            }).select('chapter accessType');

            userAccess.forEach(access => {
                userAccessMap[access.chapter.toString()] = access.accessType;
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

            // Add chapter lock status and unlockedMethod based on pricing model
            // unlockedMethod values: 'free' (free novel or sample chapters), 'purchased', 'coin', 'ad', or null
            chapterObj.unlockedMethod = null;
            if (novel.pricingModel === 'free') {
                // All chapters are accessible in free novels
                chapterObj.isLocked = false;
                chapterObj.unlockedMethod = 'free';
            } else {
                // Paid novel logic
                if (chapter.chapterNumber <= 5) {
                    // Chapters 1-5 are free samples
                    chapterObj.isLocked = false;
                    chapterObj.unlockedMethod = 'free';
                } else {
                    // Chapters 6+ require purchase/unlock
                    const accessType = userId ? userAccessMap[chapterId] : null;
                    if (accessType === 'purchased' || accessType === 'coin' || accessType === 'ad') {
                        // User has unlocked this chapter (via purchase, coin, or ad)
                        chapterObj.isLocked = false;
                        chapterObj.unlockedMethod = accessType;
                    } else {
                        // Either not logged in or not unlocked
                        chapterObj.isLocked = true;
                        chapterObj.unlockedMethod = null;
                    }
                }
            }

            return chapterObj;
        });

        // Calculate overall novel progress
        let overallProgress = 0;
        let completedChapters = 0;

        if (userId && chaptersWithProgress.length > 0) {
            completedChapters = chaptersWithProgress.filter(ch => ch.readingProgress.isCompleted).length;
            overallProgress = Math.round((completedChapters / chaptersWithProgress.length) * 100);
        }

        // ...existing code...

        // Build response
        const novelData = novel.toObject();
        novelData.chapters = chaptersWithProgress;
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

            // Check if novel is favorited by user
            const Favorite = require('../models/favorite');
            const favoriteEntry = await Favorite.findOne({
                user: userId,
                novel: novelId
            });
            novelData.isFavourite = !!favoriteEntry;

            // Check if user follows the author
            if (novelData.author && novelData.author._id) {
                const User = require('../models/user');
                const currentUser = await User.findById(userId).select('following');
                novelData.author.isFollowed = currentUser && currentUser.following.map(id => id.toString()).includes(novelData.author._id.toString());
            }
        } else {
            novelData.isBookshelf = false;
            novelData.isFavourite = false;
            if (novelData.author) {
                novelData.author.isFollowed = false;
            }
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

// Search novels and authors by same search text (exclude draft novels)
// Query params:
// q (required) - search text
// page, limit - pagination for novels (default limit 10, max 50)
// authorLimit - number of authors to return (default 5, max 20)
exports.search = async (req, res) => {
    try {
        const q = (req.query.q || '').toString().trim();
        if (!q) return res.status(400).json({ success: false, message: 'q (search text) is required' });

        // novels pagination
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
        const skip = (page - 1) * limit;

        // authors limit
        const authorLimit = Math.min(Math.max(parseInt(req.query.authorLimit) || 5, 1), 20);

        // Prefer using MongoDB text search (requires text indexes on models). Fall back to regex if text search fails.
        const User = require('../models/user');

        let novels = [];
        let totalNovels = 0;
        let authors = [];

        try {
            // Text search for novels (exclude drafts)
            const novelTextQuery = { $text: { $search: q }, status: { $in: ['published', 'ongoing'] } };

            const novelsPromise = Novel.find(novelTextQuery, { score: { $meta: 'textScore' } })
                .select('title coverImage author hookupDescription pricingModel score')
                .populate('author', 'username profilePicture')
                .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const novelsCountPromise = Novel.countDocuments(novelTextQuery);

            // Text search for authors
            const authorsPromise = User.find({ $text: { $search: q } }, { score: { $meta: 'textScore' } })
                .select('username profilePicture fullName score')
                .sort({ score: { $meta: 'textScore' } })
                .limit(authorLimit);

            [novels, totalNovels, authors] = await Promise.all([novelsPromise, novelsCountPromise, authorsPromise]);
        } catch (textErr) {
            // fallback to regex search if text search not available
            const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
            const regex = new RegExp(escapeRegex(q), 'i');

            const novelQuery = {
                status: { $in: ['published', 'ongoing'] },
                $or: [
                    { title: regex },
                    { description: regex },
                    { hookupDescription: regex }
                ]
            };

            const novelsPromise = Novel.find(novelQuery)
                .select('title coverImage author hookupDescription pricingModel')
                .populate('author', 'username profilePicture')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const novelsCountPromise = Novel.countDocuments(novelQuery);

            const authorQuery = {
                $or: [
                    { username: regex },
                    { fullName: regex }
                ]
            };
            const authorsPromise = User.find(authorQuery)
                .select('username profilePicture fullName')
                .limit(authorLimit);

            [novels, totalNovels, authors] = await Promise.all([novelsPromise, novelsCountPromise, authorsPromise]);
        }

        // mark if current user has favourited novels (if authenticated)
        const favoritesMap = {};
        const userId = req.user?.id;
        if (userId && novels.length > 0) {
            const novelIds = novels.map(n => n._id);
            const userFavorites = await Favorite.find({ user: userId, novel: { $in: novelIds } }).select('novel');
            userFavorites.forEach(f => { favoritesMap[f.novel.toString()] = true; });
        }

        const novelsWithExtras = novels.map(n => {
            const obj = n.toObject ? n.toObject() : n;
            obj.isFavourite = !!favoritesMap[obj._id.toString()];
            return obj;
        });

        const totalPages = Math.ceil(totalNovels / limit);

        res.status(200).json({
            success: true,
            data: {
                novels: novelsWithExtras,
                authors
            },
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: totalNovels,
                itemsPerPage: limit
            }
        });

    } catch (error) {
        console.error('Error in search:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// Get novels by category (category id or slug) with pagination
// Query params:
// - category (string, required) - category id or slug
// - page (int, optional) - default 1
// - limit (int, optional) - default 10, max 50
// Auth: optional (if provided, `isFavourite` will be set on returned novels)
exports.getNovelsByCategory = async (req, res) => {
    try {
        const categoryInput = (req.query.category || '').toString().trim();
        if (!categoryInput) return res.status(400).json({ success: false, message: 'category is required (id or slug)' });

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
        const skip = (page - 1) * limit;



        // Resolve category id (accept ObjectId or slug)
        const mongoose = require('mongoose');
        let category = null;
        if (mongoose.Types.ObjectId.isValid(categoryInput)) {
            category = await Category.findById(categoryInput);
        }
        if (!category) {
            const slug = categoryInput.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            category = await Category.findOne({ slug });
        }
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        // Only show published/ongoing novels, and those that list the category in categories or subcategories
        const match = {
            status: { $in: ['published', 'ongoing'] },
            $or: [{ categories: category._id }, { subcategories: category._id }]
        };



        const [novels, total] = await Promise.all([
            Novel.find(match)
                .select('title coverImage author hookupDescription pricingModel totalViews averageRating totalReviews createdAt')
                .populate('author', 'username profilePicture')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Novel.countDocuments(match)
        ]);



        // Add isFavourite if user provided (optional)
        const userId = req.user?.id;
        const favoritesMap = {};
        if (userId && novels.length > 0) {
            const novelIds = novels.map(n => n._id);
            const userFavorites = await Favorite.find({ user: userId, novel: { $in: novelIds } }).select('novel');
            userFavorites.forEach(f => { favoritesMap[f.novel.toString()] = true; });
        }

        const novelsWithExtras = novels.map(n => {
            const obj = n.toObject ? n.toObject() : n;
            obj.isFavourite = !!favoritesMap[obj._id.toString()];
            return obj;
        });

        const totalPages = Math.ceil(total / limit);

        res.status(200).json({
            success: true,
            data: {
                category: { _id: category._id, name: category.name, slug: category.slug },
                novels: novelsWithExtras
            },
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: total,
                itemsPerPage: limit
            }
        });
    } catch (error) {
        console.error('Error in getNovelsByCategory:', error, error.stack);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};