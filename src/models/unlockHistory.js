const mongoose = require('mongoose');

const UnlockHistorySchema = new mongoose.Schema({
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
    // 'free' (chapters 1-5), 'coin', 'ad'
    unlockMethod: {
        type: String,
        enum: ['free', 'coin', 'ad'],
        required: true
    },
    // Amount spent (for coin unlocks)
    coinsSpent: {
        type: Number,
        default: 0
    },
    unlockedAt: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for finding user's unlock history
UnlockHistorySchema.index({ user: 1, novel: 1 });
UnlockHistorySchema.index({ user: 1, chapter: 1 });
UnlockHistorySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('UnlockHistory', UnlockHistorySchema);
