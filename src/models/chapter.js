const mongoose = require('mongoose');

const ChapterSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  coverImage: {
    type: String,
    required: false
  },
  content: {
    type: String,
    required: false
  },
  authorMessage:{
    type: String,
    required: false
  },
  novel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Novel',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  chapterNumber: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft'
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

module.exports = mongoose.model('Chapter', ChapterSchema);