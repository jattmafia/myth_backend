const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For hashing passwords

// Create a schema for the user
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    trim: true,
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

});

// Password hashing before saving to DB
UserSchema.pre('save', async function(next) {
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
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', UserSchema);

module.exports = User;
