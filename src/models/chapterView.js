const mongoose = require('mongoose');

const chapterViewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    chapter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
        required: true
    },
    novel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Novel',
        required: true
    },
    viewedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index to ensure uniqueness per user per chapter
chapterViewSchema.index({ user: 1, chapter: 1 });

// Index for cleanup and queries
chapterViewSchema.index({ chapter: 1, viewedAt: -1 });
chapterViewSchema.index({ novel: 1, viewedAt: -1 });
chapterViewSchema.index({ viewedAt: 1 });

// Static method to check if user can view chapter (24-hour limit)
chapterViewSchema.statics.canUserViewChapter = async function (userId, chapterId) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const existingView = await this.findOne({
        user: userId,
        chapter: chapterId,
        viewedAt: { $gte: twentyFourHoursAgo }
    });

    return !existingView;
};

// Static method to record a chapter view and update novel total
chapterViewSchema.statics.recordChapterView = async function (userId, chapterId, novelId) {
    const canView = await this.canUserViewChapter(userId, chapterId);

    if (!canView) {
        return {
            success: false,
            message: 'Chapter view already recorded within 24 hours',
            alreadyViewed: true
        };
    }

    // Create new chapter view
    const newView = new this({
        user: userId,
        chapter: chapterId,
        novel: novelId
    });

    await newView.save();

    // Update chapter view count
    const Chapter = require('./chapter');
    await Chapter.findByIdAndUpdate(chapterId, {
        $inc: { viewCount: 1 }
    });

    // Update novel total view count
    const Novel = require('./novel');
    await Novel.findByIdAndUpdate(novelId, {
        $inc: { totalViews: 1 }
    });

    return {
        success: true,
        view: newView,
        alreadyViewed: false
    };
};

// Static method to get chapter view count
chapterViewSchema.statics.getChapterViewCount = async function (chapterId, timeframe = null) {
    const query = { chapter: chapterId };

    if (timeframe) {
        const timeAgo = new Date(Date.now() - timeframe);
        query.viewedAt = { $gte: timeAgo };
    }

    return await this.countDocuments(query);
};

// Static method to get novel total view count (sum of all chapter views)
chapterViewSchema.statics.getNovelViewCount = async function (novelId, timeframe = null) {
    const query = { novel: novelId };

    if (timeframe) {
        const timeAgo = new Date(Date.now() - timeframe);
        query.viewedAt = { $gte: timeAgo };
    }

    return await this.countDocuments(query);
};

// Static method to get user's recently viewed chapters
chapterViewSchema.statics.getUserRecentlyViewedChapters = async function (userId, limit = 10) {
    return await this.find({ user: userId })
        .populate('chapter', 'title chapterNumber')
        .populate('novel', 'title coverImage author')
        .sort({ viewedAt: -1 })
        .limit(limit);
};

const ChapterView = mongoose.model('ChapterView', chapterViewSchema);

module.exports = ChapterView;