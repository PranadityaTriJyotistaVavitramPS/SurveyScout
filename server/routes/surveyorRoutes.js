const express = require('express');
const router = express.Router();
const surveyorController = require('../controllers/surveyorController');
const authenticate = require('../middleware/authenticate');

router.post('/signInSurveyor',authenticate,surveyorController.uploadProfile,surveyorController.signInSurveyor);
router.get('/getSurveyorInfo',authenticate,surveyorController.getSurveyor)

module.exports = router