const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    novel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Novel',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: false,
        trim: true,
        default: null
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    replies: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        comment: {
            type: String,
            required: true,
            trim: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index to ensure one review per user per novel
reviewSchema.index({ user: 1, novel: 1 }, { unique: true });

// Index for queries
reviewSchema.index({ novel: 1, createdAt: -1 });
reviewSchema.index({ novel: 1, rating: -1 });

// Virtual for likes count
reviewSchema.virtual('likesCount').get(function () {
    return this.likes.length;
});

// Virtual for replies count
reviewSchema.virtual('repliesCount').get(function () {
    return this.replies.length;
});

// Ensure virtuals are included in JSON
reviewSchema.set('toJSON', { virtuals: true });
reviewSchema.set('toObject', { virtuals: true });

// Static method to calculate novel average rating
reviewSchema.statics.calculateNovelRating = async function (novelId) {
    const result = await this.aggregate([
        { $match: { novel: new mongoose.Types.ObjectId(novelId) } },
        {
            $group: {
                _id: '$novel',
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
                ratings: {
                    $push: '$rating'
                }
            }
        }
    ]);

    if (result.length > 0) {
        const stats = result[0];

        // Calculate rating distribution
        const distribution = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0
        };

        stats.ratings.forEach(rating => {
            distribution[rating] = (distribution[rating] || 0) + 1;
        });

        return {
            averageRating: Math.round(stats.averageRating * 10) / 10, // Round to 1 decimal
            totalReviews: stats.totalReviews,
            distribution
        };
    }

    return {
        averageRating: 0,
        totalReviews: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
};

// Static method to check if user has reviewed a novel
reviewSchema.statics.hasUserReviewed = async function (userId, novelId) {
    const review = await this.findOne({ user: userId, novel: novelId });
    return !!review;
};

// Static method to toggle review like
reviewSchema.statics.toggleLike = async function (reviewId, userId) {
    const review = await this.findById(reviewId);

    if (!review) {
        throw new Error('Review not found');
    }

    const userIdStr = userId.toString();
    const likeIndex = review.likes.findIndex(id => id.toString() === userIdStr);

    if (likeIndex > -1) {
        // Unlike - remove user from likes array
        review.likes.splice(likeIndex, 1);
        await review.save();
        return { liked: false, likesCount: review.likes.length };
    } else {
        // Like - add user to likes array
        review.likes.push(userId);
        await review.save();
        return { liked: true, likesCount: review.likes.length };
    }
};

// Static method to add reply to review
reviewSchema.statics.addReply = async function (reviewId, userId, comment) {
    const review = await this.findById(reviewId);

    if (!review) {
        throw new Error('Review not found');
    }

    review.replies.push({
        user: userId,
        comment,
        createdAt: new Date()
    });

    await review.save();

    // Populate the user info in the reply
    await review.populate('replies.user', 'username profilePicture');

    return review.replies[review.replies.length - 1];
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;