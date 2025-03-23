const express = require('express');
const router = express.Router();
const surveyController = require("../controllers/surveyController");
const authenticate = require("../middleware/authenticate")


router.get('/',surveyController.getAllSurveyTask);
router.get('/mySurvey',authenticate,surveyController.surveyorProjects)
router.get('/:id_survey',surveyController.getSurveyDetail);
router.post('/createSurveyDraft',authenticate,surveyController.createSurveyDraft);
router.post('/createSurveyPayment/:id_draft',surveyController.createSurveyPayment);
router.post('/uploadAnswer',surveyController.uploadAnswers,surveyController.submitSurveyorAnswer)
router.delete('/deleteATask',surveyController.deleteASurvey);

module.exports = router;