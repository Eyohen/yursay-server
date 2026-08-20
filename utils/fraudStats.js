const db = require('../models');

/**
 * Rolls up a vendor's open FraudReports into its fraudSeverity/fraudCaseStatus
 * fields. Called after a new FraudReport is created. Admin case actions
 * (investigate/monitor/resolve/dismiss/blacklist) set fraudCaseStatus
 * directly and do not go through this function.
 */
const recalculateVendorFraudStats = async (vendorId) => {
  const { Vendor, FraudReport } = db;

  const vendor = await Vendor.findByPk(vendorId);
  if (!vendor) return null;

  const reportCount = await FraudReport.count({ where: { vendorId } });

  let fraudSeverity = 'low';
  if (reportCount >= 10) fraudSeverity = 'high';
  else if (reportCount >= 3) fraudSeverity = 'medium';

  const fraudCaseStatus = vendor.fraudCaseStatus === 'none' ? 'open' : vendor.fraudCaseStatus;

  await vendor.update({ fraudSeverity, fraudCaseStatus });

  return { reportCount, fraudSeverity, fraudCaseStatus };
};

module.exports = { recalculateVendorFraudStats };
