-- ============================================================
-- StockSense AI - MySQL Schema v2 (Full Update)
-- Run: mysql -u root -p < database/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS stocksense CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stocksense;

CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    username    VARCHAR(50)  UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    role        ENUM('admin','staff') DEFAULT 'staff',
    email       VARCHAR(150),
    phone       VARCHAR(20),
    is_active   TINYINT(1) DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_profile (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    business_name     VARCHAR(200) NOT NULL,
    owner_name        VARCHAR(150),
    address           TEXT,
    city              VARCHAR(100),
    state             VARCHAR(100),
    pincode           VARCHAR(10),
    phone             VARCHAR(20),
    email             VARCHAR(150),
    gst_number        VARCHAR(20),
    pan_number        VARCHAR(15),
    nature            VARCHAR(100),
    business_category VARCHAR(100),
    selling_items     TEXT,
    sell_online       TINYINT(1) DEFAULT 0,
    sell_physical     TINYINT(1) DEFAULT 1,
    website_url       VARCHAR(255),
    logo_url          VARCHAR(255),
    established_year  YEAR,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(200) NOT NULL,
    category_id         INT,
    qty                 INT NOT NULL DEFAULT 0,
    sale_rate           DECIMAL(10,2) NOT NULL DEFAULT 0,
    purchase_rate       DECIMAL(10,2) NOT NULL DEFAULT 0,
    low_stock_threshold INT DEFAULT 5,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sales (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    voucher_no    VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    sale_date     DATE NOT NULL,
    narration     TEXT,
    total_amount  DECIMAL(12,2) DEFAULT 0,
    created_by    INT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    sale_id   INT NOT NULL,
    stock_id  INT NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    qty       INT NOT NULL,
    rate      DECIMAL(10,2) NOT NULL,
    total     DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (sale_id)  REFERENCES sales(id)  ON DELETE CASCADE,
    FOREIGN KEY (stock_id) REFERENCES stock(id)  ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS purchases (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    voucher_no    VARCHAR(50) UNIQUE NOT NULL,
    supplier_name VARCHAR(200) NOT NULL,
    purchase_date DATE NOT NULL,
    narration     TEXT,
    total_amount  DECIMAL(12,2) DEFAULT 0,
    created_by    INT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NOT NULL,
    stock_id    INT NOT NULL,
    item_name   VARCHAR(200) NOT NULL,
    qty         INT NOT NULL,
    rate        DECIMAL(10,2) NOT NULL,
    total       DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (stock_id)    REFERENCES stock(id)     ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS email_logs (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    type      VARCHAR(50),
    recipient VARCHAR(200),
    subject   VARCHAR(300),
    status    ENUM('sent','failed') DEFAULT 'sent',
    sent_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_trend_cache (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    business_category VARCHAR(100) NOT NULL,
    result_json       LONGTEXT,
    cached_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cat (business_category)
);

-- SEED
INSERT IGNORE INTO categories (name) VALUES
('Shirts'),('Jeans'),('Jackets'),('Dresses'),('Trousers'),
('Knitwear'),('Accessories'),('Footwear'),('Sportswear'),('Ethnic');

INSERT IGNORE INTO users (name, username, password, role, email, phone) VALUES
('Admin User','admin','$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','admin','admin@stocksense.com','9999900000'),
('Staff User','staff','$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','staff','staff@stocksense.com','9999911111');

INSERT IGNORE INTO business_profile
    (id,business_name,owner_name,address,city,state,pincode,phone,email,gst_number,nature,business_category,selling_items,sell_online,sell_physical,established_year)
VALUES
    (1,'My Clothing Store','Owner Name','123 Market Street','Delhi','Delhi','110001','9999900000','owner@example.com','','Retail','Garments','Shirts, Jeans, Jackets, Dresses, Accessories',0,1,2020);

INSERT IGNORE INTO stock (name,category_id,qty,sale_rate,purchase_rate,low_stock_threshold) VALUES
('Blue Denim Jacket',3,45,2499.00,1400.00,5),
('White Cotton Shirt',1,3,799.00,350.00,5),
('Black Slim Jeans',2,62,1299.00,650.00,8),
('Floral Summer Dress',4,5,1599.00,800.00,3),
('Beige Chinos',5,28,999.00,500.00,5),
('Striped Polo',1,2,699.00,320.00,5),
('Leather Belt',7,90,399.00,150.00,10),
('Ankle Boots',8,14,3499.00,1800.00,3),
('Woolen Sweater',6,4,1899.00,900.00,3),
('Sports Shorts',9,55,599.00,250.00,10);
