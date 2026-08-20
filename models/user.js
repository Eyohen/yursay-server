'use strict';

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    userType: {
      type: DataTypes.ENUM('personal', 'business'),
      allowNull: false
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    verificationToken: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    verificationTokenExpires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    resetPasswordToken: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended', 'pending_verification'),
      defaultValue: 'pending_verification'
    },
    onboardingCompleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    onboardingStep: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    refreshToken: {
      type: DataTypes.STRING(500),
      allowNull: true
    }
  }, {
    tableName: 'Users',
    timestamps: true
  });

  User.associate = function(models) {
    User.hasOne(models.PersonalProfile, {
      foreignKey: 'userId',
      as: 'personalProfile'
    });
    User.hasOne(models.BusinessProfile, {
      foreignKey: 'userId',
      as: 'businessProfile'
    });
  };

  return User;
};
