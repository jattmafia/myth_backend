const mongoose = require('mongoose');

const CoinTransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['earned', 'spent'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 1
    },
    reason: {
        type: String,
        required: true
        // e.g., "Watched ad", "Chapter purchase", etc.
    },
    description: {
        type: String,
        required: false
    },
    balanceAfter: {
        type: Number,
        required: true,
        min: 0
    },
    relatedItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Novel',
        required: false
        // For storing chapter or novel reference
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for fast querying of user's transactions
CoinTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('CoinTransaction', CoinTransactionSchema);
