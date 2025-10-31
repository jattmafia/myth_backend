const mongoose = require('mongoose');

const AdUnlockLogSchema = new mongoose.Schema({
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
  chapter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chapter',
    required: false
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

// Index for checking daily ad unlock limits (user + novel + date)
AdUnlockLogSchema.index({ user: 1, novel: 1, unlockedAt: 1 });

// Index for finding user's ad unlocks
AdUnlockLogSchema.index({ user: 1, chapter: 1 });

module.exports = mongoose.model('AdUnlockLog', AdUnlockLogSchema);
