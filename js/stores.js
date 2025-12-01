// ORIGINAL_PATH: /stores.js
const express = require('express');
const router = express.Router();
const {
    createStore,
    getStores,
    getStoreById,
    updateStore
} = require('../controllers/storeController');

const authMiddleware = require('../../../authMiddleware');

router.get('/', getStores);
router.post('/', authMiddleware, createStore);
router.route('/:id')
    .get(getStoreById)
    .put(authMiddleware, updateStore);

module.exports = router;
