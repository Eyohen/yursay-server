const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendor.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { validate, validations } = require('../middleware/validate.middleware');

// Public
router.get('/', vendorController.searchVendors);

// Authenticated — specific routes before /:id
router.get('/mine/owned', verifyToken, vendorController.getMyVendor);
router.post('/', verifyToken, validations.vendor, validate, vendorController.createVendor);
router.post('/:id/claim', verifyToken, validations.uuidParam('id'), validate, vendorController.claimVendor);
router.post('/:id/report-fraud', verifyToken, validations.uuidParam('id'), validations.fraudReport, validate, vendorController.reportFraud);
router.put('/:id', verifyToken, validations.uuidParam('id'), validations.vendor, validate, vendorController.updateVendor);

// Public — must come after the more specific routes above
router.get('/:id', validations.uuidParam('id'), validate, vendorController.getVendor);

module.exports = router;
