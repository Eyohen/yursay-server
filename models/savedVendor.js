'use strict';

module.exports = (sequelize, DataTypes) => {
  const SavedVendor = sequelize.define('SavedVendor', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    vendorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Vendors',
        key: 'id'
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'SavedVendors',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['vendorId'] },
      { fields: ['userId', 'vendorId'], unique: true }
    ]
  });

  SavedVendor.associate = function(models) {
    SavedVendor.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    SavedVendor.belongsTo(models.Vendor, {
      foreignKey: 'vendorId',
      as: 'vendor'
    });
  };

  return SavedVendor;
};
