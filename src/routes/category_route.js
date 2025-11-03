const express = require('express');
const router = express.Router();
const { getCategories, seedDefaultCategories } = require('../controllers/categoryController');
const { verifyToken } = require('../middleware/authMiddleware');

// Public: get all categories (hierarchical)
router.get('/', getCategories);

// Protected: seed default categories (call once by admin)
router.post('/seed', verifyToken, seedDefaultCategories);

// Protected: bulk add subcategories
router.post('/bulk', verifyToken, require('../controllers/categoryController').addSubcategoriesBulk);

// Public: get a category by id or slug with its immediate children
router.get('/:id', require('../controllers/categoryController').getCategoryById);

// Public: get immediate subcategories for a category
router.get('/:id/subs', require('../controllers/categoryController').getSubcategories);

// Public: flat list of all categories (id, name, slug, parent)
router.get('/flat/all', require('../controllers/categoryController').getFlatCategories);

// Public: get all descendant subcategories recursively for a category
router.get('/:id/all-subs', require('../controllers/categoryController').getAllSubcategoriesRecursive);

module.exports = router;
