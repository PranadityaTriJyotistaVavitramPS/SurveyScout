const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const authenticate = require('../middleware/authenticate')

router.post('/GloginFirebase',usersController.googleLogin);
router.post('/selectRole',authenticate,usersController.selectRole);


module.exports = router;