const mongoose = require('mongoose');

const ReadingProgressSchema = new mongoose.Schema({
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
    // Scroll position in pixels or percentage
    scrollPosition: {
        type: Number,
        default: 0
    },
    // Reading progress percentage (0-100)
    progressPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    // Total content height/length (for calculating percentage)
    totalContentHeight: {
        type: Number,
        default: 0
    },
    // Last read timestamp
    lastReadAt: {
        type: Date,
        default: Date.now
    },
    // Is chapter completed
    isCompleted: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index to ensure one progress record per user per chapter
ReadingProgressSchema.index({ user: 1, chapter: 1 }, { unique: true });

// Index for querying user's progress
ReadingProgressSchema.index({ user: 1, novel: 1 });

module.exports = mongoose.model('ReadingProgress', ReadingProgressSchema);
