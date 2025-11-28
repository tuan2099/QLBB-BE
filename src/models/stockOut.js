'use strict';

module.exports = (sequelize, DataTypes) => {
  const StockOut = sequelize.define('StockOut', {
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
    customer_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    note: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    receiver_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    receiver_email: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    receiver_signed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    receiver_signature_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    receiver_signature_type: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    receive_sign_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    receive_sign_token_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    receive_sign_token_used: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'draft',
    },
    created_by: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
  }, {
    tableName: 'stock_outs',
    underscored: true,
    timestamps: true,
    paranoid: true,
    deletedAt: 'deleted_at',
  });

  return StockOut;
};
