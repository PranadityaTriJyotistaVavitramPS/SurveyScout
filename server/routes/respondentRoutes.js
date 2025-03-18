const express = require('express');
const router = express.Router();
const respondentController = require('../controllers/respondentController')
const authenticate = require('../middleware/authenticate')

router.post('/signInResponden',authenticate,respondentController.signInResponden);
router.get('/getRespondenInfo',authenticate,respondentController.getResponden);
router.post('/updateRespondenInfo',authenticate,respondentController.updateRespondenProfile);

module.exports = router