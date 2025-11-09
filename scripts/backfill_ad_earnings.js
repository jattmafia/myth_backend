/**
 * Idempotent migration to backfill estimated ad amounts into WriterEarning records
 * Run: node scripts/backfill_ad_earnings.js
 *
 * Behavior:
 * - Finds WriterEarning docs with earningType 'ad', count > 0, and amount missing or zero.
 * - Computes estimatedAmount = count * (DEFAULT_ECPM_RATE/1000) * (writerPercentageEarned/100)
 *   (DEFAULT_ECPM_RATE is read from env, default 40)
 * - Updates the document's `amount` field atomically only if it's still missing/zero (idempotent).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const WriterEarning = require('../src/models/writerEarning');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected');
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        process.exit(1);
    }
};

const run = async () => {
    await connectDB();

    const defaultEcpm = parseFloat(process.env.DEFAULT_ECPM_RATE) || 40;
    const perUnlock = defaultEcpm / 1000;

    const query = {
        earningType: 'ad',
        count: { $gt: 0 },
        $or: [
            { amount: { $exists: false } },
            { amount: 0 }
        ]
    };

    console.log(`Starting backfill: ecpm=${defaultEcpm} -> perUnlock=${perUnlock}`);

    const cursor = WriterEarning.find(query).cursor();
    let processed = 0;
    let updated = 0;

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        processed += 1;
        const writerPct = (typeof doc.writerPercentageEarned === 'number') ? doc.writerPercentageEarned : 70;
        const estimated = Math.round((doc.count || 0) * perUnlock * (writerPct / 100));

        // Idempotent update: only set amount when it's still missing/zero
        const res = await WriterEarning.updateOne(
            { _id: doc._id, $or: [{ amount: { $exists: false } }, { amount: 0 }] },
            { $set: { amount: estimated } }
        );

        if (res.modifiedCount && res.modifiedCount > 0) {
            updated += 1;
            console.log(`Updated ${doc._id}: count=${doc.count} writerPct=${writerPct} -> amount=${estimated}`);
        } else {
            console.log(`Skipped ${doc._id}: already updated by another run or amount non-zero`);
        }
    }

    console.log(`Backfill complete. Processed: ${processed}, Updated: ${updated}`);
    process.exit(0);
};

run().catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
