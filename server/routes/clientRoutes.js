const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController')

router.post('/signInClient',clientController.signInClient);
router.post('/loginClient',clientController.loginClient);
router.post('/googleLoginClient',clientController.clientGoogleLogin);
router.put('/updateClientProfile',clientController.updateClientProfile);
router.get('/getClientInfo',clientController.getClient);
router.delete('/deleteClientAccount',clientController.deleteAccount);



module.exports = router;