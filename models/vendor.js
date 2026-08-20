'use strict';

module.exports = (sequelize, DataTypes) => {
  const Vendor = sequelize.define('Vendor', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    primaryPlatform: {
      type: DataTypes.ENUM('instagram', 'tiktok', 'facebook', 'whatsapp', 'twitter', 'other'),
      allowNull: true
    },
    handle: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Categories',
        key: 'id'
      }
    },
    cityId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Cities',
        key: 'id'
      }
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    logoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    coverUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    whatsapp: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    businessHours: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    verificationStatus: {
      type: DataTypes.ENUM('unclaimed', 'pending', 'verified', 'rejected'),
      defaultValue: 'unclaimed'
    },
    ownerUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    claimedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    createdByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended'),
      defaultValue: 'active'
    },
    avgRating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0
    },
    reviewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    trustScore: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    trustSignals: {
      type: DataTypes.JSONB,
      defaultValue: {
        verifiedReviewerPct: 0,
        ownerResponseRatePct: 0,
        recencyPct: 0,
        fraudSignalsClear: true
      }
    },
    isBlacklisted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    blacklistedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    blacklistReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    fraudCaseStatus: {
      type: DataTypes.ENUM('none', 'open', 'investigating', 'monitoring', 'resolved', 'dismissed'),
      defaultValue: 'none'
    },
    fraudSeverity: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: true
    }
  }, {
    tableName: 'Vendors',
    timestamps: true,
    indexes: [
      { fields: ['handle'] },
      { fields: ['categoryId'] },
      { fields: ['cityId'] },
      { fields: ['verificationStatus'] },
      { fields: ['name'] },
      { fields: ['fraudCaseStatus'] }
    ]
  });

  Vendor.associate = function(models) {
    Vendor.belongsTo(models.Category, {
      foreignKey: 'categoryId',
      as: 'category'
    });
    Vendor.belongsTo(models.City, {
      foreignKey: 'cityId',
      as: 'city'
    });
    Vendor.belongsTo(models.User, {
      foreignKey: 'ownerUserId',
      as: 'owner'
    });
    Vendor.belongsTo(models.User, {
      foreignKey: 'createdByUserId',
      as: 'createdBy'
    });
    Vendor.hasMany(models.Review, {
      foreignKey: 'vendorId',
      as: 'reviews'
    });
    Vendor.hasMany(models.SavedVendor, {
      foreignKey: 'vendorId',
      as: 'savedBy'
    });
    Vendor.hasMany(models.FraudReport, {
      foreignKey: 'vendorId',
      as: 'fraudReports'
    });
  };

  return Vendor;
};
