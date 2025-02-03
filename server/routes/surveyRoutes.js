const express = require('express');
const router = express.Router();
const surveyController = require("../controllers/surveyController");

router.post('/createSurveyDraft',surveyController.createSurveyDraft);
router.post('/createSurveyPayment',surveyController.createSurveyPayment);
router.get('/getASurveyTask',surveyController.getASurveyTask);
router.get('/getAllSurveyTask',surveyController.getAllSurveyTask);
router.delete('/deleteATask',surveyController.deleteASurvey);

module.exports = router;