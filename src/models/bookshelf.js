const mongoose = require('mongoose');

const BookshelfSchema = new mongoose.Schema({
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
        min: 0,
        max: 5,
        default: 0
    },
    notes: {
        type: String,
        default: ''
    },
    addedAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index to ensure one bookshelf entry per user per novel
BookshelfSchema.index({ user: 1, novel: 1 }, { unique: true });

module.exports = mongoose.model('Bookshelf', BookshelfSchema);
