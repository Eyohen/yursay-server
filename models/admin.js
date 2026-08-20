'use strict';

module.exports = (sequelize, DataTypes) => {
  const Admin = sequelize.define('Admin', {
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
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('super_admin', 'admin', 'moderator', 'support'),
      defaultValue: 'admin'
    },
    permissions: {
      type: DataTypes.JSONB,
      defaultValue: {
        reviews: { read: true, moderate: false },
        users: { read: true, suspend: false },
        vendors: { read: true, verify: false },
        fraudReports: { read: true, act: false },
        settings: { read: true, write: false },
        team: { read: true, invite: false }
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active'
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    refreshToken: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    resetPasswordToken: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'Admins',
    timestamps: true
  });

  Admin.associate = function(models) {
    Admin.hasMany(models.AuditLog, {
      foreignKey: 'adminId',
      as: 'auditLogs'
    });
  };

  return Admin;
};
