const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../models');
const {
  Admin, User, PersonalProfile, BusinessProfile, Vendor, Review,
  FraudReport, PlatformSetting, AuditLog, Category, City, State,
} = db;
const { recalculateVendorStats } = require('../utils/trustScore');
const emailService = require('../services/email.service');

const ADMIN_TOKEN_EXPIRY = '12h';

const logAdminAction = (req, action, entity, entityId, description, metadata = {}) =>
  AuditLog.create({
    adminId: req.admin.id,
    action,
    entity,
    entityId: entityId || null,
    description,
    metadata,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch((error) => console.error('Audit log write failed:', error));

const reviewerName = (user) => {
  const personal = user?.personalProfile;
  const business = user?.businessProfile;
  return personal?.displayName
    || [personal?.firstName, personal?.lastName].filter(Boolean).join(' ')
    || business?.businessName
    || user?.email
    || 'Unknown user';
};

/* ───────────────────────── Auth ───────────────────────── */

// POST /api/admin/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = (email || '').toLowerCase().trim();

    const admin = await Admin.findOne({ where: { email: normalizedEmail } });
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password || '', admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (admin.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Admin account is not active' });
    }

    const token = jwt.sign({ adminId: admin.id }, process.env.JWT_SECRET, { expiresIn: ADMIN_TOKEN_EXPIRY });
    await admin.update({ lastLoginAt: new Date() });

    await AuditLog.create({
      adminId: admin.id,
      action: AuditLog.ACTIONS.ADMIN_LOGIN,
      entity: 'Admin',
      entityId: admin.id,
      description: `${admin.email} logged in`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: {
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          permissions: admin.permissions,
        },
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// GET /api/admin/auth/me
exports.me = async (req, res) => {
  const admin = req.admin;
  res.json({
    success: true,
    data: {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
      permissions: admin.permissions,
    },
  });
};

/* ───────────────────────── Overview ───────────────────────── */

// GET /api/admin/overview
exports.getOverview = async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, newUsersThisWeek,
      totalReviews, newReviewsThisWeek,
      totalVendors,
      pendingReviews, pendingVerifications,
      moderationPreview, verificationPreview,
    ] = await Promise.all([
      User.count(),
      User.count({ where: { createdAt: { [Op.gte]: sevenDaysAgo } } }),
      Review.count(),
      Review.count({ where: { createdAt: { [Op.gte]: sevenDaysAgo } } }),
      Vendor.count(),
      Review.count({ where: { status: 'pending' } }),
      Vendor.count({ where: { verificationStatus: 'pending' } }),
      Review.findAll({
        where: { status: 'pending' },
        include: [
          { model: User, as: 'reviewer', attributes: ['id'], include: [{ model: PersonalProfile, as: 'personalProfile' }, { model: BusinessProfile, as: 'businessProfile' }] },
          { model: Vendor, as: 'vendor', attributes: ['id', 'name'] },
        ],
        order: [['createdAt', 'ASC']],
        limit: 5,
      }),
      Vendor.findAll({
        where: { verificationStatus: 'pending' },
        include: [{ model: User, as: 'owner', attributes: ['id', 'email'] }],
        order: [['claimedAt', 'ASC']],
        limit: 5,
      }),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers, newUsersThisWeek,
          totalReviews, newReviewsThisWeek,
          totalVendors,
          pendingReviews,
          pendingVerifications,
        },
        moderationPreview: moderationPreview.map((review) => ({
          id: review.id,
          reviewerName: reviewerName(review.reviewer),
          vendorName: review.vendor?.name,
          flagReason: review.flagReason,
          createdAt: review.createdAt,
        })),
        verificationPreview: verificationPreview.map((vendor) => ({
          id: vendor.id,
          name: vendor.name,
          ownerEmail: vendor.owner?.email,
          claimedAt: vendor.claimedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Get admin overview error:', error);
    res.status(500).json({ success: false, message: 'Failed to load overview' });
  }
};

/* ───────────────────────── Review moderation ───────────────────────── */

const MODERATION_INCLUDE = [
  { model: User, as: 'reviewer', attributes: ['id', 'email', 'verified', 'createdAt'], include: [{ model: PersonalProfile, as: 'personalProfile' }, { model: BusinessProfile, as: 'businessProfile' }] },
  { model: Vendor, as: 'vendor', attributes: ['id', 'name'] },
];

// GET /api/admin/reviews
exports.listModerationQueue = async (req, res) => {
  try {
    const { status = 'pending', flagReason, q, sort = 'oldest', page = 1, limit = 20 } = req.query;

    const where = { status };
    if (flagReason) where.flagReason = flagReason;
    if (q) {
      where[Op.or] = [{ '$vendor.name$': { [Op.iLike]: `%${q}%` } }];
    }

    const order = sort === 'newest' ? [['createdAt', 'DESC']] : [['createdAt', 'ASC']];

    const reviews = await Review.findAndCountAll({
      where,
      include: MODERATION_INCLUDE,
      order,
      limit: Math.min(Number(limit), 50),
      offset: (Number(page) - 1) * Number(limit),
      subQuery: false,
    });

    res.json({
      success: true,
      data: reviews.rows.map((review) => ({ ...review.toJSON(), reviewerName: reviewerName(review.reviewer) })),
      meta: { total: reviews.count, page: Number(page), limit: Number(limit) },
    });
  } catch (error) {
    console.error('List moderation queue error:', error);
    res.status(500).json({ success: false, message: 'Failed to load moderation queue' });
  }
};

// POST /api/admin/reviews/:id/approve
exports.approveReview = async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    await review.update({ status: 'published', flagReason: null, flaggedById: null });
    await recalculateVendorStats(review.vendorId);
    await logAdminAction(req, AuditLog.ACTIONS.REVIEW_APPROVED, 'Review', review.id, 'Review approved and published');

    res.json({ success: true, data: review });
  } catch (error) {
    console.error('Approve review error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve review' });
  }
};

// POST /api/admin/reviews/:id/remove
exports.removeReview = async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    await review.update({ status: 'removed' });
    await recalculateVendorStats(review.vendorId);
    await logAdminAction(req, AuditLog.ACTIONS.REVIEW_REMOVED, 'Review', review.id, 'Review removed', { reason: req.body?.reason });

    res.json({ success: true, data: review });
  } catch (error) {
    console.error('Remove review error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove review' });
  }
};

