const mongoose = require('mongoose');

const SubscriptionPaymentSchema = new mongoose.Schema({
    writer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    subscription: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WriterSubscription',
        required: true,
    },
    plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubscriptionPlan',
        required: true,
    },
    // Amount in smallest currency unit (paisa/cents)
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        default: 'INR',
    },
    // Payment status
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
        default: 'pending',
    },
    // Payment method
    paymentMethod: {
        type: String,
        enum: ['razorpay', 'revenucat', 'app_store', 'play_store', 'credit_card', 'debit_card', 'wallet'],
        required: true,
    },
    // Transaction ID from payment provider
    transactionId: {
        type: String,
        required: true,
        unique: true,
    },
    // Order ID (for tracking)
    orderId: {
        type: String,
        default: null,
    },
    // Payment gateway response
    gatewayResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    // Reason for failure (if failed)
    failureReason: {
        type: String,
        default: null,
    },
    // Refund details (if refunded)
    refundDetails: {
        refundId: String,
        refundedAmount: Number,
        refundReason: String,
        refundedAt: Date,
    },
    // Receipt/Invoice URL
    receiptUrl: {
        type: String,
        default: null,
    },
    // Subscription start date (for this payment)
    subscriptionStartDate: {
        type: Date,
        required: true,
    },
    // Subscription end date (for this payment)
    subscriptionEndDate: {
        type: Date,
        required: true,
    },
    // When payment was attempted
    paymentAttemptedAt: {
        type: Date,
        default: Date.now,
    },
    // When payment was completed
    paymentCompletedAt: {
        type: Date,
        default: null,
    },
    // Metadata for storing extra information
    metadata: {
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

// Index for finding payments by writer
SubscriptionPaymentSchema.index({ writer: 1 });

// Index for finding payments by transaction ID
SubscriptionPaymentSchema.index({ transactionId: 1 });

// Index for finding payments by status
SubscriptionPaymentSchema.index({ status: 1, paymentMethod: 1 });

// Index for finding payments by subscription
SubscriptionPaymentSchema.index({ subscription: 1 });

module.exports = mongoose.model('SubscriptionPayment', SubscriptionPaymentSchema);
