'use strict';

module.exports = (sequelize, DataTypes) => {
  const StockIn = sequelize.define('StockIn', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    warehouse_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    supplier_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    note: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    received_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    stock_in_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    creator_signature: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'confirmed',
    },
    created_by: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
  }, {
    tableName: 'stock_ins',
    underscored: true,
    timestamps: true,
    paranoid: true,
    deletedAt: 'deleted_at',
  });

  return StockIn;
};
