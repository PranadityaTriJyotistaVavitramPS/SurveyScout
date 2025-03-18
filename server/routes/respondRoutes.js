const express = require('express');
const router = express.Router();
const respondController = require('../controllers/respondController');
const authenticate = require('../middleware/authenticate');

router.post('/createRespondDraft',authenticate,respondController.createRespondDraft);
router.post('/createRespondPayment/:id_draft',respondController.createRespondPayment);
router.get('/',respondController.getAllRespondTask);
router.delete('/deleteARespond',respondController.deleteARespond);

module.exports = router;