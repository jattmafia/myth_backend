require('dotenv').config();
const mongoose = require('mongoose');
const WriterEarning = require('./src/models/writerEarning');
const Novel = require('./src/models/novel');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const novel = await Novel.findOne({ title: 'Padosan No. 13' });
    if (!novel) {
        console.log('Novel not found');
        process.exit(1);
    }
    const earnings = await WriterEarning.find({
        novel: novel._id,
        earningType: 'coin'
    }).populate('chapter', 'chapterNumber title');

    console.log('Current WriterEarning records for Padosan No. 13:');
    console.log(JSON.stringify(earnings, null, 2));
    process.exit(0);
});
