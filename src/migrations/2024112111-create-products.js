'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('products', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      sku: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      unit: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      image_url: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      size: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      product_group: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      specification: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      min_quantity: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      max_quantity: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      company: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      supplier_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      warehouse_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('products', ['supplier_id']);
    await queryInterface.addIndex('products', ['warehouse_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('products');
  },
};