// POST /api/admin/reviews/:id/escalate
exports.escalateReview = async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    await logAdminAction(req, AuditLog.ACTIONS.REVIEW_ESCALATED, 'Review', review.id, 'Review escalated to senior moderator');

    res.json({ success: true, message: 'Escalated' });
  } catch (error) {
    console.error('Escalate review error:', error);
    res.status(500).json({ success: false, message: 'Failed to escalate review' });
  }
};

/* ───────────────────────── User management ───────────────────────── */

// GET /api/admin/users
exports.listUsers = async (req, res) => {
  try {
    const { status, q, sort = 'newest', page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) where.status = status;
    if (q) {
      where[Op.or] = [{ email: { [Op.iLike]: `%${q}%` } }];
    }

    const order = {
      newest: [['createdAt', 'DESC']],
    }[sort] || [['createdAt', 'DESC']];

    const users = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password', 'refreshToken', 'verificationToken', 'resetPasswordToken'] },
      include: [
        { model: PersonalProfile, as: 'personalProfile' },
        { model: BusinessProfile, as: 'businessProfile' },
      ],
      order,
      limit: Math.min(Number(limit), 50),
      offset: (Number(page) - 1) * Number(limit),
    });

    const reviewCounts = await Review.findAll({
      attributes: ['reviewerId', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      where: { reviewerId: users.rows.map((u) => u.id) },
      group: ['reviewerId'],
    });
    const countByUser = Object.fromEntries(reviewCounts.map((row) => [row.reviewerId, Number(row.get('count'))]));

    res.json({
      success: true,
      data: users.rows.map((user) => ({
        id: user.id,
        email: user.email,
        name: reviewerName(user),
        userType: user.userType,
        status: user.status,
        verified: user.verified,
        reviewCount: countByUser[user.id] || 0,
        createdAt: user.createdAt,
      })),
      meta: { total: users.count, page: Number(page), limit: Number(limit) },
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ success: false, message: 'Failed to load users' });
  }
};

