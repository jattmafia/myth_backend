const Review = require('../models/review');
const Novel = require('../models/novel');
const Favorite = require('../models/favorite');

// Add or update a review for a novel (upsert behavior)
exports.addReview = async (req, res) => {
    try {
        const { novelId } = req.params;
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

        // Check if novel exists
        const novel = await Novel.findById(novelId);
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: 'Novel not found'
            });
        }

        // Check if user already reviewed this novel
        let review = await Review.findOne({ user: userId, novel: novelId });

        if (review) {
            // Update existing review
            review.rating = rating;
            review.comment = comment && comment.trim().length > 0 ? comment.trim() : review.comment;
            review.updatedAt = Date.now();
            await review.save();

            // Recalculate novel stats
            const stats = await Review.calculateNovelRating(novelId);
            await Novel.findByIdAndUpdate(novelId, {
                averageRating: stats.averageRating,
                totalReviews: stats.totalReviews
            });

            await review.populate('user', 'username profilePicture');

            return res.status(200).json({
                success: true,
                message: 'Review updated successfully',
                data: {
                    review,
                    novelStats: stats
                }
            });
        }

        // Create new review (comment is optional)
        const newReview = new Review({
            user: userId,
            novel: novelId,
            rating,
            comment: comment && comment.trim().length > 0 ? comment.trim() : null
        });

        await newReview.save();

        // Update novel rating statistics
        const stats = await Review.calculateNovelRating(novelId);
        await Novel.findByIdAndUpdate(novelId, {
            averageRating: stats.averageRating,
            totalReviews: stats.totalReviews
        });

        // Populate user info
        await newReview.populate('user', 'username profilePicture');

        return res.status(201).json({
            success: true,
            message: 'Review added successfully',
            data: {
                review: newReview,
                novelStats: stats
            }
        });

    } catch (error) {
        console.error('Error adding/updating review:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get all reviews for a novel
exports.getNovelReviews = async (req, res) => {
    try {
        const { novelId } = req.params;
        const { sortBy = 'recent', filterByRating, limit = 20, page = 1 } = req.query;

        // Check if novel exists
        const novel = await Novel.findById(novelId);
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: 'Novel not found'
            });
        }

        // Build query filter
        const filter = { novel: novelId };

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
        const reviews = await Review.find(filter)
            .populate('user', 'username profilePicture')
            .populate('replies.user', 'username profilePicture')
            .sort(sortOptions)
            .limit(parseInt(limit))
            .skip(skip);

        const totalReviews = await Review.countDocuments(filter);

        // Check if novel is favorited by the user
        const userId = req.user?.id;
        let isFavorite = false;

        if (userId) {
            const favorite = await Favorite.findOne({ user: userId, novel: novelId });
            isFavorite = !!favorite;
        }

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
                isFavorite,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalReviews / parseInt(limit)),
                    totalReviews,
                    limit: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Update user's review
exports.updateReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { rating, comment } = req.body;
        const userId = req.user.id;

        const review = await Review.findById(reviewId);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Check if user owns this review
        if (review.user.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own reviews'
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

        // Update novel rating statistics
        const stats = await Review.calculateNovelRating(review.novel);
        await Novel.findByIdAndUpdate(review.novel, {
            averageRating: stats.averageRating,
            totalReviews: stats.totalReviews
        });

        await review.populate('user', 'username profilePicture');

        res.status(200).json({
            success: true,
            message: 'Review updated successfully',
            data: {
                review,
                novelStats: stats
            }
        });

    } catch (error) {
        console.error('Error updating review:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Delete user's review
exports.deleteReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId = req.user.id;

        const review = await Review.findById(reviewId);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Check if user owns this review
        if (review.user.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own reviews'
            });
        }

        const novelId = review.novel;
        await Review.findByIdAndDelete(reviewId);

        // Update novel rating statistics
        const stats = await Review.calculateNovelRating(novelId);
        await Novel.findByIdAndUpdate(novelId, {
            averageRating: stats.averageRating,
            totalReviews: stats.totalReviews
        });

        res.status(200).json({
            success: true,
            message: 'Review deleted successfully',
            data: {
                novelStats: stats
            }
        });

    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Toggle like on a review
exports.toggleReviewLike = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId = req.user.id;

        const result = await Review.toggleLike(reviewId, userId);

        res.status(200).json({
            success: true,
            message: result.liked ? 'Review liked' : 'Review unliked',
            data: {
                reviewId,
                liked: result.liked,
                likesCount: result.likesCount
            }
        });

    } catch (error) {
        console.error('Error toggling review like:', error);

        if (error.message === 'Review not found') {
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

// Add reply to a review
exports.addReplyToReview = async (req, res) => {
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

        const reply = await Review.addReply(reviewId, userId, comment);

        res.status(201).json({
            success: true,
            message: 'Reply added successfully',
            data: {
                reply
            }
        });

    } catch (error) {
        console.error('Error adding reply to review:', error);

        if (error.message === 'Review not found') {
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

// Get user's review for a specific novel
exports.getUserReviewForNovel = async (req, res) => {
    try {
        const { novelId } = req.params;
        const userId = req.user.id;

        const review = await Review.findOne({ user: userId, novel: novelId })
            .populate('user', 'username profilePicture')
            .populate('replies.user', 'username profilePicture');

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found',
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
        console.error('Error fetching user review:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get review statistics for a novel
exports.getNovelReviewStats = async (req, res) => {
    try {
        const { novelId } = req.params;

        const novel = await Novel.findById(novelId).select('title averageRating totalReviews');

        if (!novel) {
            return res.status(404).json({
                success: false,
                message: 'Novel not found'
            });
        }

        const stats = await Review.calculateNovelRating(novelId);

        res.status(200).json({
            success: true,
            data: {
                novelId,
                title: novel.title,
                ...stats
            }
        });

    } catch (error) {
        console.error('Error fetching review stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};