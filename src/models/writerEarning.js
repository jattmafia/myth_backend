const mongoose = require('mongoose');

const WriterEarningSchema = new mongoose.Schema({
  writer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  novel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Novel',
    required: true
  },
  chapter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chapter'
  },
  // 'coin' (readers unlocking via coins), 'ad' (readers unlocking via ads), 'interstitial' (ads on 1-5)
  earningType: {
    type: String,
    enum: ['coin', 'ad', 'interstitial'],
    required: true
  },
  // Amount earned by writer
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  // For ad earnings: count of ad unlocks, for coin: count of coin unlocks
  count: {
    type: Number,
    default: 1
  },
  // For interstitial: total ad impressions
  impressions: {
    type: Number,
    default: 0
  },

  // SUBSCRIPTION & MONETIZATION TRACKING

  // Whether writer has active subscription at time of earning
  hasSubscription: {
    type: Boolean,
    default: false
  },

  // Subscription ID if applicable
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WriterSubscription',
    required: false
  },

  // Platform fee percentage at time of earning (10% with subscription, 30% without)
  platformFeePercentage: {
    type: Number,
    default: 30, // Default 30% if no subscription
    min: 0,
    max: 100
  },

  // Writer's earning percentage (90% with subscription, 70% without)
  writerPercentageEarned: {
    type: Number,
    default: 70, // Default 70% if no subscription
    min: 0,
    max: 100
  },

  // For chapter 1-5 view requirement (only applicable for non-subscribed writers)
  viewsRequirementMet: {
    type: Boolean,
    default: true // true if subscribed or chapter 6+, false if non-subscribed on chapters 1-5 with < 1k views
  },

  totalViewsOnFreeChapters: {
    type: Number,
    default: 0 // Total views on chapters 1-5 at time of earning
  },

  // For coin unlock: store the coin price for that unlock
  coinPrice: {
    type: Number,
    default: null // Only for earningType: 'coin'
  },

  // For coin unlock: store coins required to unlock
  coinsRequiredToUnlock: {
    type: Number,
    default: null // Coins needed to unlock this chapter (varies by chapter)
  },

  // Chapter number at time of earning (for quick filtering)
  chapterNumber: {
    type: Number,
    default: null
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

// Indexes for quick queries
WriterEarningSchema.index({ writer: 1, novel: 1 });
WriterEarningSchema.index({ writer: 1, earningType: 1 });
WriterEarningSchema.index({ writer: 1, createdAt: -1 });
WriterEarningSchema.index({ novel: 1, earningType: 1 });

module.exports = mongoose.model('WriterEarning', WriterEarningSchema);