// POST /api/admin/users/:id/suspend
exports.suspendUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await user.update({ status: 'suspended' });
    await logAdminAction(req, AuditLog.ACTIONS.USER_SUSPENDED, 'User', user.id, 'User suspended', { reason: req.body?.reason });

    res.json({ success: true, message: 'User suspended' });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ success: false, message: 'Failed to suspend user' });
  }
};

// POST /api/admin/users/:id/reinstate
exports.reinstateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await user.update({ status: 'active' });
    await logAdminAction(req, AuditLog.ACTIONS.USER_ACTIVATED, 'User', user.id, 'User reinstated');

    res.json({ success: true, message: 'User reinstated' });
  } catch (error) {
    console.error('Reinstate user error:', error);
    res.status(500).json({ success: false, message: 'Failed to reinstate user' });
  }
};

/* ───────────────────────── Vendor verification ───────────────────────── */

const VENDOR_ADMIN_INCLUDE = [
  { model: Category, as: 'category' },
  { model: City, as: 'city', include: [{ model: State, as: 'state' }] },
  { model: User, as: 'owner', attributes: ['id', 'email'] },
];

// GET /api/admin/vendors/verification-queue
exports.listVerificationQueue = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;

    const where = { verificationStatus: 'pending' };
    if (q) where.name = { [Op.iLike]: `%${q}%` };

    const vendors = await Vendor.findAndCountAll({
      where,
      include: VENDOR_ADMIN_INCLUDE,
      order: [['claimedAt', 'ASC']],
      limit: Math.min(Number(limit), 50),
      offset: (Number(page) - 1) * Number(limit),
    });

    res.json({
      success: true,
      data: vendors.rows,
      meta: { total: vendors.count, page: Number(page), limit: Number(limit) },
    });
  } catch (error) {
    console.error('List verification queue error:', error);
    res.status(500).json({ success: false, message: 'Failed to load verification queue' });
  }
};

// POST /api/admin/vendors/:id/verify
exports.verifyVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByPk(req.params.id, { include: [{ model: User, as: 'owner' }] });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    await vendor.update({ verificationStatus: 'verified' });
    await recalculateVendorStats(vendor.id);
    await logAdminAction(req, AuditLog.ACTIONS.VENDOR_VERIFIED, 'Vendor', vendor.id, 'Vendor verified');

    if (vendor.owner?.email) {
      await emailService.sendEmail({
        to: vendor.owner.email,
        subject: `${vendor.name} is now verified on YurSay`,
        html: `<p>Congratulations! Your business listing "${vendor.name}" has been verified and now shows the trust badge.</p>`,
        text: `Your business listing "${vendor.name}" has been verified.`,
      }).catch((error) => console.error('Verify email failed:', error));
    }

    res.json({ success: true, data: vendor });
  } catch (error) {
    console.error('Verify vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify vendor' });
  }
};

// POST /api/admin/vendors/:id/reject
exports.rejectVendor = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'A rejection reason is required' });

    const vendor = await Vendor.findByPk(req.params.id, { include: [{ model: User, as: 'owner' }] });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    await vendor.update({ verificationStatus: 'rejected' });
    await logAdminAction(req, AuditLog.ACTIONS.VENDOR_REJECTED, 'Vendor', vendor.id, 'Vendor claim rejected', { reason });

    if (vendor.owner?.email) {
      await emailService.sendEmail({
        to: vendor.owner.email,
        subject: `Your claim on ${vendor.name} was not approved`,
        html: `<p>Your claim on "${vendor.name}" was rejected.</p><p>Reason: ${reason}</p>`,
        text: `Your claim on "${vendor.name}" was rejected. Reason: ${reason}`,
      }).catch((error) => console.error('Reject email failed:', error));
    }

    res.json({ success: true, data: vendor });
  } catch (error) {
    console.error('Reject vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject vendor claim' });
  }
};

