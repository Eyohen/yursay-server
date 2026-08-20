const db = require('../models');
const { Region, State, City, Category, Vendor } = db;

// Get regions
exports.getRegions = async (req, res) => {
  try {
    const regions = await Region.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: regions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get regions' });
  }
};

// Get all states
exports.getStates = async (req, res) => {
  try {
    const states = await State.findAll({
      where: { isActive: true },
      include: [{ model: Region, as: 'region' }],
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: states });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get states' });
  }
};

// Get states by region
exports.getStatesByRegion = async (req, res) => {
  try {
    const { regionId } = req.params;
    const states = await State.findAll({
      where: { regionId, isActive: true },
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: states });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get states' });
  }
};

// Get all cities
exports.getCities = async (req, res) => {
  try {
    const cities = await City.findAll({
      where: { isActive: true },
      include: [{ model: State, as: 'state' }],
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: cities });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get cities' });
  }
};

// Get cities by state
exports.getCitiesByState = async (req, res) => {
  try {
    const { stateId } = req.params;
    const cities = await City.findAll({
      where: { stateId, isActive: true },
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: cities });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get cities' });
  }
};

// Get categories (with vendor counts)
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });

    const counts = await Vendor.findAll({
      where: { status: 'active' },
      attributes: ['categoryId', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: ['categoryId'],
      raw: true,
    });
    const countByCategoryId = Object.fromEntries(counts.map((c) => [c.categoryId, Number(c.count)]));

    const data = categories.map((c) => ({ ...c.toJSON(), vendorCount: countByCategoryId[c.id] || 0 }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get categories' });
  }
};

// Get category by ID
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get category' });
  }
};
