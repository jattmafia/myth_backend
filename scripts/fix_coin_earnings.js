require('dotenv').config();

const mongoose = require('mongoose');
const WriterEarning = require('../src/models/writerEarning');
const Novel = require('../src/models/novel');
const Chapter = require('../src/models/chapter');

async function fixCoinEarnings() {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/myth_backend';
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
        console.log('✅ Connected to MongoDB');

        // Find all coin earnings with suspicious coinPrice values (> 100, indicating paise stored as rupees)
        const suspiciousRecords = await WriterEarning.find({
            earningType: 'coin',
            coinPrice: { $gt: 100 }  // coinPrice should be decimal (e.g., 1.5, 4, not 150, 400)
        }).populate('novel chapter');

        console.log(`Found ${suspiciousRecords.length} suspicious records with coinPrice > 100:\n`);

        if (suspiciousRecords.length > 0) {
            suspiciousRecords.forEach(record => {
                console.log(`Record ID: ${record._id}`);
                console.log(`  Chapter: ${record.chapter?.chapterNumber} (${record.chapter?.title})`);
                console.log(`  Novel: ${record.novel?.title}`);
                console.log(`  Current coinPrice: ${record.coinPrice} (should be ~${(record.coinPrice / 100).toFixed(2)})`);
                console.log(`  Current amount: ${record.amount} paise = ₹${(record.amount / 100).toFixed(2)}`);
                console.log(`  coinsRequiredToUnlock: ${record.coinsRequiredToUnlock}`);
                console.log('');
            });

            // Option 1: Delete them so they can be regenerated
            const deleteResult = await WriterEarning.deleteMany({
                earningType: 'coin',
                coinPrice: { $gt: 100 }
            });
            console.log(`✅ Deleted ${deleteResult.deletedCount} corrupted records`);
            console.log('These records will be regenerated when users unlock the chapters again.\n');
        } else {
            console.log('✅ No suspicious records found. All coin earnings look correct!');
        }

        // Also show recent coin earnings for verification
        console.log('Recent coin earnings (last 10):\n');
        const recentEarnings = await WriterEarning.find({ earningType: 'coin' })
            .populate('novel chapter')
            .sort({ createdAt: -1 })
            .limit(10);

        recentEarnings.forEach(record => {
            console.log(`Chapter ${record.chapter?.chapterNumber}: coinPrice=${record.coinPrice}, amount=${record.amount} paise (₹${(record.amount / 100).toFixed(2)}), coins=${record.coinsRequiredToUnlock}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

fixCoinEarnings();
