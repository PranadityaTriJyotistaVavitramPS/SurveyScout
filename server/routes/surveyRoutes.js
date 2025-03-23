const express = require('express');
const router = express.Router();
const surveyController = require("../controllers/surveyController");
const authenticate = require("../middleware/authenticate")


router.get('/',surveyController.getAllSurveyTask);
router.get('/mySurvey',authenticate,surveyController.surveyorProjects)
router.get('/:id_survey', authenticate, async (req, res) => {
    const { id_survey } = req.params;
    if (req.user) {
        return surveyController.getAppliedSurveyDetail(req, res);
    }
    return surveyController.getSurveyDetail(req, res); 
});
router.post('/createSurveyDraft',authenticate,surveyController.createSurveyDraft);
router.post('/createSurveyPayment/:id_draft',surveyController.createSurveyPayment);
router.post('/uploadAnswer',surveyController.uploadAnswers,surveyController.submitSurveyorAnswer)
router.delete('/deleteATask',surveyController.deleteASurvey);

module.exports = router;