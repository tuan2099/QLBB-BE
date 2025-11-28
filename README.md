## Asset Management System Backend (Node.js + MySQL + Sequelize)

Backend quản lý kho dùng Node.js, Express, Sequelize (MySQL) với các module:

- **Auth** với JWT (access/refresh), đổi mật khẩu.
- **RBAC** theo role/permission.
- **Activity log** mọi request đã đăng nhập.
- **Master data**: Kho, Sản phẩm, Khách hàng, Nhà cung cấp, User, Role, Permission.
- **Inventory**:
  - Nhập kho (stock-in).
  - Xuất kho (stock-out).
  - Chuyển kho (stock-transfer).
  - Bảng tồn `inventory_balances`.
- **Workflow phiếu**: `draft / confirmed / cancelled`.
- **Xoá mềm & xoá hẳn** cho phiếu in/out/transfer.

---

## 1. Công nghệ & Cấu trúc

- Node.js, Express.
- Sequelize ORM + MySQL.
- JWT (access token + refresh token).
- Thư mục chính:
  - `src/app.js`: khai báo Express app, middleware, routes.
  - `src/config/`: cấu hình DB.
  - `src/models/`: model Sequelize.
  - `src/migrations/`, `src/seeders/`: migrations & seeders (qua `sequelize-cli`).
  - `src/controllers/`: xử lý logic API.
  - `src/routes/`: định nghĩa router.

---

## 2. Auth & RBAC

### 2.1. Auth

Base path: `/auth`

- `POST /auth/register`  
  Đăng ký user mới (chỉ admin nên dùng endpoint này qua UI dành cho quản trị).

- `POST /auth/login`  
  Body: `{ "email": string, "password": string }`  
  Trả về: access token + refresh token.

- `POST /auth/logout`  
  Invalidate refresh token hiện tại.

- `POST /auth/refresh`  
  Đổi access token bằng refresh token hợp lệ.

- `POST /auth/change-password`  
  Đổi mật khẩu người dùng đang đăng nhập.

### 2.2. RBAC

Base paths:

- `/users` – CRUD user + gán role.
- `/roles` – CRUD role.
- `/rbac` – quản lý permission.

Các permission chính:

- `user.read`, `user.create`, `user.update`, `user.delete`.
- `role.read`, `role.create`, `role.update`, `role.delete`.
- `inventory.read`, `inventory.create`, `inventory.update`, `inventory.delete`.

Middleware:

- `authenticate` – parse JWT, lấy `req.user`.
- `requirePermission('permission.name')` – kiểm tra user có quyền tương ứng trước khi vào controller.

### 2.3. Activity Logs

- Mọi request đã authenticate được log vào bảng `activity_logs`:
  - user_id, method, path, status_code.
  - payload tóm tắt, IP, user-agent.
- Phục vụ audit & debugging.

---

## 3. Master Data APIs

Tất cả đều yêu cầu auth + RBAC (`inventory.*` hoặc `user.*`).

### 3.1. Warehouses

Base path: `/inventory/warehouses`

- `GET /` – list kho.
- `GET /:id` – chi tiết kho.
- `POST /` – tạo mới.
- `PUT /:id` – sửa.
- `DELETE /:id` – xóa.

### 3.2. Products

Base path: `/inventory/products`

- Có SKU unique, tên, đơn vị, liên kết nhà cung cấp.
- CRUD như warehouse.

### 3.3. Suppliers

Base path: `/inventory/suppliers`

CRUD đầy đủ.

### 3.4. Customers

Base path: `/inventory/customers`

CRUD đầy đủ.

### 3.5. Users / Roles / Permissions

- `GET /users`, `POST /users`, `PUT /users/:id`, `DELETE /users/:id`.
- `GET /roles`, `POST /roles`, `PUT /roles/:id`, `DELETE /roles/:id`.
- `/rbac/roles/:roleId/permissions` – gán permission cho role.

---

## 4. Inventory & Workflow Phiếu

### 4.1. Các bảng chính

- `stock_ins`, `stock_in_items` – Phiếu nhập.
- `stock_outs`, `stock_out_items` – Phiếu xuất.
- `stock_transfers`, `stock_transfer_items` – Phiếu chuyển kho.
- `inventory_balances` – bảng tồn kho hiện tại theo `warehouse_id + product_id`.

Mỗi phiếu có các trường chung:

- `code`: mã phiếu, unique.
- `status`: `draft | confirmed | cancelled`.
- `created_by`: user tạo.
- Liên kết đến kho (hoặc từ kho/đến kho), khách hàng/nhà cung cấp.

### 4.2. Workflow status

- Khi **tạo** phiếu in/out/transfer:
  - Mặc định `status = 'draft'` (trừ khi override).
  - Hệ thống **chỉ tạo header + items**, **chưa cập nhật tồn kho**.

- Khi **sửa** phiếu:
  - Chỉ cho phép nếu `status = 'draft'`.
  - Cập nhật header + replace toàn bộ items.

