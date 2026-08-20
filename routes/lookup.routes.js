const express = require('express');
const router = express.Router();
const lookupController = require('../controllers/lookup.controller');

// All lookup routes are public
// Locations
router.get('/regions', lookupController.getRegions);
router.get('/states', lookupController.getStates);
router.get('/states/:regionId', lookupController.getStatesByRegion);
router.get('/cities', lookupController.getCities);
router.get('/cities/:stateId', lookupController.getCitiesByState);

// Categories
router.get('/categories', lookupController.getCategories);
router.get('/categories/:id', lookupController.getCategoryById);

module.exports = router;
