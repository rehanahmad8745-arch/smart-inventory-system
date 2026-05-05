// migrate.js — Run this ONCE to fix your Railway database
// Command: node migrate.js
require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
    console.log('\n🔧 StockSense Database Migration\n');
    console.log('Connecting to:', process.env.DB_HOST + ':' + process.env.DB_PORT);

    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST,
        port:     parseInt(process.env.DB_PORT) || 3306,
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    console.log('✅ Connected!\n');

    const run = async (label, sql) => {
        try {
            await conn.query(sql);
            console.log('✅ ' + label);
        } catch(e) {
            if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_TABLE_EXISTS_ERROR' ||
                e.message.includes('Duplicate column') || e.message.includes('already exists')) {
                console.log('⏭  ' + label + ' (already done)');
            } else {
                console.log('❌ ' + label + ': ' + e.message);
            }
        }
    };

    // ── Step 1: Create companies table ──────────────────────────────────
    await run('Create companies table', `
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
        )
    `);

    // ── Step 2: Migrate business_profile → companies ─────────────────────
    const [companies] = await conn.query('SELECT COUNT(*) as c FROM companies');
    if (companies[0].c === 0) {
        try {
            const [biz] = await conn.query('SELECT * FROM business_profile LIMIT 1');
            if (biz.length) {
                await conn.query(`
                    INSERT INTO companies (id, business_name, owner_name, address, city, state, pincode,
                        phone, email, gst_number, pan_number, nature, business_category, selling_items,
                        sell_online, sell_physical, website_url, established_year)
                    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    biz[0].business_name || 'My Store', biz[0].owner_name, biz[0].address,
                    biz[0].city, biz[0].state, biz[0].pincode, biz[0].phone, biz[0].email,
                    biz[0].gst_number, biz[0].pan_number, biz[0].nature, biz[0].business_category,
                    biz[0].selling_items, biz[0].sell_online || 0, biz[0].sell_physical || 1,
                    biz[0].website_url, biz[0].established_year
                ]);
                console.log('✅ Migrated business_profile → companies');
            } else {
                await conn.query(`INSERT IGNORE INTO companies (id, business_name, business_category, sell_physical) VALUES (1, 'My Store', 'Garments', 1)`);
                console.log('✅ Created default company');
            }
        } catch(e) {
            await conn.query(`INSERT IGNORE INTO companies (id, business_name, business_category, sell_physical) VALUES (1, 'My Store', 'Garments', 1)`);
            console.log('✅ Created default company (no business_profile found)');
        }
    } else {
        console.log('⏭  Company already exists');
    }

    // ── Step 3: Add company_id to users ────────────────────────────────
    await run('Add company_id to users', `ALTER TABLE users ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id`);
    await run('Set all users to company 1', `UPDATE users SET company_id = 1 WHERE company_id = 0 OR company_id IS NULL`);

    // ── Step 4: Add company_id to stock ────────────────────────────────
    await run('Add company_id to stock', `ALTER TABLE stock ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id`);
    await run('Set all stock to company 1', `UPDATE stock SET company_id = 1 WHERE company_id = 0 OR company_id IS NULL`);

    // ── Step 5: Add company_id to sales ────────────────────────────────
    await run('Add company_id to sales', `ALTER TABLE sales ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id`);
    await run('Set all sales to company 1', `UPDATE sales SET company_id = 1 WHERE company_id = 0 OR company_id IS NULL`);

    // ── Step 6: Add company_id to purchases ────────────────────────────
    await run('Add company_id to purchases', `ALTER TABLE purchases ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id`);
    await run('Set all purchases to company 1', `UPDATE purchases SET company_id = 1 WHERE company_id = 0 OR company_id IS NULL`);

    // ── Step 7: Add company_id to categories ───────────────────────────
    await run('Add company_id to categories', `ALTER TABLE categories ADD COLUMN company_id INT DEFAULT 1 AFTER id`);
    await run('Set all categories to company 1', `UPDATE categories SET company_id = 1 WHERE company_id IS NULL`);

    // ── Step 8: Add new columns to sales ───────────────────────────────
    await run('Add sale_type to sales', `ALTER TABLE sales ADD COLUMN sale_type VARCHAR(50) DEFAULT 'L/GST-No Tax' AFTER sale_date`);
    await run('Add discount to sales', `ALTER TABLE sales ADD COLUMN discount DECIMAL(10,2) DEFAULT 0 AFTER narration`);
    await run('Add net_amount to sales', `ALTER TABLE sales ADD COLUMN net_amount DECIMAL(12,2) DEFAULT 0 AFTER total_amount`);
    await run('Set net_amount = total_amount for old sales', `UPDATE sales SET net_amount = total_amount WHERE net_amount = 0`);

    // ── Step 9: Add new columns to purchases ───────────────────────────
    await run('Add discount to purchases', `ALTER TABLE purchases ADD COLUMN discount DECIMAL(10,2) DEFAULT 0 AFTER narration`);
    await run('Add net_amount to purchases', `ALTER TABLE purchases ADD COLUMN net_amount DECIMAL(12,2) DEFAULT 0 AFTER total_amount`);
    await run('Set net_amount = total_amount for old purchases', `UPDATE purchases SET net_amount = total_amount WHERE net_amount = 0`);

    // ── Step 10: Add unit/list_price/discount to sale_items ────────────
    await run('Add unit to sale_items', `ALTER TABLE sale_items ADD COLUMN unit VARCHAR(20) DEFAULT 'PCS' AFTER qty`);
    await run('Add list_price to sale_items', `ALTER TABLE sale_items ADD COLUMN list_price DECIMAL(10,2) DEFAULT 0 AFTER unit`);
    await run('Add discount to sale_items', `ALTER TABLE sale_items ADD COLUMN discount DECIMAL(5,2) DEFAULT 0 AFTER list_price`);

    // ── Step 11: Add unit to purchase_items ────────────────────────────
    await run('Add unit to purchase_items', `ALTER TABLE purchase_items ADD COLUMN unit VARCHAR(20) DEFAULT 'PCS' AFTER qty`);

    // ── Step 12: Fix unique voucher constraint (company-scoped) ─────────
    await run('Drop old voucher unique on sales', `ALTER TABLE sales DROP INDEX voucher_no`);
    await run('Add company-scoped voucher unique on sales', `ALTER TABLE sales ADD UNIQUE KEY uq_company_voucher (company_id, voucher_no)`);
    await run('Drop old voucher unique on purchases', `ALTER TABLE purchases DROP INDEX voucher_no`);
    await run('Add company-scoped voucher unique on purchases', `ALTER TABLE purchases ADD UNIQUE KEY uq_company_pvoucher (company_id, voucher_no)`);

    // ── Step 13: Default categories for company 1 ───────────────────────
    const cats = ['Shirts','Jeans','Jackets','Dresses','Trousers','Knitwear','Accessories','Footwear','Sportswear','Ethnic'];
    for (const cat of cats) {
        try {
            await conn.query('INSERT IGNORE INTO categories (company_id, name) VALUES (1, ?)', [cat]);
        } catch(e) {}
    }
    console.log('✅ Default categories seeded');

    // ── Step 14: Create ai_trend_cache if missing ──────────────────────
    await run('Create ai_trend_cache table', `
        CREATE TABLE IF NOT EXISTS ai_trend_cache (
            id INT AUTO_INCREMENT PRIMARY KEY,
            business_category VARCHAR(100) NOT NULL,
            result_json LONGTEXT,
            cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_cat (business_category)
        )
    `);

    // ── Final check ────────────────────────────────────────────────────
    console.log('\n📋 Final verification:');
    const [userCols] = await conn.query('SHOW COLUMNS FROM users LIKE "company_id"');
    const [stockCols] = await conn.query('SHOW COLUMNS FROM stock LIKE "company_id"');
    const [salesCols] = await conn.query('SHOW COLUMNS FROM sales LIKE "company_id"');
    const [purCols]   = await conn.query('SHOW COLUMNS FROM purchases LIKE "company_id"');

    console.log('users.company_id:', userCols.length ? '✅' : '❌ MISSING');
    console.log('stock.company_id:', stockCols.length ? '✅' : '❌ MISSING');
    console.log('sales.company_id:', salesCols.length ? '✅' : '❌ MISSING');
    console.log('purchases.company_id:', purCols.length ? '✅' : '❌ MISSING');

    const [userCount]  = await conn.query('SELECT COUNT(*) as c FROM users');
    const [stockCount] = await conn.query('SELECT COUNT(*) as c FROM stock');
    console.log('\n📊 Data preserved:');
    console.log('Users:', userCount[0].c);
    console.log('Stock items:', stockCount[0].c);

    await conn.end();
    console.log('\n🎉 Migration complete! Now restart your server and logout → login again.\n');
}

migrate().catch(err => {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
});