const express = require('express');
const AppController = require('../controllers/AppController.js');
const UsersController = require('../controllers/UsersController.js');
const AuthController = require('../controllers/AuthController.js');

const router = express.Router();

router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);

router.post('/users', UsersController.postNew);

router.get('/connect', AuthController.getConnect);
router.get('/disconnect', AuthController.getDisconnect);
router.get('/users/me', UsersController.getMe);

module.exports = router;