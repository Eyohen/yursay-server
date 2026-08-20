const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const adminController = require('../controllers/admin.controller');
const adminAuth = require('../middleware/adminAuth');
const requirePermission = require('../middleware/adminPermission');
const { validate, validations } = require('../middleware/validate.middleware');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Auth
router.post('/auth/login', authLimiter, validations.adminLogin, validate, adminController.login);
router.get('/auth/me', adminAuth, adminController.me);

// Overview
router.get('/overview', adminAuth, adminController.getOverview);

// Review moderation
router.get('/reviews', adminAuth, requirePermission('reviews', 'read'), adminController.listModerationQueue);
router.post('/reviews/:id/approve', adminAuth, requirePermission('reviews', 'moderate'), validations.uuidParam('id'), validate, adminController.approveReview);
router.post('/reviews/:id/remove', adminAuth, requirePermission('reviews', 'moderate'), validations.uuidParam('id'), validate, adminController.removeReview);
router.post('/reviews/:id/escalate', adminAuth, requirePermission('reviews', 'moderate'), validations.uuidParam('id'), validate, adminController.escalateReview);

// User management
router.get('/users', adminAuth, requirePermission('users', 'read'), adminController.listUsers);
router.post('/users/:id/suspend', adminAuth, requirePermission('users', 'suspend'), validations.uuidParam('id'), validate, adminController.suspendUser);
router.post('/users/:id/reinstate', adminAuth, requirePermission('users', 'suspend'), validations.uuidParam('id'), validate, adminController.reinstateUser);

// Vendor verification
router.get('/vendors/verification-queue', adminAuth, requirePermission('vendors', 'read'), adminController.listVerificationQueue);
router.post('/vendors/:id/verify', adminAuth, requirePermission('vendors', 'verify'), validations.uuidParam('id'), validate, adminController.verifyVendor);
router.post('/vendors/:id/reject', adminAuth, requirePermission('vendors', 'verify'), validations.uuidParam('id'), validate, adminController.rejectVendor);
router.post('/vendors/:id/request-info', adminAuth, requirePermission('vendors', 'verify'), validations.uuidParam('id'), validate, adminController.requestVendorInfo);

// Fraud reports
router.get('/fraud-reports', adminAuth, requirePermission('fraudReports', 'read'), adminController.listFraudCases);
router.post('/fraud-reports/:vendorId/blacklist', adminAuth, requirePermission('fraudReports', 'act'), validations.uuidParam('vendorId'), validate, adminController.blacklistVendor);
router.post('/fraud-reports/:vendorId/warn', adminAuth, requirePermission('fraudReports', 'act'), validations.uuidParam('vendorId'), validate, adminController.warnVendor);
router.post('/fraud-reports/:vendorId/monitor', adminAuth, requirePermission('fraudReports', 'act'), validations.uuidParam('vendorId'), validate, adminController.monitorVendor);
router.post('/fraud-reports/:vendorId/investigate', adminAuth, requirePermission('fraudReports', 'act'), validations.uuidParam('vendorId'), validate, adminController.investigateVendor);
router.post('/fraud-reports/:vendorId/dismiss', adminAuth, requirePermission('fraudReports', 'act'), validations.uuidParam('vendorId'), validate, adminController.dismissFraudCase);

// Settings
router.get('/settings', adminAuth, requirePermission('settings', 'read'), adminController.getSettings);
router.put('/settings', adminAuth, requirePermission('settings', 'write'), adminController.updateSettings);

// Admin team
router.get('/team', adminAuth, requirePermission('team', 'read'), adminController.listTeam);
router.post('/team/invite', adminAuth, requirePermission('team', 'invite'), adminController.inviteAdmin);
router.put('/team/:id/role', adminAuth, requirePermission('team', 'invite'), validations.uuidParam('id'), validate, adminController.updateAdminRole);

module.exports = router;
