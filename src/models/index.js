'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = require('./user')(sequelize, DataTypes);
const Role = require('./role')(sequelize, DataTypes);
const Permission = require('./permission')(sequelize, DataTypes);
const UserRole = require('./userRole')(sequelize, DataTypes);
const RolePermission = require('./rolePermission')(sequelize, DataTypes);
const ActivityLog = require('./activityLog')(sequelize, DataTypes);
const RefreshToken = require('./refreshToken')(sequelize, DataTypes);
const Warehouse = require('./warehouse')(sequelize, DataTypes);
const Supplier = require('./supplier')(sequelize, DataTypes);
const Customer = require('./customer')(sequelize, DataTypes);
const Product = require('./product')(sequelize, DataTypes);
const StockIn = require('./stockIn')(sequelize, DataTypes);
const StockInItem = require('./stockInItem')(sequelize, DataTypes);
const InventoryBalance = require('./inventoryBalance')(sequelize, DataTypes);
const StockOut = require('./stockOut')(sequelize, DataTypes);
const StockOutItem = require('./stockOutItem')(sequelize, DataTypes);
const StockTransfer = require('./stockTransfer')(sequelize, DataTypes);
const StockTransferItem = require('./stockTransferItem')(sequelize, DataTypes);
const StockTake = require('./stockTake')(sequelize, DataTypes);
const StockTakeItem = require('./stockTakeItem')(sequelize, DataTypes);

// Associations
User.belongsToMany(Role, { through: UserRole, foreignKey: 'user_id' });
Role.belongsToMany(User, { through: UserRole, foreignKey: 'role_id' });

Role.belongsToMany(Permission, { through: RolePermission, foreignKey: 'role_id' });
Permission.belongsToMany(Role, { through: RolePermission, foreignKey: 'permission_id' });

User.hasMany(ActivityLog, { foreignKey: 'user_id' });
ActivityLog.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(RefreshToken, { foreignKey: 'user_id' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

Supplier.hasMany(Product, { foreignKey: 'supplier_id' });
Product.belongsTo(Supplier, { foreignKey: 'supplier_id' });

Warehouse.hasMany(Product, { foreignKey: 'warehouse_id' });
Product.belongsTo(Warehouse, { foreignKey: 'warehouse_id' });

Warehouse.hasMany(StockIn, { foreignKey: 'warehouse_id' });
StockIn.belongsTo(Warehouse, { foreignKey: 'warehouse_id' });

Supplier.hasMany(StockIn, { foreignKey: 'supplier_id' });
StockIn.belongsTo(Supplier, { foreignKey: 'supplier_id' });

User.hasMany(StockIn, { foreignKey: 'created_by' });
StockIn.belongsTo(User, { foreignKey: 'created_by' });

StockIn.hasMany(StockInItem, { foreignKey: 'stock_in_id' });
StockInItem.belongsTo(StockIn, { foreignKey: 'stock_in_id' });

Product.hasMany(StockInItem, { foreignKey: 'product_id' });
StockInItem.belongsTo(Product, { foreignKey: 'product_id' });

Warehouse.hasMany(InventoryBalance, { foreignKey: 'warehouse_id' });
InventoryBalance.belongsTo(Warehouse, { foreignKey: 'warehouse_id' });

Product.hasMany(InventoryBalance, { foreignKey: 'product_id' });
InventoryBalance.belongsTo(Product, { foreignKey: 'product_id' });

Warehouse.hasMany(StockOut, { foreignKey: 'warehouse_id' });
StockOut.belongsTo(Warehouse, { foreignKey: 'warehouse_id' });

Customer.hasMany(StockOut, { foreignKey: 'customer_id' });
StockOut.belongsTo(Customer, { foreignKey: 'customer_id' });

User.hasMany(StockOut, { foreignKey: 'created_by' });
StockOut.belongsTo(User, { foreignKey: 'created_by' });

StockOut.hasMany(StockOutItem, { foreignKey: 'stock_out_id' });
StockOutItem.belongsTo(StockOut, { foreignKey: 'stock_out_id' });

Product.hasMany(StockOutItem, { foreignKey: 'product_id' });
StockOutItem.belongsTo(Product, { foreignKey: 'product_id' });

Warehouse.hasMany(StockTransfer, { foreignKey: 'from_warehouse_id', as: 'StockTransfersFrom' });
Warehouse.hasMany(StockTransfer, { foreignKey: 'to_warehouse_id', as: 'StockTransfersTo' });
StockTransfer.belongsTo(Warehouse, { foreignKey: 'from_warehouse_id', as: 'FromWarehouse' });
StockTransfer.belongsTo(Warehouse, { foreignKey: 'to_warehouse_id', as: 'ToWarehouse' });

User.hasMany(StockTransfer, { foreignKey: 'created_by' });
StockTransfer.belongsTo(User, { foreignKey: 'created_by' });

StockTransfer.hasMany(StockTransferItem, { foreignKey: 'stock_transfer_id' });
StockTransferItem.belongsTo(StockTransfer, { foreignKey: 'stock_transfer_id' });

Product.hasMany(StockTransferItem, { foreignKey: 'product_id' });
StockTransferItem.belongsTo(Product, { foreignKey: 'product_id' });

Warehouse.hasMany(StockTake, { foreignKey: 'warehouse_id' });
StockTake.belongsTo(Warehouse, { foreignKey: 'warehouse_id' });

User.hasMany(StockTake, { foreignKey: 'created_by' });
StockTake.belongsTo(User, { foreignKey: 'created_by' });

StockTake.hasMany(StockTakeItem, { foreignKey: 'stock_take_id' });
StockTakeItem.belongsTo(StockTake, { foreignKey: 'stock_take_id' });

Product.hasMany(StockTakeItem, { foreignKey: 'product_id' });
StockTakeItem.belongsTo(Product, { foreignKey: 'product_id' });

module.exports = {
  sequelize,
  User,
  Role,
  Permission,
  UserRole,
  RolePermission,
  ActivityLog,
  RefreshToken,
  Warehouse,
  Supplier,
  Customer,
  Product,
  StockIn,
  StockInItem,
  InventoryBalance,
  StockOut,
  StockOutItem,
  StockTransfer,
  StockTransferItem,
  StockTake,
  StockTakeItem,
};
