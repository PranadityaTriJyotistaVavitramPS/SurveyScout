const express = require('express');
const router = express.Router();
const projectsController = require('../controllers/projectsController.js');
const authenticate = require('../middleware/authenticate');


router.get('/clientProjects', authenticate, projectsController.clientProjects);
router.get('/:id_project',projectsController.getProjectsDetail);


module.exports = router;