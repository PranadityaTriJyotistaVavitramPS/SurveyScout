const express = require('express');
const router = express.Router();
const respondController = require('../controllers/respondController');

router.post('/createRespondDraft',respondController.createRespondDraft);
router.post('/createRespondPayment',respondController.createRespondPayment);
router.get('/getARespondTask',respondController.getAResponTask);
router.get('/getAllRespondTask',respondController.getAllRespondTask);
router.delete('/deleteARespond',respondController.deleteARespond);

module.exports = router;