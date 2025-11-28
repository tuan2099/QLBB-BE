'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('customers', 'pm', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('customers', 'category', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('customers', 'branch', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('customers', 'total_spent', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('customers', 'representative', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('customers', 'status', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'active',
    });
    await queryInterface.addColumn('customers', 'assignee_user_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('customers', 'notes', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('customers', 'notes');
    await queryInterface.removeColumn('customers', 'assignee_user_id');
    await queryInterface.removeColumn('customers', 'status');
    await queryInterface.removeColumn('customers', 'representative');
    await queryInterface.removeColumn('customers', 'total_spent');
    await queryInterface.removeColumn('customers', 'branch');
    await queryInterface.removeColumn('customers', 'category');
    await queryInterface.removeColumn('customers', 'pm');
  },
};
