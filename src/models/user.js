const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For hashing passwords

// Create a schema for the user
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    trim: true,
  },
  profilePicture: {
    type: String,
    required: false,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  phoneNumber: {
    type: String,
    sparse: true
    // unique: true,
  },
  password: {
    type: String,
  },
  // Confirm password will not be saved, just for validation during signup
  confirmPassword: {
    type: String,
  },
  loginType: {
    type: String,
    enum: ['email', 'google'],
    default: 'email',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  deviceName: {
    type: String,
    sparse: true
  },
  deviceId: {
    type: String,
    sparse: true
  },
  fullName: {
    type: String,
    required: false,
  },
  dob: {
    type: Date,
    required: false,
  },
  gender: {
    type: String,
    required: false,
  },
  country: {
    type: String,
    required: false,
  },
  contentLanguage: {
    type: Array,
    required: false,
  },
  bio: {
    type: String,
    required: false,
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }],
  coins: {
    type: Number,
    default: 0,
    min: 0
  },
  // Writer subscription reference
  writerSubscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WriterSubscription',
    default: null,
  },
  // Total earnings from writing (in paisa/cents)
  totalEarnings: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Preferred payment method for earnings
  preferredPaymentMethod: {
    type: String,
    enum: ['bank_transfer', 'wallet', 'upi'],
    default: null,
  },
  // Bank account details for earnings (encrypted in production)
  bankDetails: {
    accountNumber: String,
    accountHolderName: String,
    ifscCode: String,
    bankName: String,
  },
  // Last earnings withdrawal date
  lastEarningsWithdrawalDate: {
    type: Date,
    default: null,
  },

});

// Text index for user search (username higher weight)
UserSchema.index({ username: 'text', fullName: 'text' }, { weights: { username: 10, fullName: 5 } });

// Password hashing before saving to DB
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next(); // Skip if password wasn't modified
  }

  try {
    // Hash the password with salt
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.confirmPassword = undefined; // Remove confirmPassword from model
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password during login
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', UserSchema);

module.exports = User;
