const express = require('express');
const router = express.Router();
const surveyorApplyController = require('../controllers/surveyorApplyController');

router.post("/mendaftarSurvey", surveyorApplyController.applyToSurvey);
router.get("/",surveyorApplyController.surveyorWorker)

module.exports = router;