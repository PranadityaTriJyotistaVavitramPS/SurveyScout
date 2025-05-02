const express = require('express');
const router = express.Router();
const respondentApplyController = require('../controllers/respondentApplyController');
const authenticate = require('../middleware/authenticate')

router.get('/:id_respond',respondentApplyController.respondenWorker);
router.post('/mendaftarRespond/:id_respond',authenticate,respondentApplyController.applyToRespond);

module.exports = router;