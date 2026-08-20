'use strict';
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const categories = [
      { name: 'Food & Restaurants', slug: 'food-restaurants', icon: 'utensils', description: 'Restaurants, food vendors, and delivery' },
      { name: 'Fashion & Style', slug: 'fashion-style', icon: 'shirt', description: 'Clothing, footwear, and fashion vendors' },
      { name: 'Beauty & Wellness', slug: 'beauty-wellness', icon: 'sparkles', description: 'Skincare, cosmetics, and beauty services' },
      { name: 'Instagram Vendors', slug: 'instagram-vendors', icon: 'instagram', description: 'Vendors that sell primarily through Instagram' },
      { name: 'Logistics & Delivery', slug: 'logistics-delivery', icon: 'truck', description: 'Delivery, dispatch, and logistics services' },
      { name: 'Tech Services', slug: 'tech-services', icon: 'laptop', description: 'Device repair, tech support, and IT services' },
      { name: 'Home & Living', slug: 'home-living', icon: 'home', description: 'Furniture, decor, and household goods' },
      { name: 'Electronics', slug: 'electronics', icon: 'smartphone', description: 'Phones, gadgets, and electronics vendors' },
      { name: 'Fitness & Sports', slug: 'fitness-sports', icon: 'dumbbell', description: 'Gyms, trainers, and sports equipment' },
      { name: 'Education', slug: 'education', icon: 'graduationCap', description: 'Tutoring, courses, and educational services' },
      { name: 'Fintech & Finance', slug: 'fintech-finance', icon: 'landmark', description: 'Financial services and fintech products' },
      { name: 'Events & Parties', slug: 'events-parties', icon: 'partyPopper', description: 'Event planning, catering, and party vendors' },
    ];

    const categoryData = categories.map((c, index) => ({
      id: uuidv4(),
      name: c.name,
      slug: c.slug,
      description: c.description,
      icon: c.icon,
      parentId: null,
      displayOrder: index,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await queryInterface.bulkInsert('Categories', categoryData, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Categories', null, {});
  }
};
