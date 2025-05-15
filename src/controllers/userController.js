const AWS = require('aws-sdk');
const User = require('../models/user'); // Import the User model

// Configure AWS SDK for Cloudflare R2
const s3 = new AWS.S3({
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT, // Example: https://<account_id>.r2.cloudflarestorage.com
  accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, // User API Access Key
  secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY, // User API Secret Key
  region: 'auto', // Cloudflare R2 does not require a specific region
});

exports.createProfile = async (req, res) => {
  const { fullName, dob, gender, country, contentLanguage, username, bio } = req.body;
  const profilePicture = req.file; // Assuming you're using multer for file uploads

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

      // Upload the profile picture to Cloudflare R2
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
      user.username = username;
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