const express = require('express');
const router = express.Router();
const surveyorApplyController = require('../controllers/surveyorApplyController');
const authenticate = require('../middleware/authenticate')

router.get("/:id_survey",surveyorApplyController.surveyorWorker)
router.post("/mendaftarSurvey/:id_survey",authenticate, surveyorApplyController.applyToSurvey);
router.post("/:id_survey/acceptedSurveyor",surveyorApplyController.accSurveyor);
router.post("/:id_survey/rejectedSurveyor",surveyorApplyController.rejSurveyor);

module.exports = router;