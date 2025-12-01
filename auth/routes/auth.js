const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/health', authController.health);
router.get('/check-availability', authController.checkAvailability);
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;
