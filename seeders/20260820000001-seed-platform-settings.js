'use strict';
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.sequelize.query(
      'SELECT id FROM "PlatformSettings" LIMIT 1'
    );
    if (existing[0].length > 0) return;

    await queryInterface.bulkInsert('PlatformSettings', [{
      id: uuidv4(),
      autoFlagSuspiciousReviews: true,
      requirePhotoForOneStarReviews: false,
      autoFlagThreshold: 3,
      allowNewRegistrations: true,
      allowBusinessClaims: true,
      maintenanceMode: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('PlatformSettings', null, {});
  }
};
