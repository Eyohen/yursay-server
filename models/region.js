'use strict';

module.exports = (sequelize, DataTypes) => {
  const Region = sequelize.define('Region', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'Regions',
    timestamps: true
  });

  Region.associate = function(models) {
    Region.hasMany(models.State, {
      foreignKey: 'regionId',
      as: 'states'
    });
  };

  return Region;
};
