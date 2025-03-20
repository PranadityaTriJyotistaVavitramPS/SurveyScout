const express = require('express');
const router = express.Router();
const surveyorApplyController = require('../controllers/surveyorApplyController');

router.get("/:id_survey",surveyorApplyController.surveyorWorker)
router.post("/mendaftarSurvey", surveyorApplyController.applyToSurvey);


module.exports = router;