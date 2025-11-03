const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    slug: {
        type: String,
        required: true,
        unique: true
    },
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for fast lookup
CategorySchema.index({ name: 1 });

module.exports = mongoose.model('Category', CategorySchema);
