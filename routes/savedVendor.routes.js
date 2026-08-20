const express = require('express');
const router = express.Router();
const savedVendorController = require('../controllers/savedVendor.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { validate, validations } = require('../middleware/validate.middleware');

router.use(verifyToken);

router.get('/', savedVendorController.getSavedVendors);
router.post('/:vendorId', validations.uuidParam('vendorId'), validate, savedVendorController.saveVendor);
router.delete('/:vendorId', validations.uuidParam('vendorId'), validate, savedVendorController.unsaveVendor);

module.exports = router;
