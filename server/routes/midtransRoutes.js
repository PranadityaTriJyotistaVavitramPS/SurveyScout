const express = require('express');
const router = express.Router();
const midtransController = require('../controllers/midtransController');

router.post('/midtransNotification',midtransController.midtransNotification)


module.exports = router;