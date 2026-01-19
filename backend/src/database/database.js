import initSqlJs from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pos.db');

let db = null;

// Initialize database
async function initDatabase() {
    const SQL = await initSqlJs();
    
    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }
    
    // Create tables
    db.run(`
        -- Products table
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barcode TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            cost REAL DEFAULT 0,
            unit TEXT DEFAULT 'ชิ้น',
            stock INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    
    db.run(`
        -- Transactions table
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            subtotal REAL NOT NULL,
            discount REAL DEFAULT 0,
            total REAL NOT NULL,
            payment_method TEXT NOT NULL,
            cash_received REAL,
            change_amount REAL,
            status TEXT DEFAULT 'completed',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    
    db.run(`
        -- Transaction items
        CREATE TABLE IF NOT EXISTS transaction_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id TEXT NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            price REAL NOT NULL,
            cost REAL DEFAULT 0,
            quantity INTEGER NOT NULL,
            subtotal REAL NOT NULL,
            FOREIGN KEY (transaction_id) REFERENCES transactions(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
    `);
    
    db.run(`
        -- Held bills
        CREATE TABLE IF NOT EXISTS held_bills (
            id TEXT PRIMARY KEY,
            cart_data TEXT NOT NULL,
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    
    // Create indexes
    try {
        db.run('CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);');
        db.run('CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);');
        db.run('CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items(transaction_id);');
    } catch (e) {
        // Indexes might already exist
    }
    
    // Save to file
    saveDatabase();
    
    return db;
}

// Save database to file
function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    }
}

// Helper class for db operations compatible with the route handlers
class DatabaseWrapper {
    prepare(sql) {
        const self = this;
        return {
            run(...params) {
                try {
                    db.run(sql, params);
                    saveDatabase();
                    // For INSERT, get last insert id
                    if (sql.trim().toUpperCase().startsWith('INSERT')) {
                        const result = db.exec('SELECT last_insert_rowid() as id');
                        return { lastInsertRowid: result[0]?.values[0]?.[0] };
                    }
                    return { changes: db.getRowsModified() };
                } catch (e) {
                    throw e;
                }
            },
            get(...params) {
                try {
                    const stmt = db.prepare(sql);
                    stmt.bind(params);
                    if (stmt.step()) {
                        const columns = stmt.getColumnNames();
                        const values = stmt.get();
                        stmt.free();
                        const row = {};
                        columns.forEach((col, i) => row[col] = values[i]);
                        return row;
                    }
                    stmt.free();
                    return undefined;
                } catch (e) {
                    throw e;
                }
            },
            all(...params) {
                try {
                    const results = [];
                    const stmt = db.prepare(sql);
                    stmt.bind(params);
                    while (stmt.step()) {
                        const columns = stmt.getColumnNames();
                        const values = stmt.get();
                        const row = {};
                        columns.forEach((col, i) => row[col] = values[i]);
                        results.push(row);
                    }
                    stmt.free();
                    return results;
                } catch (e) {
                    throw e;
                }
            }
        };
    }
    
    transaction(fn) {
        return () => {
            try {
                db.run('BEGIN TRANSACTION');
                fn();
                db.run('COMMIT');
                saveDatabase();
            } catch (e) {
                db.run('ROLLBACK');
                throw e;
            }
        };
    }
    
    exec(sql) {
        db.run(sql);
        saveDatabase();
    }
}

const dbWrapper = new DatabaseWrapper();

export { initDatabase, saveDatabase };
export default dbWrapper;
