-- ============================================================
-- StockSense AI — FULL SCHEMA v3 (Company-Isolated)
-- Run: mysql -u root -p < database/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS stocksense CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stocksense;

-- ── Companies (one per business) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    business_name VARCHAR(200) NOT NULL,
    owner_name    VARCHAR(150),
    address       TEXT,
    city          VARCHAR(100),
    state         VARCHAR(100),
    pincode       VARCHAR(10),
    phone         VARCHAR(20),
    email         VARCHAR(150),
    gst_number    VARCHAR(20),
    pan_number    VARCHAR(15),
    nature        VARCHAR(100),
    business_category VARCHAR(100) DEFAULT 'Garments',
    selling_items TEXT,
    sell_online   TINYINT(1) DEFAULT 0,
    sell_physical TINYINT(1) DEFAULT 1,
    website_url   VARCHAR(255),
    established_year YEAR,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Users (each user belongs to one company) ─────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    company_id  INT NOT NULL,
    name        VARCHAR(100) NOT NULL,
    username    VARCHAR(50) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    role        ENUM('admin','staff') DEFAULT 'staff',
    email       VARCHAR(150),
    phone       VARCHAR(20),
    is_active   TINYINT(1) DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- ── Categories (shared or company-specific) ───────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_company_cat (company_id, name)
);

-- ── Stock (per company) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    company_id          INT NOT NULL,
    name                VARCHAR(200) NOT NULL,
    category_id         INT,
    qty                 DECIMAL(12,3) NOT NULL DEFAULT 0,
    sale_rate           DECIMAL(10,2) NOT NULL DEFAULT 0,
    purchase_rate       DECIMAL(10,2) NOT NULL DEFAULT 0,
    low_stock_threshold INT DEFAULT 5,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id)  REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ── Sales (per company) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    company_id    INT NOT NULL,
    voucher_no    VARCHAR(50) NOT NULL,
    customer_name VARCHAR(200) NOT NULL DEFAULT 'CASH',
    sale_date     DATE NOT NULL,
    sale_type     VARCHAR(50) DEFAULT 'L/GST-No Tax',
    narration     TEXT,
    discount      DECIMAL(10,2) DEFAULT 0,
    total_amount  DECIMAL(12,2) DEFAULT 0,
    net_amount    DECIMAL(12,2) DEFAULT 0,
    created_by    INT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_company_voucher (company_id, voucher_no),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    sale_id    INT NOT NULL,
    stock_id   INT NOT NULL,
    item_name  VARCHAR(200) NOT NULL,
    qty        DECIMAL(12,3) NOT NULL,
    unit       VARCHAR(20) DEFAULT 'PCS',
    list_price DECIMAL(10,2) DEFAULT 0,
    discount   DECIMAL(5,2) DEFAULT 0,
    rate       DECIMAL(10,2) NOT NULL,
    total      DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (sale_id)  REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (stock_id) REFERENCES stock(id) ON DELETE RESTRICT
);

-- ── Purchases (per company) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    company_id    INT NOT NULL,
    voucher_no    VARCHAR(50) NOT NULL,
    supplier_name VARCHAR(200) NOT NULL,
    purchase_date DATE NOT NULL,
    narration     TEXT,
    discount      DECIMAL(10,2) DEFAULT 0,
    total_amount  DECIMAL(12,2) DEFAULT 0,
    net_amount    DECIMAL(12,2) DEFAULT 0,
    created_by    INT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_company_pvoucher (company_id, voucher_no),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NOT NULL,
    stock_id    INT NOT NULL,
    item_name   VARCHAR(200) NOT NULL,
    qty         DECIMAL(12,3) NOT NULL,
    unit        VARCHAR(20) DEFAULT 'PCS',
    rate        DECIMAL(10,2) NOT NULL,
    total       DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (stock_id)    REFERENCES stock(id) ON DELETE RESTRICT
);

-- ── AI cache & email logs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_trend_cache (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    business_category VARCHAR(100) NOT NULL,
    result_json       LONGTEXT,
    cached_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cat (business_category)
);

CREATE TABLE IF NOT EXISTS email_logs (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    type      VARCHAR(50),
    recipient VARCHAR(200),
    subject   VARCHAR(300),
    status    ENUM('sent','failed') DEFAULT 'sent',
    sent_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════════════════════════════════════
-- SEED DATA — Default Company + Admin + Stock
-- ══════════════════════════════════════════════════════════════════════

INSERT IGNORE INTO companies (id, business_name, owner_name, city, state, business_category, selling_items, sell_physical)
VALUES (1, 'HBS Clothing Store', 'Owner', 'Delhi', 'Delhi', 'Garments', 'Shirts, Jeans, Jackets, Dresses, Accessories', 1);

INSERT IGNORE INTO categories (id, company_id, name) VALUES
(1, 1,'Shirts'),(2,1,'Jeans'),(3,1,'Jackets'),(4,1,'Dresses'),
(5,1,'Trousers'),(6,1,'Knitwear'),(7,1,'Accessories'),(8,1,'Footwear'),
(9,1,'Sportswear'),(10,1,'Ethnic');

-- Password: "password" (bcrypt)
INSERT IGNORE INTO users (id, company_id, name, username, password, role, email, phone) VALUES
(1, 1, 'Admin User', 'admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'admin@stocksense.com', '9999900000'),
(2, 1, 'Staff User', 'staff', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff', 'staff@stocksense.com', '9999911111');

INSERT IGNORE INTO stock (company_id, name, category_id, qty, sale_rate, purchase_rate, low_stock_threshold) VALUES
(1,'Blue Denim Jacket',3,45,2499.00,1400.00,5),
(1,'White Cotton Shirt',1,30,799.00,350.00,5),
(1,'Black Slim Jeans',2,62,1299.00,650.00,8),
(1,'Floral Summer Dress',4,25,1599.00,800.00,3),
(1,'Beige Chinos',5,28,999.00,500.00,5),
(1,'Striped Polo',1,40,699.00,320.00,5),
(1,'Leather Belt',7,90,399.00,150.00,10),
(1,'Ankle Boots',8,14,3499.00,1800.00,3),
(1,'Woolen Sweater',6,35,1899.00,900.00,3),
(1,'Sports Shorts',9,55,599.00,250.00,10);