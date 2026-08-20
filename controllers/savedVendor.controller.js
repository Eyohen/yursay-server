const db = require('../models');
const { SavedVendor, Vendor, Category, City } = db;

// GET /api/saved-vendors
exports.getSavedVendors = async (req, res) => {
  try {
    const saved = await SavedVendor.findAll({
      where: { userId: req.user.id },
      include: [{ model: Vendor, as: 'vendor', include: [{ model: Category, as: 'category' }, { model: City, as: 'city' }] }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: saved });
  } catch (error) {
    console.error('Get saved vendors error:', error);
    res.status(500).json({ success: false, message: 'Failed to get saved vendors' });
  }
};

// POST /api/saved-vendors/:vendorId
exports.saveVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findByPk(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const [saved, created] = await SavedVendor.findOrCreate({
      where: { userId: req.user.id, vendorId },
      defaults: { notes: req.body.notes || null },
    });

    res.status(created ? 201 : 200).json({ success: true, data: saved });
  } catch (error) {
    console.error('Save vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to save vendor' });
  }
};

// DELETE /api/saved-vendors/:vendorId
exports.unsaveVendor = async (req, res) => {
  try {
    await SavedVendor.destroy({ where: { userId: req.user.id, vendorId: req.params.vendorId } });
    res.json({ success: true, message: 'Removed from saved vendors' });
  } catch (error) {
    console.error('Unsave vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to unsave vendor' });
  }
};
