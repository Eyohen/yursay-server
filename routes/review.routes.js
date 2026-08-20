const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { validate, validations } = require('../middleware/validate.middleware');

// Public
router.get('/recent', reviewController.getRecentReviews);
router.get('/vendor/:vendorId', validations.uuidParam('vendorId'), validate, reviewController.getVendorReviews);

// Authenticated
router.get('/mine', verifyToken, reviewController.getMyReviews);
router.post('/', verifyToken, validations.review, validate, reviewController.createReview);
router.post('/:id/respond', verifyToken, validations.uuidParam('id'), validations.reviewResponse, validate, reviewController.respondToReview);
router.post('/:id/flag', verifyToken, validations.uuidParam('id'), validations.reviewFlag, validate, reviewController.flagReview);
router.post('/:id/helpful', verifyToken, validations.uuidParam('id'), validate, reviewController.markHelpful);

module.exports = router;