// POST /api/admin/vendors/:id/request-info
exports.requestVendorInfo = async (req, res) => {
  try {
    const { message } = req.body;
    const vendor = await Vendor.findByPk(req.params.id, { include: [{ model: User, as: 'owner' }] });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    await logAdminAction(req, AuditLog.ACTIONS.VENDOR_INFO_REQUESTED, 'Vendor', vendor.id, 'More info requested from claimer', { message });

    if (vendor.owner?.email) {
      await emailService.sendEmail({
        to: vendor.owner.email,
        subject: `More information needed for ${vendor.name}`,
        html: `<p>${message || 'Please provide additional verification documents for your business listing.'}</p>`,
        text: message || 'Please provide additional verification documents for your business listing.',
      }).catch((error) => console.error('Request info email failed:', error));
    }

    res.json({ success: true, message: 'Info request sent' });
  } catch (error) {
    console.error('Request vendor info error:', error);
    res.status(500).json({ success: false, message: 'Failed to send info request' });
  }
};

/* ───────────────────────── Fraud reports ───────────────────────── */

// GET /api/admin/fraud-reports
exports.listFraudCases = async (req, res) => {
  try {
    const { severity, status } = req.query;

    const where = { fraudCaseStatus: { [Op.ne]: 'none' } };
    if (severity) where.fraudSeverity = severity;
    if (status) where.fraudCaseStatus = status;

    const vendors = await Vendor.findAll({
      where,
      include: [{ model: FraudReport, as: 'fraudReports', order: [['createdAt', 'DESC']] }],
      order: [['updatedAt', 'DESC']],
    });

    res.json({
      success: true,
      data: vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        fraudSeverity: vendor.fraudSeverity,
        fraudCaseStatus: vendor.fraudCaseStatus,
        isBlacklisted: vendor.isBlacklisted,
        reportCount: vendor.fraudReports.length,
        firstReportedAt: vendor.fraudReports.at(-1)?.createdAt,
        reports: vendor.fraudReports,
      })),
    });
  } catch (error) {
    console.error('List fraud cases error:', error);
    res.status(500).json({ success: false, message: 'Failed to load fraud reports' });
  }
};

// POST /api/admin/fraud-reports/:vendorId/blacklist
exports.blacklistVendor = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'A blacklist reason is required' });

    const vendor = await Vendor.findByPk(req.params.vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    await vendor.update({
      isBlacklisted: true,
      blacklistedAt: new Date(),
      blacklistReason: reason,
      fraudCaseStatus: 'resolved',
      status: 'suspended',
    });
    await logAdminAction(req, AuditLog.ACTIONS.VENDOR_BLACKLISTED, 'Vendor', vendor.id, 'Vendor blacklisted', { reason });

    res.json({ success: true, data: vendor });
  } catch (error) {
    console.error('Blacklist vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to blacklist vendor' });
  }
};

// POST /api/admin/fraud-reports/:vendorId/warn
exports.warnVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByPk(req.params.vendorId, { include: [{ model: User, as: 'owner' }] });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    await logAdminAction(req, AuditLog.ACTIONS.VENDOR_WARNED, 'Vendor', vendor.id, 'Warning issued to vendor', { note: req.body?.note });

    if (vendor.owner?.email) {
      await emailService.sendEmail({
        to: vendor.owner.email,
        subject: `Warning regarding your listing on YurSay`,
        html: `<p>We've received reports about "${vendor.name}". Please review our platform guidelines — repeated reports may lead to suspension.</p>`,
        text: `We've received reports about "${vendor.name}". Please review our platform guidelines.`,
      }).catch((error) => console.error('Warn email failed:', error));
    }

    res.json({ success: true, message: 'Warning issued' });
  } catch (error) {
    console.error('Warn vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to warn vendor' });
  }
};

// POST /api/admin/fraud-reports/:vendorId/monitor
exports.monitorVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByPk(req.params.vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    await vendor.update({ fraudCaseStatus: 'monitoring' });
    await logAdminAction(req, AuditLog.ACTIONS.VENDOR_CASE_MONITORED, 'Vendor', vendor.id, 'Case marked as monitoring');

    res.json({ success: true, data: vendor });
  } catch (error) {
    console.error('Monitor vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to update case' });
  }
};

// POST /api/admin/fraud-reports/:vendorId/investigate
exports.investigateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByPk(req.params.vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    await vendor.update({ fraudCaseStatus: 'investigating' });
    await logAdminAction(req, AuditLog.ACTIONS.VENDOR_CASE_INVESTIGATED, 'Vendor', vendor.id, 'Case assigned to investigation');

    res.json({ success: true, data: vendor });
  } catch (error) {
    console.error('Investigate vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to update case' });
  }
};

