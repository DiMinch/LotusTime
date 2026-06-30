const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.list);
router.post('/', userController.create);
router.put('/:id', userController.update);
router.put('/:id/reset-password', userController.resetPassword);
router.patch('/:id/toggle-status', userController.toggleStatus);
router.delete('/:id', userController.remove);

module.exports = router;
