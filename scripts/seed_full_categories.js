require('dotenv').config();
const mongoose = require('mongoose');

const Category = require('../src/models/category');

const MONGO = process.env.MONGO_URI || process.env.MONGO || 'mongodb://localhost:27017/myth_backend';

const data = [
    { parent: 'Romance', subs: ['Office Romance', 'Contract Marriage', 'Enemies to Lovers', 'Campus Romance'] },
    { parent: 'Thriller & Mystery', subs: ['Psychological Thriller', 'Crime & Mafia', 'Paranormal Mystery', 'Survival Thriller'] },
    { parent: 'Fantasy & Adventure', subs: ['Isekai (Other World)', 'Magical Academy', 'Royalty & Kingdoms', 'Dungeon & RPG'] },
    { parent: 'Horror & Supernatural', subs: ['Haunted House', 'Paranormal Investigation', 'Dark Fantasy Horror', 'Psychological Horror'] },
    { parent: 'Sci-Fi & Time Travel', subs: ['Time Travel', 'AI & Cyberpunk', 'Space Opera', 'Dystopian Future'] },
    { parent: 'Revenge & Drama', subs: ['CEO Revenge', 'Family Drama', 'Betrayal & Payback', 'Mafia & Power Play'] },
    { parent: 'Comedy & Slice of Life', subs: ['Romantic Comedy', 'High School Comedy', 'Workplace Humor', 'Daily Life & Family'] },
    { parent: 'Historical & Mythology', subs: ['Indian Mythology', 'Historical Romance', 'Kingdoms & Politics', 'War & Conquest'] },
    { parent: 'Action & Martial Arts', subs: ['Cultivation & Xianxia', 'Martial Arts Academy', 'Hero\'s Journey', 'Underground Fights'] },
    { parent: 'Billionaire & CEO Romance', subs: ['Secret Identity', 'Arranged Marriage', 'Power Struggle', 'Love & Betrayal'] },
    { parent: 'Werewolf & Vampire', subs: ['Alpha & Luna Romance', 'Forbidden Love', 'Vampire Clans', 'Shapeshifter Conflict'] },
    { parent: 'LGBTQ+ & Diverse Stories', subs: ['Coming Out Stories', 'BL/GL (Boys Love & Girls Love)', 'Trans & Non-Binary Stories', 'Queer Fantasy & Sci-Fi'] },
    { parent: 'Korean Drama', subs: ['Idol × Fan Romance', 'Mafia Idol', 'Time Travel Romance', 'Secret Contract Love', 'Enemies to Lovers', 'Reincarnation Romance', 'Royal Palace Love', 'Bodyguard × Idol', 'BL Idol Romance', 'K-pop Supernatural Fantasy'] }
];

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function upsertCategories() {
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const created = [];

    for (const group of data) {
        const parentName = group.parent;
        const parentSlug = slugify(parentName);
        const parent = await Category.findOneAndUpdate(
            { name: parentName },
            { $set: { name: parentName, slug: parentSlug } },
            { upsert: true, new: true }
        );
        console.log(`Upserted parent: ${parentName} (${parent._id})`);

        for (const sub of group.subs) {
            const subName = sub;
            const subSlug = slugify(subName);
            const doc = await Category.findOneAndUpdate(
                { name: subName },
                { $set: { name: subName, slug: subSlug, parent: parent._id } },
                { upsert: true, new: true }
            );
            console.log(`  Upserted sub: ${subName} -> parent ${parentName}`);
            created.push(doc);
        }
    }

    console.log(`Done. Created/updated ${created.length} subcategories.`);
    await mongoose.disconnect();
}

upsertCategories().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
