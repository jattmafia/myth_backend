const mongoose = require('mongoose');
const chapter = require('./chapter');

const NovelSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  chapters: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chapter'
  }],
  language: {
    type: String,
    required: true,
  },
  coverImage: {
    type: String,
    required: true
  },
  hookupDescription: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  // Categories/genres for the novel (e.g. romance, mystery)
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  // Subcategories (child categories) stored separately for explicit mapping
  subcategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'ongoing'],
    default: 'draft'
  },
  totalViews: {
    type: Number,
    default: 0
  },
  totalLikes: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  // Novel pricing model: 'free' or 'paid'
  pricingModel: {
    type: String,
    enum: ['free', 'paid'],
    default: 'free'
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

// Text index for search (title highest weight, hookupDescription medium, description low)
NovelSchema.index({ title: 'text', hookupDescription: 'text', description: 'text' }, { weights: { title: 10, hookupDescription: 5, description: 1 } });

module.exports = mongoose.model('Novel', NovelSchema);