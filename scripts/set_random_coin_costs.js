// One-off script to set a random coinCost (5-20) for chapters > 7 for a given novel
// Usage: set env MONGO_URI and run `node scripts/set_random_coin_costs.js`

const mongoose = require('mongoose');
require('dotenv').config();
const Chapter = require('../src/models/chapter');

const NOVEL_ID = '68d41010a23c946d22f79bde'; // target novel id
const MIN_COST = 5;
const MAX_COST = 20;

async function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/myth_backend';
    console.log('Connecting to', mongoUri);
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        const novelId = new mongoose.Types.ObjectId(NOVEL_ID);
        const chapters = await Chapter.find({ novel: novelId, chapterNumber: { $gt: 7 } }).sort({ chapterNumber: 1 });
        console.log(`Found ${chapters.length} chapters for novel ${NOVEL_ID} with chapterNumber > 7`);

        let updated = 0;
        for (const ch of chapters) {
            const cost = await randomInt(MIN_COST, MAX_COST);
            ch.coinCost = cost;
            await ch.save();
            updated++;
            console.log(`Updated chapter ${ch._id} (chapterNumber ${ch.chapterNumber}) -> coinCost ${cost}`);
        }

        console.log(`Done. Updated ${updated} chapters.`);
    } catch (err) {
        console.error('Script error:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

main();
