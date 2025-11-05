require('dotenv').config();
const mongoose = require('mongoose');
const Novel = require('../src/models/novel');

const CLOUDFLARE_R2_DOMAIN = 'https://images.58251756f70bfc5e501f25495dacf5f0.r2.cloudflarestorage.com/';

const removeR2Domain = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected');

        // Find all novels with coverImage containing the R2 domain
        const novels = await Novel.find({
            coverImage: { $regex: CLOUDFLARE_R2_DOMAIN }
        });

        console.log(`📚 Found ${novels.length} novels with R2 domain in coverImage`);

        if (novels.length === 0) {
            console.log('No novels to update');
            await mongoose.connection.close();
            return;
        }

        let updatedCount = 0;

        // Update each novel
        for (const novel of novels) {
            const oldCoverImage = novel.coverImage;
            // Remove the domain prefix from the cover image URL
            const newCoverImage = oldCoverImage.replace(CLOUDFLARE_R2_DOMAIN, '');

            if (oldCoverImage !== newCoverImage) {
                novel.coverImage = newCoverImage;
                await novel.save();
                updatedCount++;

                console.log(`✏️  Updated novel "${novel.title}"`);
                console.log(`   Old: ${oldCoverImage}`);
                console.log(`   New: ${newCoverImage}`);
            }
        }

        console.log(`\n✅ Successfully updated ${updatedCount} novels`);
        console.log(`⏭️  Skipped ${novels.length - updatedCount} novels (already updated or no change)`);

        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        await mongoose.connection.close();
        process.exit(1);
    }
};

removeR2Domain();
