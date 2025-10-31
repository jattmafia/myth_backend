const mongoose = require('mongoose');

const ChapterAccessSchema = new mongoose.Schema({
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
  // 'free' (for chapters 1-5 in paid novels or all chapters in free novels)
  // 'purchased' (for chapters 6+ in paid novels)
  accessType: {
    type: String,
    enum: ['free', 'purchased'],
    default: 'free'
  },
  accessedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Unique index on user + chapter to prevent duplicate access records
ChapterAccessSchema.index({ user: 1, chapter: 1 }, { unique: true });

// Index for finding user's access to novel chapters
ChapterAccessSchema.index({ user: 1, novel: 1 });

module.exports = mongoose.model('ChapterAccess', ChapterAccessSchema);
