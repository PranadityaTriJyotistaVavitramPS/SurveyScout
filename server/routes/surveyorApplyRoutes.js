const express = require('express');
const router = express.Router();
const surveyorApplyController = require('../controllers/surveyorApplyController');
const authenticate = require('../middleware/authenticate')

router.get("/:id_survey",surveyorApplyController.surveyorWorker)
router.post("/mendaftarSurvey/:id_survey",authenticate, surveyorApplyController.applyToSurvey);
router.post("/menerimaSurveyor",surveyorApplyController.accSurveyor);


module.exports = router;