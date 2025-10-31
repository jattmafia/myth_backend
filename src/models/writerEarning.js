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
