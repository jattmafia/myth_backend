const mongoose = require('mongoose');

const SubscriptionPlanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        enum: ['free', 'basic', 'premium', 'pro'],
    },
    displayName: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    // Duration in days
    durationDays: {
        type: Number,
        required: true,
    },
    // Price in paisa/cents (smallest currency unit)
    price: {
        type: Number,
        required: true,
        min: 0,
    },

    recurringPrice: {
        type: Number,
        required: false,
        min: 0,
    },
    // Razorpay Plan ID for subscription management
    razorpayPlanId: {
        type: String,
        required: false,
    },
    // Razorpay Subscription ID (template)
    razorpaySubscriptionId: {
        type: String,
        required: false,
    },
    // Currency code (USD, INR, etc)
    currency: {
        type: String,
        default: 'INR',
    },
    // Features included in this plan
    features: [{
        name: {
            type: String,
            required: true,
        },
        description: {
            type: String,
        },
        limit: {
            type: Number,
            default: null, // null means unlimited
        }
    }],
    // Limits for the plan

    // Platform fees percentage for this plan (e.g., 30 for 30%)
    platformFeePercentage: {
        type: Number,
        default: 30,
    },
    // Whether this plan can be purchased
    isActive: {
        type: Boolean,
        default: true,
    },
    // Display order in UI
    displayOrder: {
        type: Number,
        default: 0,
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

module.exports = mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);
