'use strict';

module.exports = (sequelize, DataTypes) => {
  const StockTakeItem = sequelize.define(
    'StockTakeItem',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      stock_take_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      product_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      system_quantity: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
      },
      actual_quantity: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
      },
      difference: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'stock_take_items',
      underscored: true,
      timestamps: true,
    }
  );

  return StockTakeItem;
};
