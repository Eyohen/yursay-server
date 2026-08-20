'use strict';

const path = require('path');
const Sequelize = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.js')[env];
const db = {};

const activeModelFiles = [
  'user.js',
  'personalProfile.js',
  'businessProfile.js',
  'admin.js',
  'auditLog.js',
  'region.js',
  'state.js',
  'city.js',
  'category.js',
  'vendor.js',
  'review.js',
  'savedVendor.js',
  'fraudReport.js',
  'platformSetting.js',
];

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

activeModelFiles.forEach((file) => {
  const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
  db[model.name] = model;
});

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
