const express = require('express');
const router = express.Router();
const surveyorController = require('../controllers/surveyorController');
const authenticate = require('../middleware/authenticate');

router.post('/signInSurveyor',authenticate,surveyorController.uploadSurveyorFiles,surveyorController.signInSurveyor);
router.get('/getSurveyorInfo',authenticate,surveyorController.getSurveyor)
router.put('/updateSurveyorProfile',authenticate,surveyorController.uploadSurveyorFiles,surveyorController.updateSurveyorProfile);

module.exports = router