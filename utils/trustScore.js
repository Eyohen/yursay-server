const db = require('../models');

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Recomputes a vendor's avgRating, reviewCount, trustScore and trustSignals
 * from its published reviews. Called after any review create/moderate event
 * or a change to the vendor's verificationStatus.
 */
const recalculateVendorStats = async (vendorId) => {
  const { Vendor, Review } = db;

  const vendor = await Vendor.findByPk(vendorId);
  if (!vendor) return null;

  const reviews = await Review.findAll({
    where: { vendorId, status: 'published' },
    include: [{ model: db.User, as: 'reviewer', attributes: ['verified'] }],
  });

  const reviewCount = reviews.length;
  const avgRating = reviewCount
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
    : 0;

  const now = Date.now();
  const recentCount = reviews.filter(
    (r) => now - new Date(r.createdAt).getTime() <= NINETY_DAYS_MS
  ).length;
  const respondedCount = reviews.filter((r) => Boolean(r.vendorResponse)).length;
  const verifiedReviewerCount = reviews.filter((r) => r.reviewer?.verified).length;

  const recencyPct = reviewCount ? Math.round((recentCount / reviewCount) * 100) : 0;
  const ownerResponseRatePct = reviewCount ? Math.round((respondedCount / reviewCount) * 100) : 0;
  const verifiedReviewerPct = reviewCount ? Math.round((verifiedReviewerCount / reviewCount) * 100) : 0;
  const fraudSignalsClear = true; // hook for future abuse-detection logic

  const ratingScore = (avgRating / 5) * 100; // 0-100
  const verificationBonus = vendor.verificationStatus === 'verified' ? 15 : 0;

  const trustScore = Math.max(0, Math.min(100, Math.round(
    ratingScore * 0.6
    + recencyPct * 0.10
    + ownerResponseRatePct * 0.15
    + (fraudSignalsClear ? 100 : 0) * 0.15
    + verificationBonus
  )));

  await vendor.update({
    avgRating: Number(avgRating.toFixed(2)),
    reviewCount,
    trustScore,
    trustSignals: {
      verifiedReviewerPct,
      ownerResponseRatePct,
      recencyPct,
      fraudSignalsClear,
    },
  });

  return vendor;
};

module.exports = { recalculateVendorStats };
