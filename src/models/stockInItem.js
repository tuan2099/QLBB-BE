'use strict';

module.exports = (sequelize, DataTypes) => {
  const StockInItem = sequelize.define('StockInItem', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    stock_in_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    product_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: 'stock_in_items',
    underscored: true,
    timestamps: true,
  });

  return StockInItem;
};
