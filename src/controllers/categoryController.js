const mongoose = require('mongoose');
const Category = require('../models/category');

// Return categories as a hierarchical tree (parents with nested children)
exports.getCategories = async (req, res) => {
    try {
        const categories = await Category.find().sort({ name: 1 }).lean();

        // Build map and tree
        const map = {};
        categories.forEach(c => {
            c.children = [];
            map[c._id.toString()] = c;
        });

        const roots = [];
        categories.forEach(c => {
            if (c.parent) {
                const p = map[c.parent.toString()];
                if (p) p.children.push(c);
                else roots.push(c);
            } else {
                roots.push(c);
            }
        });

        res.status(200).json({ success: true, data: roots });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// Seed default categories (protected - call this once)
exports.seedDefaultCategories = async (req, res) => {
    try {
        const defaultCategories = [
            'Romance',
            'Mystery',
            'Religious',
            'Fantasy',
            'Science Fiction',
            'Thriller',
            'Historical',
            'Adventure',
            'Drama',
            'Comedy',
            'Horror',
            'Nonfiction',
            'Action',
            'Supernatural',
            'Revenge',
            'Mythology',
            'Emotional',
            'Friendship',
            'Magic',
            'Destiny'
        ];

        const created = [];
        for (const name of defaultCategories) {
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const doc = await Category.findOneAndUpdate(
                { name },
                { $set: { name, slug } },
                { upsert: true, new: true }
            );
            created.push(doc);
        }

        res.status(200).json({ success: true, message: 'Default categories seeded', data: created });
    } catch (error) {
        console.error('Error seeding categories:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// Bulk add subcategories. Expects body: { categories: [ { parent: 'Romance', subs: ['Office Romance','Contract Marriage'] }, ... ] }
exports.addSubcategoriesBulk = async (req, res) => {
    try {
        const payload = req.body?.categories;
        if (!Array.isArray(payload) || payload.length === 0) {
            return res.status(400).json({ success: false, message: 'categories payload is required and should be an array' });
        }

        const created = [];
        for (const group of payload) {
            const parentName = group.parent?.trim();
            const subs = Array.isArray(group.subs) ? group.subs : [];
            if (!parentName) continue;

            const parentSlug = parentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const parent = await Category.findOneAndUpdate(
                { name: parentName },
                { $set: { name: parentName, slug: parentSlug } },
                { upsert: true, new: true }
            );

            for (const subNameRaw of subs) {
                const subName = (subNameRaw || '').trim();
                if (!subName) continue;
                const subSlug = subName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                const sub = await Category.findOneAndUpdate(
                    { name: subName },
                    { $set: { name: subName, slug: subSlug, parent: parent._id } },
                    { upsert: true, new: true }
                );
                created.push(sub);
            }
        }

        res.status(200).json({ success: true, message: 'Subcategories added/updated', data: created });
    } catch (error) {
        console.error('Error adding subcategories:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// Get a single category by id or slug, include its immediate children
exports.getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        let category = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            category = await Category.findById(id).lean();
        }

        if (!category) {
            category = await Category.findOne({ slug: id }).lean();
        }

        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        const children = await Category.find({ parent: category._id }).sort({ name: 1 }).lean();
        category.children = children;

        res.status(200).json({ success: true, data: category });
    } catch (error) {
        console.error('Error fetching category by id:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// Get immediate subcategories for a given category id or slug
exports.getSubcategories = async (req, res) => {
    try {
        const { id } = req.params;

        let category = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            category = await Category.findById(id).lean();
        }
        if (!category) {
            category = await Category.findOne({ slug: id }).lean();
        }
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        const children = await Category.find({ parent: category._id }).sort({ name: 1 }).lean();
        res.status(200).json({ success: true, data: children });
    } catch (error) {
        console.error('Error fetching subcategories:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// Get flat list of all categories (id, name, slug, parent)
exports.getFlatCategories = async (req, res) => {
    try {
        const categories = await Category.find().select('name slug parent').sort({ name: 1 }).lean();
        res.status(200).json({ success: true, data: categories });
    } catch (error) {
        console.error('Error fetching flat categories:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// Get all descendant subcategories for a given category id or slug (recursive)
exports.getAllSubcategoriesRecursive = async (req, res) => {
    try {
        const { id } = req.params;
        let category = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            category = await Category.findById(id).lean();
        }
        if (!category) category = await Category.findOne({ slug: id }).lean();
        if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

        // BFS to collect all descendants
        const descendants = [];
        const queue = [category._id];
        while (queue.length > 0) {
            const parentId = queue.shift();
            const children = await Category.find({ parent: parentId }).select('name slug parent').lean();
            for (const ch of children) {
                descendants.push(ch);
                queue.push(ch._id);
            }
        }

        res.status(200).json({ success: true, data: descendants });
    } catch (error) {
        console.error('Error fetching all subcategories recursively:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};
