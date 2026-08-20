const db = require('../models');
const { Review, Vendor, User, PersonalProfile, BusinessProfile, PlatformSetting } = db;
const { recalculateVendorStats } = require('../utils/trustScore');

const PROMO_CODE_PATTERN = /\b(use\s+(my\s+)?code|promo\s*code|discount\s*code)\b/i;
const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000;

// Reviews matching a fraud pattern (promo-code language, brand-new account)
// are held for moderation instead of publishing immediately.
const detectAutoFlag = (content, reviewer) => {
  if (PROMO_CODE_PATTERN.test(content)) return 'Promo code in review text';
  const accountAgeMs = Date.now() - new Date(reviewer.createdAt).getTime();
  if (accountAgeMs <= NEW_ACCOUNT_WINDOW_MS) return 'Account created within 24 hours of review';
  return null;
};

const REVIEWER_INCLUDE = {
  model: User,
  as: 'reviewer',
  attributes: ['id', 'verified'],
  include: [
    { model: PersonalProfile, as: 'personalProfile', attributes: ['firstName', 'lastName', 'displayName', 'avatarUrl'] },
    { model: BusinessProfile, as: 'businessProfile', attributes: ['businessName', 'logoUrl'] },
  ],
};

const toPublicReview = (review) => {
  const plain = review.toJSON ? review.toJSON() : review;
  const reviewerName = plain.reviewer?.personalProfile?.displayName
    || [plain.reviewer?.personalProfile?.firstName, plain.reviewer?.personalProfile?.lastName].filter(Boolean).join(' ')
    || plain.reviewer?.businessProfile?.businessName
    || 'YurSay User';

  return {
    ...plain,
    reviewerId: plain.isAnonymous ? undefined : plain.reviewerId,
    reviewer: plain.isAnonymous
      ? { verified: plain.reviewer?.verified || false }
      : { verified: plain.reviewer?.verified || false, name: reviewerName },
  };
};

// POST /api/reviews
exports.createReview = async (req, res) => {
  try {
    const { vendorId, rating, tags, content, isAnonymous, orderedPhotoUrl, gotPhotoUrl, additionalPhotos } = req.body;

    const vendor = await Vendor.findByPk(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    if (vendor.ownerUserId === req.user.id) {
      return res.status(403).json({ success: false, message: 'You cannot review your own business' });
    }

    const settings = await PlatformSetting.findOne();
    const autoFlagReason = settings?.autoFlagSuspiciousReviews !== false
      ? detectAutoFlag(content, req.user)
      : null;

    const review = await Review.create({
      vendorId,
      reviewerId: req.user.id,
      rating,
      tags: tags || [],
      content,
      isAnonymous: Boolean(isAnonymous),
      orderedPhotoUrl: orderedPhotoUrl || null,
      gotPhotoUrl: gotPhotoUrl || null,
      additionalPhotos: (additionalPhotos || []).slice(0, 5),
      status: autoFlagReason ? 'pending' : 'published',
      flagReason: autoFlagReason,
    });

    await recalculateVendorStats(vendorId);

    const created = await Review.findByPk(review.id, { include: [REVIEWER_INCLUDE] });
    res.status(201).json({ success: true, data: toPublicReview(created) });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ success: false, message: 'Failed to create review' });
  }
};

// GET /api/reviews/recent — public feed for homepage/featured sections
exports.getRecentReviews = async (req, res) => {
  try {
    const { limit = 6, withPhotos } = req.query;

    const where = { status: 'published' };
    if (withPhotos === 'true') {
      where[db.Sequelize.Op.or] = [
        { orderedPhotoUrl: { [db.Sequelize.Op.ne]: null } },
        { gotPhotoUrl: { [db.Sequelize.Op.ne]: null } },
      ];
    }

    const reviews = await Review.findAll({
      where,
      include: [REVIEWER_INCLUDE, { model: Vendor, as: 'vendor', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      limit: Math.min(Number(limit), 20),
    });

    res.json({ success: true, data: reviews.map(toPublicReview) });
  } catch (error) {
    console.error('Get recent reviews error:', error);
    res.status(500).json({ success: false, message: 'Failed to get recent reviews' });
  }
};

// GET /api/reviews/vendor/:vendorId
exports.getVendorReviews = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { sort = 'newest', page = 1, limit = 20 } = req.query;

    const order = {
      newest: [['createdAt', 'DESC']],
      'most-helpful': [['helpfulCount', 'DESC']],
      'highest-rated': [['rating', 'DESC']],
      'lowest-rated': [['rating', 'ASC']],
    }[sort] || [['createdAt', 'DESC']];

    const reviews = await Review.findAndCountAll({
      where: { vendorId, status: 'published' },
      include: [REVIEWER_INCLUDE],
      order,
      limit: Math.min(Number(limit), 50),
      offset: (Number(page) - 1) * Number(limit),
    });

    res.json({
      success: true,
      data: reviews.rows.map(toPublicReview),
      meta: { total: reviews.count, page: Number(page), limit: Number(limit) },
    });
  } catch (error) {
    console.error('Get vendor reviews error:', error);
    res.status(500).json({ success: false, message: 'Failed to get reviews' });
  }
};

// GET /api/reviews/mine
exports.getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.findAll({
      where: { reviewerId: req.user.id },
      include: [{ model: Vendor, as: 'vendor' }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: reviews });
  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({ success: false, message: 'Failed to get your reviews' });
  }
};

// POST /api/reviews/:id/respond
exports.respondToReview = async (req, res) => {
  try {
    const { response } = req.body;

    const review = await Review.findByPk(req.params.id, { include: [{ model: Vendor, as: 'vendor' }] });
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (review.vendor.ownerUserId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the business owner can respond to this review' });
    }

    await review.update({ vendorResponse: response, vendorRespondedAt: new Date() });
    await recalculateVendorStats(review.vendorId);

    const updated = await Review.findByPk(review.id, { include: [REVIEWER_INCLUDE] });
    res.json({ success: true, data: toPublicReview(updated) });
  } catch (error) {
    console.error('Respond to review error:', error);
    res.status(500).json({ success: false, message: 'Failed to respond to review' });
  }
};

// POST /api/reviews/:id/flag
exports.flagReview = async (req, res) => {
  try {
    const { reason } = req.body;

    const review = await Review.findByPk(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    await review.update({
      status: 'pending',
      flagReason: reason,
      flaggedById: req.user.id,
    });

    res.json({ success: true, message: 'Review flagged for moderation' });
  } catch (error) {
    console.error('Flag review error:', error);
    res.status(500).json({ success: false, message: 'Failed to flag review' });
  }
};

// POST /api/reviews/:id/helpful
exports.markHelpful = async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    await review.increment('helpfulCount');
    res.json({ success: true, data: { helpfulCount: review.helpfulCount + 1 } });
  } catch (error) {
    console.error('Mark helpful error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark review helpful' });
  }
};
