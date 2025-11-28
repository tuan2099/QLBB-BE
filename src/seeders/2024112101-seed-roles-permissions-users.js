'use strict';
const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Permissions
      const now = new Date();
      const permissions = [
        // USER (giữ nguyên)
        { name: 'user.read', description: 'Xem danh sách / chi tiết user', created_at: now, updated_at: now },
        { name: 'user.create', description: 'Tạo user mới', created_at: now, updated_at: now },
        { name: 'user.update', description: 'Cập nhật user', created_at: now, updated_at: now },
        { name: 'user.delete', description: 'Xóa user', created_at: now, updated_at: now },

        // INVENTORY chung (giữ cho tương thích ngược)
        { name: 'inventory.read', description: 'Xem dữ liệu kho tổng quát', created_at: now, updated_at: now },
        { name: 'inventory.create', description: 'Tạo chứng từ kho (nhập/xuất/chuyển/kiểm)', created_at: now, updated_at: now },
        { name: 'inventory.update', description: 'Sửa chứng từ / tồn kho', created_at: now, updated_at: now },
        { name: 'inventory.delete', description: 'Xóa chứng từ / điều chỉnh kho', created_at: now, updated_at: now },

        // WAREHOUSE
        { name: 'warehouse.read', description: 'Xem danh sách / chi tiết kho', created_at: now, updated_at: now },
        { name: 'warehouse.create', description: 'Tạo kho mới', created_at: now, updated_at: now },
        { name: 'warehouse.update', description: 'Cập nhật thông tin kho', created_at: now, updated_at: now },
        { name: 'warehouse.delete', description: 'Xóa kho', created_at: now, updated_at: now },

        // SUPPLIER
        { name: 'supplier.read', description: 'Xem danh sách / chi tiết nhà cung cấp', created_at: now, updated_at: now },
        { name: 'supplier.create', description: 'Tạo nhà cung cấp mới', created_at: now, updated_at: now },
        { name: 'supplier.update', description: 'Cập nhật nhà cung cấp', created_at: now, updated_at: now },
        { name: 'supplier.delete', description: 'Xóa nhà cung cấp', created_at: now, updated_at: now },

        // CUSTOMER
        { name: 'customer.read', description: 'Xem danh sách / chi tiết khách hàng', created_at: now, updated_at: now },
        { name: 'customer.create', description: 'Tạo khách hàng mới', created_at: now, updated_at: now },
        { name: 'customer.update', description: 'Cập nhật khách hàng', created_at: now, updated_at: now },
        { name: 'customer.delete', description: 'Xóa khách hàng', created_at: now, updated_at: now },

        // PRODUCT
        { name: 'product.read', description: 'Xem danh sách / chi tiết sản phẩm', created_at: now, updated_at: now },
        { name: 'product.create', description: 'Tạo sản phẩm mới', created_at: now, updated_at: now },
        { name: 'product.update', description: 'Cập nhật sản phẩm', created_at: now, updated_at: now },
        { name: 'product.delete', description: 'Xóa sản phẩm', created_at: now, updated_at: now },

        // STOCK IN
        { name: 'stock_in.read', description: 'Xem danh sách / chi tiết phiếu nhập kho', created_at: now, updated_at: now },
        { name: 'stock_in.create', description: 'Tạo phiếu nhập kho', created_at: now, updated_at: now },
        { name: 'stock_in.update', description: 'Cập nhật phiếu nhập kho', created_at: now, updated_at: now },
        { name: 'stock_in.delete', description: 'Xóa / xoá vĩnh viễn phiếu nhập kho', created_at: now, updated_at: now },

        // STOCK OUT
        { name: 'stock_out.read', description: 'Xem danh sách / chi tiết phiếu xuất kho', created_at: now, updated_at: now },
        { name: 'stock_out.create', description: 'Tạo phiếu xuất kho', created_at: now, updated_at: now },
        { name: 'stock_out.update', description: 'Cập nhật phiếu xuất kho', created_at: now, updated_at: now },
        { name: 'stock_out.delete', description: 'Xóa / xoá vĩnh viễn phiếu xuất kho', created_at: now, updated_at: now },

        // STOCK TRANSFER
        { name: 'stock_transfer.read', description: 'Xem danh sách / chi tiết phiếu chuyển kho', created_at: now, updated_at: now },
        { name: 'stock_transfer.create', description: 'Tạo phiếu chuyển kho', created_at: now, updated_at: now },
        { name: 'stock_transfer.update', description: 'Cập nhật phiếu chuyển kho', created_at: now, updated_at: now },
        { name: 'stock_transfer.delete', description: 'Xóa / xoá vĩnh viễn phiếu chuyển kho', created_at: now, updated_at: now },

        // STOCK TAKE
        { name: 'stock_take.read', description: 'Xem danh sách / chi tiết phiếu kiểm kho', created_at: now, updated_at: now },
        { name: 'stock_take.create', description: 'Tạo phiếu kiểm kho', created_at: now, updated_at: now },
        { name: 'stock_take.update', description: 'Cập nhật phiếu kiểm kho', created_at: now, updated_at: now },
        { name: 'stock_take.delete', description: 'Xóa / xoá vĩnh viễn phiếu kiểm kho', created_at: now, updated_at: now },

        // ACTIVITY LOG & RBAC
        { name: 'activity.read', description: 'Xem nhật ký hoạt động (Activity Log)', created_at: now, updated_at: now },
        { name: 'rbac.read', description: 'Xem phân quyền (RBAC)', created_at: now, updated_at: now },
        { name: 'rbac.update', description: 'Cập nhật phân quyền (RBAC)', created_at: now, updated_at: now },
      ];

      await queryInterface.bulkInsert('permissions', permissions, { transaction });

      const [permRows] = await queryInterface.sequelize.query('SELECT id, name FROM permissions', { transaction });

      // Roles
      await queryInterface.bulkInsert(
        'roles',
        [
          { name: 'admin', description: 'System administrator', created_at: now, updated_at: now },
          { name: 'staff', description: 'Nhân viên kho', created_at: now, updated_at: now },
        ],
        { transaction }
      );

      const [roleRows] = await queryInterface.sequelize.query('SELECT id, name FROM roles', { transaction });
      const adminRole = roleRows.find((r) => r.name === 'admin');
      const staffRole = roleRows.find((r) => r.name === 'staff');

      // Role-Permissions
      const rolePermissions = [];
      // admin: tất cả permissions
      permRows.forEach((p) => {
        rolePermissions.push({
          role_id: adminRole.id,
          permission_id: p.id,
          created_at: now,
          updated_at: now,
        });
      });

      // staff: một số permission (chủ yếu thao tác kho)
      const staffPermNames = [
        // master data (chỉ quyền đọc)
        'warehouse.read',
        'supplier.read',
        'customer.read',
        'product.read',

        // phiếu nhập kho
        'stock_in.read',
        'stock_in.create',
        'stock_in.update',

        // phiếu xuất kho
        'stock_out.read',
        'stock_out.create',
        'stock_out.update',

        // phiếu chuyển kho
        'stock_transfer.read',
        'stock_transfer.create',
        'stock_transfer.update',

        // phiếu kiểm kho
        'stock_take.read',
        'stock_take.create',
        'stock_take.update',
      ];
      permRows
        .filter((p) => staffPermNames.includes(p.name))
        .forEach((p) => {
          rolePermissions.push({
            role_id: staffRole.id,
            permission_id: p.id,
            created_at: now,
            updated_at: now,
          });
        });

      await queryInterface.bulkInsert('role_permissions', rolePermissions, { transaction });

      // Admin user
      const adminUsername = 'admin';
      const adminEmail = 'admin@example.com';
      const adminPassword = '123456';
      const passwordHash = await bcrypt.hash(adminPassword, 10);

      await queryInterface.bulkInsert(
        'users',
        [
          {
            username: adminUsername,
            email: adminEmail,
            password: passwordHash,
            is_active: true,
            created_at: now,
            updated_at: now,
          },
        ],
        { transaction }
      );

      const [userRows] = await queryInterface.sequelize.query('SELECT id, username FROM users WHERE username = "admin"', { transaction });
      const adminUser = userRows[0];

      await queryInterface.bulkInsert(
        'user_roles',
        [
          {
            user_id: adminUser.id,
            role_id: adminRole.id,
            created_at: now,
            updated_at: now,
          },
        ],
        { transaction }
      );

      // Sample master data for testing inventory flows
      await queryInterface.bulkInsert(
        'warehouses',
        [
          { code: 'WH-001', name: 'Kho Trung Tâm', address: 'Hà Nội', created_at: now, updated_at: now },
          { code: 'WH-002', name: 'Kho Miền Nam', address: 'TP. HCM', created_at: now, updated_at: now },
        ],
        { transaction }
      );

      await queryInterface.bulkInsert(
        'suppliers',
        [
          {
            name: 'Nhà cung cấp A',
            contact_name: 'Anh A',
            email: 'supplierA@example.com',
            phone: '0900000001',
            address: 'Hà Nội',
            created_at: now,
            updated_at: now,
          },
          {
            name: 'Nhà cung cấp B',
            contact_name: 'Chị B',
            email: 'supplierB@example.com',
            phone: '0900000002',
            address: 'TP. HCM',
            created_at: now,
            updated_at: now,
          },
        ],
        { transaction }
      );

      await queryInterface.bulkInsert(
        'customers',
        [
          {
            name: 'Khách hàng 1',
            email: 'customer1@example.com',
            phone: '0910000001',
            address: 'Đà Nẵng',
            pm: 'Anh PM 1',
            category: 'VIP',
            branch: 'Miền Trung',
            status: 'active',
            created_at: now,
            updated_at: now,
          },
          {
            name: 'Khách hàng 2',
            email: 'customer2@example.com',
            phone: '0910000002',
            address: 'Cần Thơ',
            pm: 'Chị PM 2',
            category: 'Normal',
            branch: 'Miền Tây',
            status: 'active',
            created_at: now,
            updated_at: now,
          },
        ],
        { transaction }
      );

      const [warehouseRows] = await queryInterface.sequelize.query(
        'SELECT id, code, name FROM warehouses ORDER BY id ASC',
        { transaction }
      );
      const [supplierRows] = await queryInterface.sequelize.query(
        'SELECT id, name FROM suppliers ORDER BY id ASC',
        { transaction }
      );
      const [customerRows] = await queryInterface.sequelize.query(
        'SELECT id, name, email FROM customers ORDER BY id ASC',
        { transaction }
      );

      const wh1 = warehouseRows[0];
      const wh2 = warehouseRows[1] || warehouseRows[0];
      const sup1 = supplierRows[0];
      const cust1 = customerRows[0];

      await queryInterface.bulkInsert(
        'products',
        [
          {
            name: 'Sản phẩm 1',
            sku: 'SP-001',
            description: 'Sản phẩm test 1',
            unit: 'cái',
            size: 'M',
            product_group: 'Nhóm A',
            specification: 'Spec 1',
            warehouse_id: wh1 ? wh1.id : null,
            supplier_id: sup1 ? sup1.id : null,
            status: 'active',
            created_at: now,
            updated_at: now,
          },
          {
            name: 'Sản phẩm 2',
            sku: 'SP-002',
            description: 'Sản phẩm test 2',
            unit: 'cái',
            size: 'L',
            product_group: 'Nhóm A',
            specification: 'Spec 2',
            warehouse_id: wh2 ? wh2.id : null,
            supplier_id: sup1 ? sup1.id : null,
            status: 'active',
            created_at: now,
            updated_at: now,
          },
        ],
        { transaction }
      );

      const [productRows] = await queryInterface.sequelize.query(
        'SELECT id, sku FROM products WHERE sku IN ("SP-001", "SP-002") ORDER BY id ASC',
        { transaction }
      );

      const prod1 = productRows[0];
      const prod2 = productRows[1] || productRows[0];

      // Sample stock-in (confirmed, có hàng trong kho)
      await queryInterface.bulkInsert(
        'stock_ins',
        [
          {
            code: 'SI-TEST-001',
            warehouse_id: wh1 ? wh1.id : null,
            supplier_id: sup1 ? sup1.id : null,
            note: 'Phiếu nhập kho seed dữ liệu',
            received_date: now,
            stock_in_type: 'normal',
            creator_signature: null,
            status: 'confirmed',
            created_by: adminUser.id,
            created_at: now,
            updated_at: now,
          },
        ],
        { transaction }
      );

      const [stockInRows] = await queryInterface.sequelize.query(
        'SELECT id, code FROM stock_ins WHERE code = "SI-TEST-001"',
        { transaction }
      );
      const stockIn1 = stockInRows[0];

      await queryInterface.bulkInsert(
        'stock_in_items',
        [
          {
            stock_in_id: stockIn1.id,
            product_id: prod1 ? prod1.id : null,
            quantity: 100,
            created_at: now,
            updated_at: now,
          },
          {
            stock_in_id: stockIn1.id,
            product_id: prod2 ? prod2.id : null,
            quantity: 50,
            created_at: now,
            updated_at: now,
          },
        ],
        { transaction }
      );

      // Sample stock-out (draft, chưa ký nhận)
      await queryInterface.bulkInsert(
        'stock_outs',
        [
          {
            code: 'SO-TEST-001',
            warehouse_id: wh1 ? wh1.id : null,
            customer_id: cust1 ? cust1.id : null,
            note: 'Phiếu xuất kho seed dữ liệu',
            receiver_name: cust1 ? cust1.name : 'Khách hàng test',
            receiver_email: cust1 ? cust1.email : 'customer@example.com',
            receiver_signed_at: null,
            receiver_signature_url: null,
            receiver_signature_type: null,
            receive_sign_token: null,
            receive_sign_token_expires_at: null,
            receive_sign_token_used: false,
            status: 'draft',
            created_by: adminUser.id,
            created_at: now,
            updated_at: now,
          },
        ],
        { transaction }
      );

      const [stockOutRows] = await queryInterface.sequelize.query(
        'SELECT id, code FROM stock_outs WHERE code = "SO-TEST-001"',
        { transaction }
      );
      const stockOut1 = stockOutRows[0];

      await queryInterface.bulkInsert(
        'stock_out_items',
        [
          {
            stock_out_id: stockOut1.id,
            product_id: prod1 ? prod1.id : null,
            quantity: 10,
            created_at: now,
            updated_at: now,
          },
          {
            stock_out_id: stockOut1.id,
            product_id: prod2 ? prod2.id : null,
            quantity: 5,
            created_at: now,
            updated_at: now,
          },
        ],
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.bulkDelete('user_roles', null, { transaction });
      await queryInterface.bulkDelete('users', { username: 'admin' }, { transaction });
      await queryInterface.bulkDelete('role_permissions', null, { transaction });
      await queryInterface.bulkDelete('roles', { name: ['admin', 'staff'] }, { transaction });
      await queryInterface.bulkDelete('permissions', null, { transaction });

      // Master data cleanup
      await queryInterface.bulkDelete('products', { sku: ['SP-001', 'SP-002'] }, { transaction });
      await queryInterface.bulkDelete('customers', { email: ['customer1@example.com', 'customer2@example.com'] }, { transaction });
      await queryInterface.bulkDelete('suppliers', { email: ['supplierA@example.com', 'supplierB@example.com'] }, { transaction });
      await queryInterface.bulkDelete('warehouses', { name: ['Kho Trung Tâm', 'Kho Miền Nam'] }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
