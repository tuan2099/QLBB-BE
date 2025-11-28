'use strict';

module.exports = (sequelize, DataTypes) => {
  const InventoryBalance = sequelize.define('InventoryBalance', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    warehouse_id: {
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
    tableName: 'inventory_balances',
    underscored: true,
    timestamps: true,
  });

  return InventoryBalance;
};
