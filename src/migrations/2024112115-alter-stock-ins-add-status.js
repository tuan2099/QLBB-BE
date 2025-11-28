'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('stock_ins');

    if (!table.status) {
      await queryInterface.addColumn('stock_ins', 'status', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'confirmed',
        after: 'note',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('stock_ins');

    if (table.status) {
      await queryInterface.removeColumn('stock_ins', 'status');
    }
  },
};
