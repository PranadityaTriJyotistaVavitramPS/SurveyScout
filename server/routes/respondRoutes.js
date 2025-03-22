const express = require('express');
const router = express.Router();
const respondController = require('../controllers/respondController');
const authenticate = require('../middleware/authenticate');

//buat bikin respond_draft(ini perlu authentikasi)
router.post('/createRespondDraft',authenticate,respondController.createRespondDraft);

//buat bikin respond_payment (kirim id draft lewat params)
router.post('/createRespondPayment/:id_draft',respondController.createRespondPayment);

//(mendapatkan seluruh respond projek)
router.get('/',respondController.getAllRespondTask);

//(menghapus projek)
router.delete('/deleteARespond',respondController.deleteARespond);

module.exports = router;