- Khi **confirm**:
  - Các endpoint:
    - `POST /inventory/stock-ins/:id/confirm`
    - `POST /inventory/stock-outs/:id/confirm`
    - `POST /inventory/stock-transfers/:id/confirm`
  - Kiểm tra:
    - Không cho confirm lại phiếu đã `confirmed` hoặc `cancelled`.
    - Kiểm tra tồn kho không âm.
  - Chỉ khi confirm mới **ghi vào `inventory_balances`**:
    - Nhập kho: cộng tồn.
    - Xuất kho: trừ tồn (không được âm).
    - Chuyển kho: trừ kho nguồn, cộng kho đích (không được âm).

Tất cả confirm/cập nhật tồn đều chạy trong **transaction** Sequelize để đảm bảo atomic.

### 4.3. Xoá phiếu: draft vs confirmed

#### DELETE thường

Các endpoint:

- `DELETE /inventory/stock-ins/:id`
- `DELETE /inventory/stock-outs/:id`
- `DELETE /inventory/stock-transfers/:id`

Hành vi:

- **Nếu `status = 'draft'`**:
  - Xóa **hẳn** header + items (hard delete), không ảnh hưởng tồn kho.

- **Nếu `status != 'draft'` (ví dụ `confirmed`, `cancelled`)**:
  - Xóa **mềm** (soft delete) nhờ `paranoid` model:
    - Header và items được `destroy()` → set `deleted_at`.
    - **Không rollback tồn kho** (tồn vẫn như sau khi confirm).

#### DELETE vĩnh viễn + rollback tồn

Các endpoint:

- `DELETE /inventory/stock-ins/:id/permanent`
- `DELETE /inventory/stock-outs/:id/permanent`
- `DELETE /inventory/stock-transfers/:id/permanent`

Quy tắc chung:

- Lấy record với `paranoid: false` (bao gồm đã soft delete).
- Nếu chưa bị xoá mềm (`deleted_at` null) → 400: *"Cần xoá mềm trước khi xoá vĩnh viễn"*.
- Nếu đã soft delete:
  - Thực hiện **rollback tồn kho** tương ứng:
    - Nhập kho: trừ lại số lượng đã cộng.
    - Xuất kho: cộng lại số lượng đã trừ.
    - Chuyển kho: cộng kho nguồn, trừ kho đích (không để âm).
  - Nếu rollback khiến tồn âm → 400, không xoá hẳn, giữ nguyên dữ liệu.
  - Nếu thành công:
    - Xoá hẳn header + items với `force: true`.

### 4.4. Stock-in APIs

Base path: `/inventory/stock-ins`

- `GET /` – list, có filter & phân trang:
  - query: `page`, `limit`, `warehouse_id`, `supplier_id`, `status`, `code` (LIKE).
- `GET /:id` – chi tiết phiếu + items.
- `POST /` – tạo phiếu nhập `draft` + items.
- `PUT /:id` – sửa phiếu `draft` + items.
- `POST /:id/confirm` – confirm, cộng tồn.
- `DELETE /:id` – xoá draft (hard) hoặc confirmed (soft).
- `DELETE /:id/permanent` – rollback tồn + xoá hẳn (chỉ sau khi đã xoá mềm).

### 4.5. Stock-out APIs

Base path: `/inventory/stock-outs`

- Tương tự stock-in, khác logic tồn kho:
  - Confirm: trừ tồn, không cho âm.
  - Permanent delete: cộng trả lại tồn.

### 4.6. Stock-transfer APIs

Base path: `/inventory/stock-transfers`

- `GET /` – list có filter:
  - `from_warehouse_id`, `to_warehouse_id`, `status`, `code`, phân trang.
- `GET /:id` – chi tiết + items.
- `POST /` – tạo phiếu chuyển (draft).
- `PUT /:id` – sửa phiếu draft.
- `POST /:id/confirm` – confirm:
  - Trừ tồn kho nguồn.
  - Cộng tồn kho đích.
  - Không cho âm tồn kho nguồn.
- `DELETE /:id` – xoá draft (hard) hoặc confirmed (soft).
- `DELETE /:id/permanent` – rollback chuyển kho + xoá hẳn.

### 4.7. Inventory Balances

Base path: `/inventory/balances` (nếu đã khai báo route)

- Cho phép xem tồn kho hiện tại theo `warehouse_id`, `product_id`.
- Bảng `inventory_balances` chỉ được cập nhật bởi các luồng confirm/cancel/permanent delete.

---

## 5. Seed Data

Seeder khởi tạo (ví dụ `2024112101-seed-roles-permissions-users.js`):

- Tạo các `permission` chuẩn như trên.
- Tạo role `admin`, `staff` với tập permission tương ứng.
- Tạo user admin mặc định (email/mật khẩu cấu hình trong seeder hoặc `.env`).

---

## 6. Chạy dự án

1. Cài đặt:

```bash
npm install
```

2. Khởi tạo DB:

```bash
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

3. Chạy server:

```bash
npm start
```

Server mặc định chạy ở `http://localhost:3000` (tuỳ cấu hình `app.js`).

---

README này tổng hợp ở mức đủ để dev/backend hoặc frontend có thể hiểu luồng nghiệp vụ và gọi API. Chi tiết tham số/response cụ thể có thể xem trực tiếp trong controller tương ứng trong thư mục `src/controllers`.

