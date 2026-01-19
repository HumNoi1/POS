import express from 'express';
import db from '../database/database.js';

const router = express.Router();

// Get all products
router.get('/', (req, res) => {
    try {
        const products = db.prepare('SELECT * FROM products ORDER BY name').all();
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get product by barcode
router.get('/barcode/:barcode', (req, res) => {
    try {
        const product = db.prepare('SELECT * FROM products WHERE barcode = ?').get(req.params.barcode);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get product by id
router.get('/:id', (req, res) => {
    try {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create product
router.post('/', (req, res) => {
    try {
        const { barcode, name, price, cost = 0, unit = 'ชิ้น', stock = 0 } = req.body;

        if (!barcode || !name || price === undefined) {
            return res.status(400).json({ error: 'Barcode, name, and price are required' });
        }

        const stmt = db.prepare(`
            INSERT INTO products (barcode, name, price, cost, unit, stock)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(barcode, name, price, cost, unit, stock);

        const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(newProduct);
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Barcode already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Update product
router.put('/:id', (req, res) => {
    try {
        const { barcode, name, price, cost, unit, stock } = req.body;
        const { id } = req.params;

        const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const stmt = db.prepare(`
            UPDATE products 
            SET barcode = ?, name = ?, price = ?, cost = ?, unit = ?, stock = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        stmt.run(
            barcode ?? existing.barcode,
            name ?? existing.name,
            price ?? existing.price,
            cost ?? existing.cost,
            unit ?? existing.unit,
            stock ?? existing.stock,
            id
        );

        const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        res.json(updatedProduct);
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Barcode already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Delete product
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;

        const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ error: 'Product not found' });
        }

        db.prepare('DELETE FROM products WHERE id = ?').run(id);
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update stock
router.patch('/:id/stock', (req, res) => {
    try {
        const { id } = req.params;
        const { adjustment } = req.body; // positive for adding, negative for deducting

        const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const newStock = existing.stock + adjustment;
        if (newStock < 0) {
            return res.status(400).json({ error: 'Insufficient stock' });
        }

        db.prepare('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStock, id);

        const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        res.json(updatedProduct);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
