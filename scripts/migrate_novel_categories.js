require('dotenv').config();
const mongoose = require('mongoose');

const Novel = require('../src/models/novel');
const Category = require('../src/models/category');

const MONGO = process.env.MONGO_URI || process.env.MONGO || 'mongodb://localhost:27017/myth_backend';

function slugify(name) {
    return name.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function migrate() {
    await mongoose.connect(MONGO, { useNewUrlParser: true });
    console.log('Connected to MongoDB for migration');

    const novels = await Novel.find({}).select('categories');
    console.log(`Found ${novels.length} novels`);

    let updatedCount = 0;

    for (const novel of novels) {
        const original = novel.categories || [];
        // If already ObjectId array and first item is ObjectId, skip
        const needsMigration = original.some(item => typeof item === 'string');
        if (!needsMigration) continue;

        const resolved = [];
        for (const item of original) {
            if (!item) continue;
            let cat = null;
            // If it's already an ObjectId-like string and a Category exists with that id
            if (mongoose.Types.ObjectId.isValid(item)) {
                cat = await Category.findById(item);
            }
            // Try by slug
            if (!cat) {
                const s = slugify(item);
                cat = await Category.findOne({ slug: s });
            }
            // Try by exact name (case-insensitive)
            if (!cat) {
                cat = await Category.findOne({ name: { $regex: new RegExp(`^${item}$`, 'i') } });
            }
            // If still not found, create it as a parent category
            if (!cat) {
                const name = typeof item === 'string' ? item.trim() : String(item);
                const slug = slugify(name);
                cat = new Category({ name, slug });
                await cat.save();
                console.log(`Created new category: ${name} -> ${cat._id}`);
            }

            resolved.push(cat._id);
        }

        novel.categories = resolved;
        await novel.save();
        updatedCount++;
        console.log(`Updated novel ${novel._id} categories -> [${resolved.join(',')}]`);
    }

    console.log(`Migration complete. Updated ${updatedCount} novels.`);
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
