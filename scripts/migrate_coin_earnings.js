require('dotenv').config();
const mongoose = require('mongoose');
const WriterEarning = require('./src/models/writerEarning');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    try {
        // Find all coin earnings and fix them based on coinsRequiredToUnlock
        const coinsPerRupee = parseFloat(process.env.COINS_PER_RUPEE) || 2;

        const earnings = await WriterEarning.find({ earningType: 'coin' });

        console.log(`Found ${earnings.length} coin earning records to migrate\n`);

        let fixed = 0;
        let skipped = 0;

        for (const earning of earnings) {
            if (!earning.coinsRequiredToUnlock) {
                console.log(`Skipping record ${earning._id} - no coinsRequiredToUnlock`);
                skipped++;
                continue;
            }

            // Recalculate values
            const coinsSpent = earning.coinsRequiredToUnlock;
            const correctCoinPrice = coinsSpent / coinsPerRupee;  // e.g., 4 coins / 2 = 2 rupees
            const writerPercentage = earning.writerPercentageEarned || 90;
            const correctCoinPricePaise = Math.round(correctCoinPrice * 100);
            const correctWriterEarningPaise = Math.round(correctCoinPricePaise * (writerPercentage / 100));
            const correctTotalAmountPaise = correctWriterEarningPaise * (earning.count || 1);

            // Update if values are wrong
            if (earning.coinPrice !== correctCoinPrice || earning.amount !== correctTotalAmountPaise) {
                await WriterEarning.findByIdAndUpdate(earning._id, {
                    $set: {
                        coinPrice: correctCoinPrice,
                        amount: correctTotalAmountPaise
                    }
                });

                console.log(`✅ Fixed record for Chapter ${earning.chapterNumber}:`);
                console.log(`   coinPrice: ${earning.coinPrice} → ${correctCoinPrice}`);
                console.log(`   amount: ${earning.amount} → ${correctTotalAmountPaise} paise (₹${(correctTotalAmountPaise / 100).toFixed(2)})\n`);
                fixed++;
            } else {
                skipped++;
            }
        }

        console.log(`\n📊 Migration complete:`);
        console.log(`   Fixed: ${fixed} records`);
        console.log(`   Already correct: ${skipped} records`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
});
