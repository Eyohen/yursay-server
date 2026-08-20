const { Op } = require('sequelize');
const db = require('../models');
const { Vendor, Category, City, State, FraudReport } = db;
const { recalculateVendorStats } = require('../utils/trustScore');
const { recalculateVendorFraudStats } = require('../utils/fraudStats');

const PUBLIC_INCLUDE = [
  { model: Category, as: 'category' },
  { model: City, as: 'city', include: [{ model: State, as: 'state' }] },
];

const SORTS = {
  'most-reviewed': [['reviewCount', 'DESC']],
  'highest-rated': [['avgRating', 'DESC']],
  newest: [['createdAt', 'DESC']],
  'most-recent-activity': [['updatedAt', 'DESC']],
};

// GET /api/vendors
exports.searchVendors = async (req, res) => {
  try {
    const { q, categoryId, cityId, minRating, verifiedOnly, sort = 'most-reviewed', page = 1, limit = 20 } = req.query;

    const where = { status: 'active' };

    if (q) {
      const term = q.trim().replace(/^@/, '');
      where[Op.or] = [
        { name: { [Op.iLike]: `%${term}%` } },
        { handle: { [Op.iLike]: `%${term}%` } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;
    if (cityId) where.cityId = cityId;
    if (minRating) where.avgRating = { [Op.gte]: Number(minRating) };
    if (verifiedOnly === 'true') where.verificationStatus = 'verified';

    const vendors = await Vendor.findAndCountAll({
      where,
      include: PUBLIC_INCLUDE,
      order: SORTS[sort] || SORTS['most-reviewed'],
      limit: Math.min(Number(limit), 50),
      offset: (Number(page) - 1) * Number(limit),
    });

    res.json({
      success: true,
      data: vendors.rows,
      meta: { total: vendors.count, page: Number(page), limit: Number(limit) },
    });
  } catch (error) {
    console.error('Search vendors error:', error);
    res.status(500).json({ success: false, message: 'Failed to search vendors' });
  }
};

// GET /api/vendors/:id
exports.getVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByPk(req.params.id, { include: PUBLIC_INCLUDE });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    res.json({ success: true, data: vendor });
  } catch (error) {
    console.error('Get vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to get vendor' });
  }
};

// POST /api/vendors
exports.createVendor = async (req, res) => {
  try {
    const { name, primaryPlatform, handle, categoryId, cityId, address, description, phone, whatsapp, businessHours } = req.body;

    const vendor = await Vendor.create({
      name,
      primaryPlatform: primaryPlatform || null,
      handle: handle || null,
      categoryId: categoryId || null,
      cityId: cityId || null,
      address: address || null,
      description: description || null,
      phone: phone || null,
      whatsapp: whatsapp || null,
      businessHours: businessHours || null,
      createdByUserId: req.user.id,
    });

    const created = await Vendor.findByPk(vendor.id, { include: PUBLIC_INCLUDE });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to create vendor listing' });
  }
};

// POST /api/vendors/:id/claim
exports.claimVendor = async (req, res) => {
  try {
    if (req.user.userType !== 'business') {
      return res.status(403).json({ success: false, message: 'Only business accounts can claim a listing' });
    }

    const vendor = await Vendor.findByPk(req.params.id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    if (vendor.ownerUserId) {
      return res.status(409).json({ success: false, message: 'This business has already been claimed' });
    }

    const existingClaim = await Vendor.findOne({ where: { ownerUserId: req.user.id } });
    if (existingClaim) {
      return res.status(409).json({ success: false, message: 'Your business account already manages a listing' });
    }

    await vendor.update({
      ownerUserId: req.user.id,
      verificationStatus: 'pending',
      claimedAt: new Date(),
    });

    await recalculateVendorStats(vendor.id);

    const updated = await Vendor.findByPk(vendor.id, { include: PUBLIC_INCLUDE });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Claim vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to claim vendor' });
  }
};

// PUT /api/vendors/:id
exports.updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByPk(req.params.id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    if (vendor.ownerUserId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the owner can update this listing' });
    }

    const editable = [
      'name', 'primaryPlatform', 'handle', 'categoryId', 'cityId', 'address',
      'description', 'logoUrl', 'coverUrl', 'phone', 'whatsapp', 'businessHours',
    ];
    const updates = {};
    editable.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    await vendor.update(updates);

    const updated = await Vendor.findByPk(vendor.id, { include: PUBLIC_INCLUDE });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to update vendor' });
  }
};

// POST /api/vendors/:id/report-fraud
exports.reportFraud = async (req, res) => {
  try {
    const { reasonTag, description } = req.body;

    const vendor = await Vendor.findByPk(req.params.id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    await FraudReport.create({
      vendorId: vendor.id,
      reporterId: req.user.id,
      reasonTag,
      description: description || null,
    });

    await recalculateVendorFraudStats(vendor.id);

    res.status(201).json({ success: true, message: 'Report submitted for review' });
  } catch (error) {
    console.error('Report fraud error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit fraud report' });
  }
};

// GET /api/vendors/mine/owned — the business account's own claimed listing
exports.getMyVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { ownerUserId: req.user.id },
      include: PUBLIC_INCLUDE,
    });

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'No claimed listing found for this account' });
    }

    res.json({ success: true, data: vendor });
  } catch (error) {
    console.error('Get my vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to get vendor' });
  }
};
