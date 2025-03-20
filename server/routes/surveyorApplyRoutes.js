const express = require('express');
const router = express.Router();
const surveyorApplyController = require('../controllers/surveyorApplyController');

router.get("/:id_survey",surveyorApplyController.surveyorWorker)
router.post("/mendaftarSurvey", surveyorApplyController.applyToSurvey);
router.post("/menerimaSurveyor",surveyorApplyController.accSurveyor);


module.exports = router;