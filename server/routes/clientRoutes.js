const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const authenticate = require('../middleware/authenticate');

router.post('/signInClient',authenticate,clientController.signInClient);
router.put('/updateClientProfile',authenticate,clientController.uploadProfileImage,clientController.updateClientProfile);
router.get('/getClientInfo',authenticate,clientController.getClient);
router.delete('/deleteClientAccount',clientController.uploadProfileImage,clientController.deleteAccount);


module.exports = router;