import express from 'express';
import db from '../database/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all transactions
router.get('/', (req, res) => {
    try {
        const { date, status } = req.query;
        let query = 'SELECT * FROM transactions WHERE 1=1';
        const params = [];

        if (date) {
            query += ' AND DATE(created_at) = DATE(?)';
            params.push(date);
        }

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC';

        const transactions = db.prepare(query).all(...params);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get transaction by id with items
router.get('/:id', (req, res) => {
    try {
        const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(req.params.id);

        res.json({ ...transaction, items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create transaction (sale)
router.post('/', (req, res) => {
    try {
        const { items, subtotal, discount = 0, total, payment_method, cash_received, change_amount } = req.body;
        
        console.log('Sale request:', { items, subtotal, discount, total, payment_method, cash_received, change_amount });

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        if (!payment_method) {
            return res.status(400).json({ error: 'Payment method is required' });
        }

        // Check stock availability for all items before processing
        const stockErrors = [];
        for (const item of items) {
            const product = db.prepare('SELECT id, name, stock FROM products WHERE id = ?').get(item.product_id);
            if (!product) {
                stockErrors.push(`ไม่พบสินค้า: ${item.product_name}`);
            } else if (product.stock < item.quantity) {
                stockErrors.push(`${product.name}: มีสต็อก ${product.stock} ชิ้น แต่ต้องการ ${item.quantity} ชิ้น`);
            }
        }

        if (stockErrors.length > 0) {
            return res.status(400).json({ 
                error: 'สต็อกไม่เพียงพอ', 
                details: stockErrors 
            });
        }

        const transactionId = uuidv4();

        // Start transaction
        const createTransaction = db.transaction(() => {
            // Create transaction record
            db.prepare(`
                INSERT INTO transactions (id, subtotal, discount, total, payment_method, cash_received, change_amount, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
            `).run(transactionId, subtotal, discount, total, payment_method, cash_received || null, change_amount || null);

            // Insert items and deduct stock
            for (const item of items) {
                console.log('Processing item:', item);
                
                // Get product to get cost
                const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
                console.log('Found product:', product);

                db.prepare(`
                    INSERT INTO transaction_items (transaction_id, product_id, product_name, price, cost, quantity, subtotal)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                    transactionId,
                    item.product_id,
                    item.product_name,
                    item.price,
                    product ? product.cost : (item.cost || 0),
                    item.quantity,
                    item.subtotal
                );

                // Deduct stock automatically
                db.prepare(`
                    UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
                `).run(item.quantity, item.product_id);
            }
        });

        createTransaction();

        const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
        const transactionItems = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(transactionId);

        console.log('Sale completed:', { transaction, transactionItems });
        res.status(201).json({ ...transaction, items: transactionItems });
    } catch (error) {
        console.error('Sale error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Void transaction
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;

        const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        if (transaction.status === 'voided') {
            return res.status(400).json({ error: 'Transaction already voided' });
        }

        // Void transaction and restore stock
        const voidTransaction = db.transaction(() => {
            // Get items to restore stock
            const items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(id);

            // Restore stock for each item
            const updateStock = db.prepare(`
                UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `);

            for (const item of items) {
                updateStock.run(item.quantity, item.product_id);
            }

            // Mark transaction as voided
            db.prepare("UPDATE transactions SET status = 'voided' WHERE id = ?").run(id);
        });

        voidTransaction();

        res.json({ message: 'Transaction voided successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Hold bill
router.post('/hold', (req, res) => {
    try {
        const { cart_data, note } = req.body;
        const id = uuidv4();

        db.prepare(`
            INSERT INTO held_bills (id, cart_data, note)
            VALUES (?, ?, ?)
        `).run(id, JSON.stringify(cart_data), note || null);

        res.status(201).json({ id, message: 'Bill held successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get held bills
router.get('/held/all', (req, res) => {
    try {
        const heldBills = db.prepare('SELECT * FROM held_bills ORDER BY created_at DESC').all();
        const parsedBills = heldBills.map(bill => ({
            ...bill,
            cart_data: JSON.parse(bill.cart_data)
        }));
        res.json(parsedBills);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Retrieve held bill
router.get('/held/:id', (req, res) => {
    try {
        const bill = db.prepare('SELECT * FROM held_bills WHERE id = ?').get(req.params.id);
        if (!bill) {
            return res.status(404).json({ error: 'Held bill not found' });
        }
        res.json({ ...bill, cart_data: JSON.parse(bill.cart_data) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete held bill
router.delete('/held/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM held_bills WHERE id = ?').run(id);
        res.json({ message: 'Held bill deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
