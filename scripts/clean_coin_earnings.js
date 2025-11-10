require('dotenv').config();
const mongoose = require('mongoose');
const WriterEarning = require('../src/models/writerEarning');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    try {
        // Delete all coin earnings for Padosan No. 13
        const result = await WriterEarning.deleteMany({
            earningType: 'coin'
        });

        console.log(`✅ Deleted ${result.deletedCount} coin earning records`);
        console.log('These will be regenerated correctly when chapters are unlocked again.');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
});
