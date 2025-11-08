const mongoose = require('mongoose');

const WriterSubscriptionSchema = new mongoose.Schema({
    writer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    // Current active plan
    currentPlan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubscriptionPlan',
        required: true,
    },
    // Subscription status
    status: {
        type: String,
        enum: ['active', 'expired', 'cancelled', 'pending', 'paused'],
        default: 'active',
    },
    // When the current subscription started
    startDate: {
        type: Date,
        default: Date.now,
    },
    // When the current subscription expires
    expiryDate: {
        type: Date,
        required: true,
    },
    // Whether this is a trial/free subscription
    isFreeTrial: {
        type: Boolean,
        default: false,
    },
    // Previous plan (for tracking plan changes)
    previousPlan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubscriptionPlan',
        default: null,
    },
    // Auto-renewal flag (for paid subscriptions)
    autoRenew: {
        type: Boolean,
        default: true,
    },
    // Last payment transaction ID (for verification with payment provider)
    lastPaymentTransactionId: {
        type: String,
        default: null,
    },
    // Payment provider (e.g., 'razorpay', 'revenucat', 'app_store', 'play_store')
    paymentProvider: {
        type: String,
        default: 'razorpay',
    },
    // Number of times user used free trial
    freeTrialUsageCount: {
        type: Number,
        default: 0,
    },
    // Cancellation reason (if cancelled)
    cancellationReason: {
        type: String,
        default: null,
    },
    // When subscription was cancelled
    cancelledAt: {
        type: Date,
        default: null,
    },
    // Usage statistics for the current period
    usageStats: {
        novelsCreated: {
            type: Number,
            default: 0,
        },
        chaptersPublished: {
            type: Number,
            default: 0,
        },
        totalWords: {
            type: Number,
            default: 0,
        }
    },
    // Metadata for storing provider-specific data
    providerMetadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});

// Index for finding subscriptions by writer
WriterSubscriptionSchema.index({ writer: 1 });

// Index for finding expiring subscriptions
WriterSubscriptionSchema.index({ expiryDate: 1 });

// Index for finding active subscriptions
WriterSubscriptionSchema.index({ status: 1, expiryDate: 1 });

module.exports = mongoose.model('WriterSubscription', WriterSubscriptionSchema);
