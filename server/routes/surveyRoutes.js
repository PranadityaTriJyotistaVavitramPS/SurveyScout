const express = require('express');
const router = express.Router();
const surveyController = require("../controllers/surveyController");
const authenticate = require("../middleware/authenticate")


router.get('/',surveyController.getAllSurveyTask);
router.get('/mySurvey',authenticate,surveyController.surveyorProjects)
router.get('/:id_survey',surveyController.getSurveyDetail);
router.get('/:id_survey/applied',authenticate,surveyController.getAppliedSurveyDetail);
router.get('/:id_survey/surveyAnswer',surveyController.showSurveyorAnswer)
router.post('/createSurveyDraft',authenticate,surveyController.createSurveyDraft);
router.post('/createSurveyPayment/:id_draft',surveyController.createSurveyPayment);
router.post('/uploadAnswer/:id_survey',authenticate,surveyController.uploadAnswers,surveyController.submitSurveyorAnswer);
router.post('/:id_survey/acceptSurveyorAnswer',surveyController.accSurveyorAnswer);
router.post('/:id_survey/revisiSurveyorAnswer',surveyController.revisiSurveyorAnswer);
router.delete('/:id_luaran/deleteAnswer',surveyController.deleteSurveyAnswer)
router.delete('/deleteATask',surveyController.deleteASurvey);

module.exports = router;