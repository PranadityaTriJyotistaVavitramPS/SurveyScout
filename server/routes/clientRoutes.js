const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController')

router.post('/signInClient',clientController.signInClient);
router.post('/loginClient',clientController.loginClient);
router.get('/getClientInfo',clientController.getClient);
router.delete('/deleteClientAccount',clientController.deleteAccount);


module.exports = router;