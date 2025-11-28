'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('stock_outs', {
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
      customer_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      note: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      receiver_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      receiver_email: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      receiver_signed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      receiver_signature_url: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      receiver_signature_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      receive_sign_token: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      receive_sign_token_expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      receive_sign_token_used: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'confirmed',
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

    await queryInterface.addIndex('stock_outs', ['warehouse_id']);
    await queryInterface.addIndex('stock_outs', ['customer_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stock_outs');
  },
};
