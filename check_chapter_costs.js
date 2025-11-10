require('dotenv').config();
const mongoose = require('mongoose');
const Chapter = require('./src/models/chapter');
const Novel = require('./src/models/novel');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const novel = await Novel.findOne({ title: 'Padosan No. 13' });
    if (!novel) {
        console.log('Novel not found');
        process.exit(1);
    }
    const chs = await Chapter.find({ novel: novel._id, chapterNumber: { $gte: 6, $lte: 10 } }).select('chapterNumber coinCost title');
    console.log('Padosan No. 13 - Chapters 6-10 coin costs:');
    chs.forEach(ch => {
        console.log(`Chapter ${ch.chapterNumber}: coinCost=${ch.coinCost || 'undefined (uses default 4)'}`);
    });
    process.exit(0);
});
