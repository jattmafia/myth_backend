const AWS = require('aws-sdk');
const bcrypt = require('bcrypt');
const User = require('../models/user'); // Import the User model
const Review = require('../models/review');
const Favorite = require('../models/favorite');
const ReadingProgress = require('../models/readingProgress');

// Configure AWS SDK for Cloudflare R2
const s3 = new AWS.S3({
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT, // Example: https://<account_id>.r2.cloudflarestorage.com
  accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, // User API Access Key
  secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY, // User API Secret Key
  region: 'auto', // Cloudflare R2 does not require a specific region
});

exports.createProfile = async (req, res) => {
  const { fullName, dob, gender, country, contentLanguage, username, bio } = req.body;
  const profilePicture = req.file;  // Assuming you're using multer for file uploads

  //   if (!name || !age || !bio || !profilePicture) {
  //     return res.status(400).json({ message: 'All fields, including profile picture, are required' });
  //   }

  try {
    // Find the user by ID
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userExists = await User.findOne({ $or: [{ username }] });
    if (userExists && userExists._id.toString() !== req.user.id) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    if (profilePicture) {



      // Upload the new profile picture to Cloudflare R2
      const uploadParams = {
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME, // Your R2 bucket name
        Key: `profile-pictures/${Date.now()}-${profilePicture.originalname}`, // Unique file name
        Body: profilePicture.buffer, // File buffer
        ContentType: profilePicture.mimetype, // File MIME type
        ACL: 'public-read',
      };

      const uploadResult = await s3.upload(uploadParams).promise();



      console.log('File uploaded successfully:', uploadResult);

      user.profilePicture = uploadResult.Key; // Store the file URL in the user model
      user.fullName = fullName;
      user.dob = dob;
      user.gender = gender;
      user.country = country;
      user.contentLanguage = contentLanguage;
      //username to lowercase
      user.username = username.toLowerCase();
      user.bio = bio;


      await user.save();

      res.status(200).json({ message: 'Profile created successfully' });
    } else {
      user.fullName = fullName;
      user.dob = dob;
      user.gender = gender;
      user.country = country;
      user.contentLanguage = contentLanguage;
      user.username = username;
      user.bio = bio;
      await user.save();
      res.status(200).json({ message: 'Profile created successfully', user });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('-password -followers -following');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Transform user object to include follow counts
    const userObj = user.toObject();

    // Get the full user document to get array lengths
    const fullUser = await User.findById(userId);
    userObj.followersCount = fullUser.followers.length;
    userObj.followingCount = fullUser.following.length;

    res.status(200).json({
      success: true,
      data: userObj
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get user statistics
exports.getUserStatistics = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user statistics in parallel for better performance
    const [totalReviews, totalFavorites, totalNovelsRead] = await Promise.all([
      // Count total reviews by user
      Review.countDocuments({ user: userId }),

      // Count total favorites
      Favorite.countDocuments({ user: userId }),

      // Get completed novels count
      ReadingProgress.find({ user: userId, isCompleted: true }).distinct('chapter').then(async (completedChapterIds) => {
        if (completedChapterIds.length === 0) return 0;

        // Get unique novels from completed chapters
        const Chapter = require('../models/chapter');
        const chapters = await Chapter.find({ _id: { $in: completedChapterIds } }).distinct('novel');
        return chapters.length;
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalReviews,
        totalFavorites,
        totalNovelsRead
      }
    });
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, dob, gender, country, contentLanguage, username, bio } = req.body;
    const profilePicture = req.file;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser && existingUser._id.toString() !== userId) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }
    }

    // Handle profile picture upload if provided
    if (profilePicture) {
      const uploadParams = {
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: `profile-pictures/${Date.now()}-${profilePicture.originalname}`,
        Body: profilePicture.buffer,
        ContentType: profilePicture.mimetype,
        ACL: 'public-read',
      };

      const uploadResult = await s3.upload(uploadParams).promise();
      console.log('File uploaded successfully:', uploadResult);
      // Delete old profile picture if exists
      if (user.profilePicture) {
        try {
          const deleteParams = {
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
            Key: user.profilePicture,
          };
          await s3.deleteObject(deleteParams).promise();
          console.log('Old profile picture deleted:', user.profilePicture);
        } catch (deleteError) {
          console.error('Error deleting old profile picture:', deleteError);
          // Continue with upload even if delete fails
        }
      }
      user.profilePicture = uploadResult.Key;
    }

    // Update other fields if provided
    if (fullName !== undefined) user.fullName = fullName;
    if (dob !== undefined) user.dob = dob;
    if (gender !== undefined) user.gender = gender;
    if (country !== undefined) user.country = country;
    if (contentLanguage !== undefined) user.contentLanguage = contentLanguage;
    if (username !== undefined) user.username = username;
    if (bio !== undefined) user.bio = bio;

    await user.save();

    // Return updated user without password
    const updatedUser = await User.findById(userId).select('-password');



    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Change user password
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password, new password, and confirm password are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Find user with password
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user signed up with Google/OAuth (no password set)
    if (!user.password || user.loginType === 'google') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change password for accounts created with Google Sign-In. Please use Google to manage your account.'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password (let pre-save hook handle hashing)
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
// Follow a user
exports.followUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const targetUserId = req.params.id;

    if (userId === targetUserId) {
      return res.status(400).json({ success: false, message: "You can't follow yourself." });
    }

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Prevent duplicate follows
    if (user.following.includes(targetUserId)) {
      return res.status(400).json({ success: false, message: "Already following this user." });
    }

    user.following.push(targetUserId);
    targetUser.followers.push(userId);

    await user.save();
    await targetUser.save();

    res.status(200).json({ success: true, message: "User followed successfully." });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// Unfollow a user
exports.unfollowUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const targetUserId = req.params.id;

    if (userId === targetUserId) {
      return res.status(400).json({ success: false, message: "You can't unfollow yourself." });
    }

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Prevent unfollow if not following
    if (!user.following.includes(targetUserId)) {
      return res.status(400).json({ success: false, message: "You are not following this user." });
    }

    user.following = user.following.filter(id => id.toString() !== targetUserId);
    targetUser.followers = targetUser.followers.filter(id => id.toString() !== userId);

    await user.save();
    await targetUser.save();

    res.status(200).json({ success: true, message: "User unfollowed successfully." });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// Get followers list for a user (or current user if no id provided)
exports.getFollowers = async (req, res) => {
  try {
    const requestedUserId = req.params.id || req.user.id;
    const limit = parseInt(req.query.limit, 10) || 100;
    const skip = parseInt(req.query.skip, 10) || 0;

    const user = await User.findById(requestedUserId).select('followers');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const followerIds = user.followers.slice(skip, skip + limit);

    const followers = await User.find({ _id: { $in: followerIds } }).select('_id username profilePicture');

    // Preserve order as in followerIds
    const followersMap = {};
    followers.forEach(f => { followersMap[f._id.toString()] = f; });
    const ordered = followerIds.map(id => followersMap[id.toString()]).filter(Boolean);

    res.status(200).json({ success: true, count: ordered.length, data: ordered });
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// Get following list for a user (or current user if no id provided)
exports.getFollowing = async (req, res) => {
  try {
    const requestedUserId = req.params.id || req.user.id;
    const limit = parseInt(req.query.limit, 10) || 100;
    const skip = parseInt(req.query.skip, 10) || 0;

    const user = await User.findById(requestedUserId).select('following');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const followingIds = user.following.slice(skip, skip + limit);

    const following = await User.find({ _id: { $in: followingIds } }).select('_id username profilePicture');

    const followingMap = {};
    following.forEach(f => { followingMap[f._id.toString()] = f; });
    const ordered = followingIds.map(id => followingMap[id.toString()]).filter(Boolean);

    res.status(200).json({ success: true, count: ordered.length, data: ordered });
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// Reward user with coins for watching an ad
exports.rewardAdCoins = async (req, res) => {
  try {
    const userId = req.user.id;
    const { coinsEarned = 4 } = req.body; // Default 10 coins per ad, can be customized

    // Validate coins amount
    if (coinsEarned <= 0 || coinsEarned > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Coins must be between 1 and 1000'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add coins to user
    user.coins += coinsEarned;
    await user.save();

    // Log transaction
    const CoinTransaction = require('../models/coinTransaction');
    await CoinTransaction.create({
      user: userId,
      type: 'earned',
      amount: coinsEarned,
      reason: 'Watched ad',
      balanceAfter: user.coins
    });

    res.status(200).json({
      success: true,
      message: `Earned ${coinsEarned} coins`,
      data: {
        coinsEarned,
        totalCoins: user.coins
      }
    });
  } catch (error) {
    console.error('Error rewarding ad coins:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get user's coin balance
exports.getUserCoins = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('coins');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        coins: user.coins
      }
    });
  } catch (error) {
    console.error('Error fetching user coins:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Deduct coins for purchasing novel content (internal use)
exports.deductCoins = async (req, res) => {
  try {
    const userId = req.user.id;
    const { coinsToDeduce, description } = req.body;

    if (!coinsToDeduce || coinsToDeduce <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid coins amount is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.coins < coinsToDeduce) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient coins',
        currentCoins: user.coins,
        requiredCoins: coinsToDeduce
      });
    }

    // Deduct coins
    user.coins -= coinsToDeduce;
    await user.save();

    // Log transaction
    const CoinTransaction = require('../models/coinTransaction');
    await CoinTransaction.create({
      user: userId,
      type: 'spent',
      amount: coinsToDeduce,
      reason: description || 'Novel purchase',
      description,
      balanceAfter: user.coins
    });

    res.status(200).json({
      success: true,
      message: `Spent ${coinsToDeduce} coins${description ? ` for ${description}` : ''}`,
      data: {
        coinsDeduce: coinsToDeduce,
        remainingCoins: user.coins
      }
    });
  } catch (error) {
    console.error('Error deducting coins:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get coin transaction history for user
exports.getCoinTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit, 10) || 50;
    const page = parseInt(req.query.page, 10) || 1;
    const skip = (page - 1) * limit;

    const CoinTransaction = require('../models/coinTransaction');

    // Get total count
    const totalTransactions = await CoinTransaction.countDocuments({ user: userId });

    // Get paginated transactions
    const transactions = await CoinTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalTransactions / limit),
          totalTransactions,
          limit
        }
      }
    });
  } catch (error) {
    console.error('Error fetching coin transaction history:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
