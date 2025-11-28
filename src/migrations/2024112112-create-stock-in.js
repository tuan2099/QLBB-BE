'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('stock_ins', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      warehouse_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      supplier_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      note: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      received_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      stock_in_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      creator_signature: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      created_by: {
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

    await queryInterface.addIndex('stock_ins', ['warehouse_id']);
    await queryInterface.addIndex('stock_ins', ['supplier_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stock_ins');
  },
};
