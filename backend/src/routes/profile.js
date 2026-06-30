const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

router.get('/', profileController.get);
router.put('/password', profileController.changePassword);

module.exports = router;
