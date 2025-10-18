const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
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
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index to ensure one favorite per user per novel
favoriteSchema.index({ user: 1, novel: 1 }, { unique: true });

// Index for queries
favoriteSchema.index({ novel: 1, createdAt: -1 });
favoriteSchema.index({ user: 1, createdAt: -1 });

// Static method to toggle favorite (add/remove)
favoriteSchema.statics.toggleFavorite = async function (userId, novelId) {
    try {
        // Check if already favorited
        const existingFavorite = await this.findOne({
            user: userId,
            novel: novelId
        });

        if (existingFavorite) {
            // Remove from favorites (unlike)
            await this.deleteOne({ _id: existingFavorite._id });

            // Decrease novel like count
            const Novel = require('./novel');
            await Novel.findByIdAndUpdate(novelId, {
                $inc: { totalLikes: -1 }
            });

            return {
                success: true,
                action: 'removed',
                message: 'Novel removed from favorites',
                isFavorited: false
            };
        } else {
            // Add to favorites (like)
            const newFavorite = new this({
                user: userId,
                novel: novelId
            });

            await newFavorite.save();

            // Increase novel like count
            const Novel = require('./novel');
            await Novel.findByIdAndUpdate(novelId, {
                $inc: { totalLikes: 1 }
            });

            return {
                success: true,
                action: 'added',
                message: 'Novel added to favorites',
                isFavorited: true,
                favorite: newFavorite
            };
        }
    } catch (error) {
        if (error.code === 11000) {
            // Duplicate key error - already favorited
            return {
                success: false,
                message: 'Novel already in favorites',
                isFavorited: true
            };
        }
        throw error;
    }
};

// Static method to check if user has favorited a novel
favoriteSchema.statics.isFavorited = async function (userId, novelId) {
    const favorite = await this.findOne({
        user: userId,
        novel: novelId
    });
    return !!favorite;
};

// Static method to get user's favorite novels
favoriteSchema.statics.getUserFavorites = async function (userId, limit = 20) {
    return await this.find({ user: userId })
        .populate({
            path: 'novel',
            populate: {
                path: 'author',
                select: 'username profilePicture'
            }
        })
        .sort({ createdAt: -1 })
        .limit(limit);
};

// Static method to get novel's total likes count
favoriteSchema.statics.getNovelLikesCount = async function (novelId) {
    return await this.countDocuments({ novel: novelId });
};

// Static method to get most liked novels
favoriteSchema.statics.getMostLikedNovels = async function (limit = 10, timeframe = null) {
    const matchCondition = {};

    if (timeframe) {
        const timeAgo = new Date(Date.now() - timeframe);
        matchCondition.createdAt = { $gte: timeAgo };
    }

    return await this.aggregate([
        { $match: matchCondition },
        {
            $group: {
                _id: '$novel',
                likesCount: { $sum: 1 },
                latestLike: { $max: '$createdAt' }
            }
        },
        { $sort: { likesCount: -1, latestLike: -1 } },
        { $limit: limit },
        {
            $lookup: {
                from: 'novels',
                localField: '_id',
                foreignField: '_id',
                as: 'novel'
            }
        },
        { $unwind: '$novel' },
        {
            $lookup: {
                from: 'users',
                localField: 'novel.author',
                foreignField: '_id',
                as: 'author'
            }
        },
        { $unwind: '$author' },
        {
            $project: {
                novel: {
                    _id: '$novel._id',
                    title: '$novel.title',
                    coverImage: '$novel.coverImage',
                    description: '$novel.description',
                    totalLikes: '$novel.totalLikes',
                    author: {
                        _id: '$author._id',
                        username: '$author.username',
                        profilePicture: '$author.profilePicture'
                    }
                },
                likesCount: 1,
                latestLike: 1
            }
        }
    ]);
};

const Favorite = mongoose.model('Favorite', favoriteSchema);

module.exports = Favorite;