// POST /api/admin/fraud-reports/:vendorId/dismiss
exports.dismissFraudCase = async (req, res) => {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ success: false, message: 'A dismissal note is required' });

    const vendor = await Vendor.findByPk(req.params.vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    await vendor.update({ fraudCaseStatus: 'dismissed' });
    await logAdminAction(req, AuditLog.ACTIONS.VENDOR_CASE_DISMISSED, 'Vendor', vendor.id, 'Report dismissed', { note });

    res.json({ success: true, data: vendor });
  } catch (error) {
    console.error('Dismiss fraud case error:', error);
    res.status(500).json({ success: false, message: 'Failed to dismiss case' });
  }
};

/* ───────────────────────── Settings ───────────────────────── */

const getOrCreateSettings = async () => {
  const existing = await PlatformSetting.findOne();
  if (existing) return existing;
  return PlatformSetting.create({});
};

// GET /api/admin/settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to load settings' });
  }
};

// PUT /api/admin/settings
exports.updateSettings = async (req, res) => {
  try {
    const editable = [
      'autoFlagSuspiciousReviews', 'requirePhotoForOneStarReviews', 'autoFlagThreshold',
      'allowNewRegistrations', 'allowBusinessClaims', 'maintenanceMode',
    ];
    const updates = {};
    editable.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const settings = await getOrCreateSettings();
    await settings.update(updates);
    await logAdminAction(req, AuditLog.ACTIONS.PLATFORM_SETTINGS_UPDATED, 'PlatformSetting', settings.id, 'Platform settings updated', updates);

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
};

/* ───────────────────────── Admin team ───────────────────────── */

// GET /api/admin/team
exports.listTeam = async (req, res) => {
  try {
    const admins = await Admin.findAll({
      attributes: { exclude: ['password', 'refreshToken', 'resetPasswordToken'] },
      order: [['createdAt', 'ASC']],
    });
    res.json({ success: true, data: admins });
  } catch (error) {
    console.error('List team error:', error);
    res.status(500).json({ success: false, message: 'Failed to load admin team' });
  }
};

// POST /api/admin/team/invite
exports.inviteAdmin = async (req, res) => {
  try {
    const { email, firstName, lastName, role = 'admin' } = req.body;
    const normalizedEmail = (email || '').toLowerCase().trim();

    const existing = await Admin.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An admin with this email already exists' });
    }

    const tempPassword = crypto.randomBytes(16).toString('hex');
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);
    const resetPasswordToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const admin = await Admin.create({
      email: normalizedEmail,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      status: 'active',
      resetPasswordToken,
      resetPasswordExpires,
    });

    await logAdminAction(req, AuditLog.ACTIONS.ADMIN_CREATED, 'Admin', admin.id, `Invited ${normalizedEmail} as ${role}`);

    await emailService.sendEmail({
      to: normalizedEmail,
      subject: 'You’ve been invited to the YurSay Admin Panel',
      html: `<p>You've been invited as a ${role}. Use the link below to set your password:</p><p>${process.env.ADMIN_URL || ''}/reset-password?token=${resetPasswordToken}</p>`,
      text: `You've been invited as a ${role}. Set your password: ${process.env.ADMIN_URL || ''}/reset-password?token=${resetPasswordToken}`,
    }).catch((error) => console.error('Invite email failed:', error));

    res.status(201).json({ success: true, message: 'Invite sent' });
  } catch (error) {
    console.error('Invite admin error:', error);
    res.status(500).json({ success: false, message: 'Failed to invite admin' });
  }
};

// PUT /api/admin/team/:id/role
exports.updateAdminRole = async (req, res) => {
  try {
    const { role, permissions } = req.body;
    const admin = await Admin.findByPk(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const updates = {};
    if (role) updates.role = role;
    if (permissions) updates.permissions = permissions;

    await admin.update(updates);
    await logAdminAction(req, AuditLog.ACTIONS.ADMIN_UPDATED, 'Admin', admin.id, 'Admin role updated', updates);

    res.json({ success: true, data: admin });
  } catch (error) {
    console.error('Update admin role error:', error);
    res.status(500).json({ success: false, message: 'Failed to update admin role' });
  }
};
