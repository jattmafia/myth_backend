
const AWS = require('aws-sdk');
const Novel = require('../models/novel'); // Import the Novel model
const User = require('../models/user'); // Import the User model

// Configure AWS SDK for Cloudflare R2
const s3 = new AWS.S3({
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT, // Example: https://<account_id>.r2.cloudflarestorage.com
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, // User API Access Key
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY, // User API Secret Key
    region: 'auto', // Cloudflare R2 does not require a specific region
});


exports.createNovel = async (req, res) => {


    try {
        const { title, description, hookupDescription, language } = req.body;
        const coverImage = req.file;
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!title || !description || !coverImage) {
            return res.status(400).json({ message: 'Title, description, and cover image are required' });
        }

        const uploadParams = {
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME, // Your R2 bucket name
            Key: `novel-pictures/${Date.now()}-${coverImage.originalname}`, // Unique file name
            Body: coverImage.buffer, // File buffer
            ContentType: coverImage.mimetype, // File MIME type
            ACL: 'public-read',
        };

        const uploadResult = await s3.upload(uploadParams).promise();

        console.log('File uploaded successfully:', uploadResult);
        const newNovel = new Novel({
            title,
            description,
            coverImage: uploadResult.Key,
            author: req.user.id,
            hookupDescription,
            language
        });

        await newNovel.save();
        res.status(201).json(newNovel);
    } catch (error) {
        console.error('Error creating novel:', error);
        res.status(500).json({ error: error.message });
    }
};


exports.getNovels = async (req, res) => {
    try {
        const novels = await Novel.find().populate('author', 'username');
        res.status(200).json(novels);
    } catch (error) {
        console.error('Error fetching novels:', error);
        res.status(500).json({ error: error.message });
    }
};


//fetch novel by user id
exports.getNovelsByUser = async (req, res) => {
    try {
        const novels = await Novel.find({ author: req.user.id }).populate('author', 'username');
        res.status(200).json(novels);
    } catch (error) {
        console.error('Error fetching novels by user:', error);
        res.status(500).json({ error: error.message });
    }
};