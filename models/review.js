'use strict';

module.exports = (sequelize, DataTypes) => {
  const Review = sequelize.define('Review', {
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
    reviewerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5
      }
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING(50)),
      defaultValue: []
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    isAnonymous: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    orderedPhotoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    gotPhotoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    additionalPhotos: {
      type: DataTypes.ARRAY(DataTypes.STRING(500)),
      defaultValue: []
    },
    vendorResponse: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    vendorRespondedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    helpfulCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('published', 'pending', 'removed'),
      defaultValue: 'published'
    },
    flagReason: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    flaggedById: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    }
  }, {
    tableName: 'Reviews',
    timestamps: true,
    indexes: [
      { fields: ['vendorId'] },
      { fields: ['reviewerId'] },
      { fields: ['status'] },
      { fields: ['rating'] }
    ]
  });

  Review.associate = function(models) {
    Review.belongsTo(models.Vendor, {
      foreignKey: 'vendorId',
      as: 'vendor'
    });
    Review.belongsTo(models.User, {
      foreignKey: 'reviewerId',
      as: 'reviewer'
    });
    Review.belongsTo(models.User, {
      foreignKey: 'flaggedById',
      as: 'flaggedBy'
    });
  };

  return Review;
};
