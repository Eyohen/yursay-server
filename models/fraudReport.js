'use strict';

module.exports = (sequelize, DataTypes) => {
  const FraudReport = sequelize.define('FraudReport', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    vendorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Vendors',
        key: 'id'
      }
    },
    reporterId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    reasonTag: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'FraudReports',
    timestamps: true,
    indexes: [
      { fields: ['vendorId'] },
      { fields: ['reasonTag'] }
    ]
  });

  FraudReport.associate = function(models) {
    FraudReport.belongsTo(models.Vendor, {
      foreignKey: 'vendorId',
      as: 'vendor'
    });
    FraudReport.belongsTo(models.User, {
      foreignKey: 'reporterId',
      as: 'reporter'
    });
  };

  return FraudReport;
};
