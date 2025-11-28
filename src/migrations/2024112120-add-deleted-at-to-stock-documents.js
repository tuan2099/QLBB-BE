'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('stock_ins', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('stock_outs', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('stock_transfers', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('stock_ins', 'deleted_at');
    await queryInterface.removeColumn('stock_outs', 'deleted_at');
    await queryInterface.removeColumn('stock_transfers', 'deleted_at');
  },
};
