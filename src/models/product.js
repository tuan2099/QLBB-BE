'use strict';

module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define('Product', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    sku: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    unit: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    supplier_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    warehouse_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    image_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    size: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    product_group: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    specification: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    min_quantity: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    max_quantity: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    company: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  }, {
    tableName: 'products',
    underscored: true,
    timestamps: true,
  });

  return Product;
};
