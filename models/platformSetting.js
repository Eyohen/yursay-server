'use strict';

module.exports = (sequelize, DataTypes) => {
  const PlatformSetting = sequelize.define('PlatformSetting', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    autoFlagSuspiciousReviews: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    requirePhotoForOneStarReviews: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    autoFlagThreshold: {
      type: DataTypes.INTEGER,
      defaultValue: 3
    },
    allowNewRegistrations: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    allowBusinessClaims: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    maintenanceMode: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'PlatformSettings',
    timestamps: true
  });

  return PlatformSetting;
};
