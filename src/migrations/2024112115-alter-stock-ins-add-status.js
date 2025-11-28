'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('stock_ins', 'status', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'confirmed',
      after: 'note',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('stock_ins', 'status');
  },
};
