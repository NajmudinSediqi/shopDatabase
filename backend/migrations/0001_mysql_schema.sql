-- MySQL 8.0.16+ / MariaDB 10.4+; UTF-8 Persian text; all business tables use InnoDB.

CREATE TABLE IF NOT EXISTS `auth_users` (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  metadata JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auth_sessions` (
  token_hash CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  INDEX (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auth_invitations` (
  token_hash CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  expires_at DATETIME(3) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `app_locks` (
  name VARCHAR(64) PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `profiles` (
  id CHAR(36) PRIMARY KEY,
  full_name VARCHAR(100),
  email VARCHAR(255),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permissions` (
  code VARCHAR(100) PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  grp VARCHAR(100) NOT NULL DEFAULT '??????',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `roles` (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  permissions JSON NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_roles` (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  role ENUM('admin','staff') NOT NULL,
  role_id CHAR(36),
  UNIQUE (user_id, role),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `settings` (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  shop_name VARCHAR(255) NOT NULL DEFAULT '??????? ??',
  usd_to_afn DECIMAL(14,4) NOT NULL DEFAULT 70 CHECK (usd_to_afn > 0),
  rate_mode VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (rate_mode IN ('manual','auto')),
  live_rate DECIMAL(14,4),
  live_rate_at DATETIME(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `categories` (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `products` (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(255) UNIQUE,
  category_id CHAR(36),
  unit VARCHAR(100) NOT NULL DEFAULT '???',
  pack_unit VARCHAR(100),
  pack_size DECIMAL(14,2) NOT NULL DEFAULT 1 CHECK (pack_size > 0),
  sell_price DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (sell_price >= 0),
  currency ENUM('AFN','USD') NOT NULL DEFAULT 'AFN',
  min_stock DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customers` (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(100),
  address TEXT,
  notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `suppliers` (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(100),
  address TEXT,
  notes TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchases` (
  id CHAR(36) PRIMARY KEY,
  invoice_no BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  supplier_id CHAR(36),
  date DATE NOT NULL DEFAULT (CURRENT_DATE),
  currency ENUM('AFN','USD') NOT NULL DEFAULT 'AFN',
  rate DECIMAL(14,4) NOT NULL DEFAULT 1 CHECK (rate > 0),
  total DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  paid DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (paid >= 0 AND paid <= total),
  notes TEXT,
  location ENUM('warehouse','shop') NOT NULL DEFAULT 'shop',
  created_by CHAR(36), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  INDEX (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sales` (
  id CHAR(36) PRIMARY KEY,
  invoice_no BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  customer_id CHAR(36),
  date DATE NOT NULL DEFAULT (CURRENT_DATE),
  currency ENUM('AFN','USD') NOT NULL DEFAULT 'AFN',
  rate DECIMAL(14,4) NOT NULL DEFAULT 1 CHECK (rate > 0),
  total DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  discount DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (discount >= 0 AND discount <= total),
  paid DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (paid >= 0 AND paid <= total - discount),
  notes TEXT,
  created_by CHAR(36), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  INDEX (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_items` (
  id CHAR(36) PRIMARY KEY,
  purchase_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  qty DECIMAL(14,2) NOT NULL CHECK (qty > 0),
  unit_price DECIMAL(14,2) NOT NULL CHECK (unit_price >= 0),
  unit_kind ENUM('piece','pack') NOT NULL DEFAULT 'piece',
  pieces DECIMAL(14,2) NOT NULL CHECK (pieces > 0),
  pack_size DECIMAL(14,2) NOT NULL DEFAULT 1 CHECK (pack_size >= 1),
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sale_items` (
  id CHAR(36) PRIMARY KEY,
  sale_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  qty DECIMAL(14,2) NOT NULL CHECK (qty > 0),
  unit_price DECIMAL(14,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost_afn DECIMAL(14,4) NOT NULL DEFAULT 0 CHECK (unit_cost_afn >= 0),
  unit_kind ENUM('piece','pack') NOT NULL DEFAULT 'piece',
  pieces DECIMAL(14,2) NOT NULL CHECK (pieces > 0),
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_movements` (
  id CHAR(36) PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  type ENUM('in','out','adjust','transfer') NOT NULL,
  qty DECIMAL(14,2) NOT NULL,
  unit_cost_afn DECIMAL(14,4) NOT NULL DEFAULT 0 CHECK (unit_cost_afn >= 0),
  ref_type VARCHAR(50),
  ref_id CHAR(36),
  date DATE NOT NULL DEFAULT (CURRENT_DATE),
  note TEXT,
  location ENUM('warehouse','shop') NOT NULL DEFAULT 'shop',
  created_by CHAR(36), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX (ref_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customer_debts` (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  bill_no VARCHAR(255),
  amount DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  currency ENUM('AFN','USD') NOT NULL DEFAULT 'AFN',
  date DATE NOT NULL DEFAULT (CURRENT_DATE),
  description TEXT,
  created_by CHAR(36), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supplier_debts` (
  id CHAR(36) PRIMARY KEY,
  supplier_id CHAR(36) NOT NULL,
  bill_no VARCHAR(255),
  amount DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  currency ENUM('AFN','USD') NOT NULL DEFAULT 'AFN',
  date DATE NOT NULL DEFAULT (CURRENT_DATE),
  description TEXT,
  created_by CHAR(36), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customer_payments` (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  amount DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  currency ENUM('AFN','USD') NOT NULL DEFAULT 'AFN',
  date DATE NOT NULL DEFAULT (CURRENT_DATE),
  note TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  debt_id CHAR(36),
  sale_id CHAR(36),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (debt_id) REFERENCES customer_debts(id) ON DELETE SET NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
  CHECK (debt_id IS NULL OR sale_id IS NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supplier_payments` (
  id CHAR(36) PRIMARY KEY,
  supplier_id CHAR(36) NOT NULL,
  amount DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  currency ENUM('AFN','USD') NOT NULL DEFAULT 'AFN',
  date DATE NOT NULL DEFAULT (CURRENT_DATE),
  note TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  debt_id CHAR(36),
  purchase_id CHAR(36),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (debt_id) REFERENCES supplier_debts(id) ON DELETE SET NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL,
  CHECK (debt_id IS NULL OR purchase_id IS NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expense_categories` (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expenses` (
  id CHAR(36) PRIMARY KEY,
  category_id CHAR(36),
  amount DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  currency ENUM('AFN','USD') NOT NULL DEFAULT 'AFN',
  rate DECIMAL(14,4) NOT NULL DEFAULT 1 CHECK (rate > 0),
  date DATE NOT NULL DEFAULT (CURRENT_DATE),
  description TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL,
  INDEX (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `employees` (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  position VARCHAR(255),
  phone VARCHAR(100),
  salary DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (salary >= 0),
  currency ENUM('AFN','USD') NOT NULL DEFAULT 'AFN',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `salary_payments` (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  amount DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  currency ENUM('AFN','USD') NOT NULL DEFAULT 'AFN',
  rate DECIMAL(14,4) NOT NULL DEFAULT 1 CHECK (rate > 0),
  date DATE NOT NULL DEFAULT (CURRENT_DATE),
  period VARCHAR(100),
  note TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
