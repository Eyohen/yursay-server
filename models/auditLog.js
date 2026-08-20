'use strict';

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Admins',
        key: 'id'
      }
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    entity: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    previousData: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    newData: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'AuditLogs',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['adminId'] },
      { fields: ['entity'] },
      { fields: ['entityId'] },
      { fields: ['action'] },
      { fields: ['createdAt'] }
    ]
  });

  AuditLog.associate = function(models) {
    AuditLog.belongsTo(models.Admin, {
      foreignKey: 'adminId',
      as: 'admin'
    });
  };

  // Audit action types
  AuditLog.ACTIONS = {
    // User actions
    USER_SUSPENDED: 'user_suspended',
    USER_ACTIVATED: 'user_activated',

    // Vendor actions
    VENDOR_VERIFIED: 'vendor_verified',
    VENDOR_REJECTED: 'vendor_rejected',
    VENDOR_SUSPENDED: 'vendor_suspended',

    // Review moderation actions
    REVIEW_APPROVED: 'review_approved',
    REVIEW_REMOVED: 'review_removed',
    REVIEW_ESCALATED: 'review_escalated',

    // Fraud actions
    VENDOR_BLACKLISTED: 'vendor_blacklisted',
    VENDOR_WARNED: 'vendor_warned',
    VENDOR_CASE_MONITORED: 'vendor_case_monitored',
    VENDOR_CASE_INVESTIGATED: 'vendor_case_investigated',
    VENDOR_CASE_DISMISSED: 'vendor_case_dismissed',
    VENDOR_INFO_REQUESTED: 'vendor_info_requested',

    // Settings actions
    CATEGORY_CREATED: 'category_created',
    CATEGORY_UPDATED: 'category_updated',
    CATEGORY_DELETED: 'category_deleted',
    PLATFORM_SETTINGS_UPDATED: 'platform_settings_updated',

    // Admin actions
    ADMIN_LOGIN: 'admin_login',
    ADMIN_LOGOUT: 'admin_logout',
    ADMIN_CREATED: 'admin_created',
    ADMIN_UPDATED: 'admin_updated'
  };

  return AuditLog;
};
