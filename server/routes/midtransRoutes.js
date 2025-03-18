const express = require('express');
const router = express.Router();
const midtransController = require('../controllers/midtransController');

router.post('/midtransNotification', midtransController.midtransNotification);
router.post('/midtransResponse',midtransController.midtransResponse);

module.exports = router;