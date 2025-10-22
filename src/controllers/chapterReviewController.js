const ChapterReview = require('../models/chapterReview');
const Chapter = require('../models/chapter');
const Novel = require('../models/novel');

// Add or update a review for a chapter (upsert behavior)
exports.addChapterReview = async (req, res) => {
    try {
        const { chapterId } = req.params;
        const { rating, comment } = req.body;
        const userId = req.user.id;

        // Validate input: rating is required, comment is optional
        if (rating === undefined || rating === null) {
            return res.status(400).json({
                success: false,
                message: 'Rating is required'
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Check if chapter exists and get novel ID
        const chapter = await Chapter.findById(chapterId);
        if (!chapter) {
            return res.status(404).json({
                success: false,
                message: 'Chapter not found'
            });
        }

        // Check if user already reviewed this chapter
        let review = await ChapterReview.findOne({ user: userId, chapter: chapterId });

        if (review) {
            // Update existing review
            review.rating = rating;
            review.comment = comment && comment.trim().length > 0 ? comment.trim() : review.comment;
            review.updatedAt = Date.now();
            await review.save();

            await review.populate('user', 'username profilePicture');

            return res.status(200).json({
                success: true,
                message: 'Chapter review updated successfully',
                data: {
                    review
                }
            });
        }

        // Create new review (comment is optional)
        const newReview = new ChapterReview({
            user: userId,
            chapter: chapterId,
            novel: chapter.novel,
            rating,
            comment: comment && comment.trim().length > 0 ? comment.trim() : null
        });

        await newReview.save();

        // Populate user info
        await newReview.populate('user', 'username profilePicture');

        return res.status(201).json({
            success: true,
            message: 'Chapter review added successfully',
            data: {
                review: newReview
            }
        });

    } catch (error) {
        console.error('Error adding/updating chapter review:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get all reviews for a chapter
exports.getChapterReviews = async (req, res) => {
    try {
        const { chapterId } = req.params;
        const { sortBy = 'recent', filterByRating, limit = 20, page = 1 } = req.query;

        // Check if chapter exists
        const chapter = await Chapter.findById(chapterId);
        if (!chapter) {
            return res.status(404).json({
                success: false,
                message: 'Chapter not found'
            });
        }

        // Build query filter
        const filter = { chapter: chapterId };

        // Add rating filter if provided
        if (filterByRating) {
            const rating = parseInt(filterByRating);
            if (rating >= 1 && rating <= 5) {
                filter.rating = rating;
            }
        }

        // Determine sort order
        let sortOptions = {};
        switch (sortBy) {
            case 'recent':
                sortOptions = { createdAt: -1 };
                break;
            case 'oldest':
                sortOptions = { createdAt: 1 };
                break;
            case 'highest':
                sortOptions = { rating: -1, createdAt: -1 };
                break;
            case 'lowest':
                sortOptions = { rating: 1, createdAt: -1 };
                break;
            case 'most-liked':
                sortOptions = { likesCount: -1, createdAt: -1 };
                break;
            case '5star':
                filter.rating = 5;
                sortOptions = { createdAt: -1 };
                break;
            case '4star':
                filter.rating = 4;
                sortOptions = { createdAt: -1 };
                break;
            case '3star':
                filter.rating = 3;
                sortOptions = { createdAt: -1 };
                break;
            case '2star':
                filter.rating = 2;
                sortOptions = { createdAt: -1 };
                break;
            case '1star':
                filter.rating = 1;
                sortOptions = { createdAt: -1 };
                break;
            default:
                sortOptions = { createdAt: -1 };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get reviews with pagination and filtering
        const reviews = await ChapterReview.find(filter)
            .populate('user', 'username profilePicture')
            .populate('replies.user', 'username profilePicture')
            .sort(sortOptions)
            .limit(parseInt(limit))
            .skip(skip);

        const totalReviews = await ChapterReview.countDocuments(filter);

        const userId = req.user?.id;

        // Transform reviews to exclude likes array and add isLikedByUser
        const transformedReviews = reviews.map(review => {
            const reviewObj = review.toObject();

            // Check if current user has liked this review
            const isLikedByUser = userId && reviewObj.likes.some(likeUserId => likeUserId.toString() === userId);

            // Remove likes array and add isLikedByUser
            delete reviewObj.likes;
            reviewObj.isLikedByUser = isLikedByUser;

            // Transform replies to remove likes array
            if (reviewObj.replies && reviewObj.replies.length > 0) {
                reviewObj.replies = reviewObj.replies.map(reply => {
                    delete reply.likes;
                    return reply;
                });
            }

            return reviewObj;
        });

        res.status(200).json({
            success: true,
            data: {
                reviews: transformedReviews,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalReviews / parseInt(limit)),
                    totalReviews,
                    limit: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Error fetching chapter reviews:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Update user's chapter review
exports.updateChapterReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { rating, comment } = req.body;
        const userId = req.user.id;

        const review = await ChapterReview.findById(reviewId);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Chapter review not found'
            });
        }

        // Check if user owns this review
        if (review.user.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own chapter reviews'
            });
        }

        // Update fields if provided
        if (rating !== undefined) {
            if (rating < 1 || rating > 5) {
                return res.status(400).json({
                    success: false,
                    message: 'Rating must be between 1 and 5'
                });
            }
            review.rating = rating;
        }

        if (comment !== undefined) {
            review.comment = comment;
        }

        review.updatedAt = Date.now();
        await review.save();

        await review.populate('user', 'username profilePicture');

        res.status(200).json({
            success: true,
            message: 'Chapter review updated successfully',
            data: {
                review
            }
        });

    } catch (error) {
        console.error('Error updating chapter review:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Delete user's chapter review
exports.deleteChapterReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId = req.user.id;

        const review = await ChapterReview.findById(reviewId);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Chapter review not found'
            });
        }

        // Check if user owns this review
        if (review.user.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own chapter reviews'
            });
        }

        await ChapterReview.findByIdAndDelete(reviewId);

        res.status(200).json({
            success: true,
            message: 'Chapter review deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting chapter review:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Toggle like on a chapter review
exports.toggleChapterReviewLike = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId = req.user.id;

        const result = await ChapterReview.toggleLike(reviewId, userId);

        res.status(200).json({
            success: true,
            message: result.liked ? 'Chapter review liked' : 'Chapter review unliked',
            data: {
                reviewId,
                liked: result.liked,
                likesCount: result.likesCount
            }
        });

    } catch (error) {
        console.error('Error toggling chapter review like:', error);

        if (error.message === 'Chapter review not found') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Add reply to a chapter review
exports.addReplyToChapterReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { comment } = req.body;
        const userId = req.user.id;

        if (!comment || comment.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Reply comment is required'
            });
        }

        const reply = await ChapterReview.addReply(reviewId, userId, comment);

        res.status(201).json({
            success: true,
            message: 'Reply added to chapter review successfully',
            data: {
                reply
            }
        });

    } catch (error) {
        console.error('Error adding reply to chapter review:', error);

        if (error.message === 'Chapter review not found') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get user's review for a specific chapter
exports.getUserChapterReview = async (req, res) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user.id;

        const review = await ChapterReview.findOne({ user: userId, chapter: chapterId })
            .populate('user', 'username profilePicture')
            .populate('replies.user', 'username profilePicture');

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Chapter review not found',
                hasReviewed: false
            });
        }

        res.status(200).json({
            success: true,
            hasReviewed: true,
            data: {
                review
            }
        });

    } catch (error) {
        console.error('Error fetching user chapter review:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get review statistics for a chapter
exports.getChapterReviewStats = async (req, res) => {
    try {
        const { chapterId } = req.params;

        const chapter = await Chapter.findById(chapterId).select('title chapterNumber');

        if (!chapter) {
            return res.status(404).json({
                success: false,
                message: 'Chapter not found'
            });
        }

        const stats = await ChapterReview.calculateChapterRating(chapterId);

        res.status(200).json({
            success: true,
            data: {
                chapterId,
                title: chapter.title,
                chapterNumber: chapter.chapterNumber,
                ...stats
            }
        });

    } catch (error) {
        console.error('Error fetching chapter review stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};