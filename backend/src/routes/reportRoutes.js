import express from 'express';
import db from '../database/database.js';

const router = express.Router();

// Get daily sales report
router.get('/daily', (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        const summary = db.prepare(`
            SELECT 
                COUNT(*) as bill_count,
                COALESCE(SUM(total), 0) as total_sales,
                COALESCE(SUM(discount), 0) as total_discount
            FROM transactions 
            WHERE DATE(created_at) = DATE(?) AND status = 'completed'
        `).get(targetDate);

        const byPaymentMethod = db.prepare(`
            SELECT 
                payment_method,
                COUNT(*) as count,
                SUM(total) as total
            FROM transactions 
            WHERE DATE(created_at) = DATE(?) AND status = 'completed'
            GROUP BY payment_method
        `).all(targetDate);

        // Calculate profit
        const profitData = db.prepare(`
            SELECT 
                COALESCE(SUM(ti.subtotal), 0) as revenue,
                COALESCE(SUM(ti.cost * ti.quantity), 0) as total_cost
            FROM transaction_items ti
            JOIN transactions t ON ti.transaction_id = t.id
            WHERE DATE(t.created_at) = DATE(?) AND t.status = 'completed'
        `).get(targetDate);

        res.json({
            date: targetDate,
            ...summary,
            profit: profitData.revenue - profitData.total_cost,
            by_payment_method: byPaymentMethod
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get monthly sales report
router.get('/monthly', (req, res) => {
    try {
        const { year, month } = req.query;
        const targetYear = year || new Date().getFullYear();
        const targetMonth = month || new Date().getMonth() + 1;

        const summary = db.prepare(`
            SELECT 
                COUNT(*) as bill_count,
                COALESCE(SUM(total), 0) as total_sales,
                COALESCE(SUM(discount), 0) as total_discount
            FROM transactions 
            WHERE strftime('%Y', created_at) = ? 
            AND strftime('%m', created_at) = ?
            AND status = 'completed'
        `).get(String(targetYear), String(targetMonth).padStart(2, '0'));

        // Daily breakdown
        const dailyBreakdown = db.prepare(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as bill_count,
                SUM(total) as total_sales
            FROM transactions 
            WHERE strftime('%Y', created_at) = ? 
            AND strftime('%m', created_at) = ?
            AND status = 'completed'
            GROUP BY DATE(created_at)
            ORDER BY date
        `).all(String(targetYear), String(targetMonth).padStart(2, '0'));

        // Calculate profit
        const profitData = db.prepare(`
            SELECT 
                COALESCE(SUM(ti.subtotal), 0) as revenue,
                COALESCE(SUM(ti.cost * ti.quantity), 0) as total_cost
            FROM transaction_items ti
            JOIN transactions t ON ti.transaction_id = t.id
            WHERE strftime('%Y', t.created_at) = ? 
            AND strftime('%m', t.created_at) = ?
            AND t.status = 'completed'
        `).get(String(targetYear), String(targetMonth).padStart(2, '0'));

        res.json({
            year: targetYear,
            month: targetMonth,
            ...summary,
            profit: profitData.revenue - profitData.total_cost,
            daily_breakdown: dailyBreakdown
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get top selling products
router.get('/top-products', (req, res) => {
    try {
        const { limit = 10, days = 30 } = req.query;

        const topProducts = db.prepare(`
            SELECT 
                ti.product_id,
                ti.product_name,
                SUM(ti.quantity) as total_quantity,
                SUM(ti.subtotal) as total_revenue,
                SUM((ti.price - ti.cost) * ti.quantity) as total_profit
            FROM transaction_items ti
            JOIN transactions t ON ti.transaction_id = t.id
            WHERE t.created_at >= datetime('now', '-' || ? || ' days')
            AND t.status = 'completed'
            GROUP BY ti.product_id, ti.product_name
            ORDER BY total_quantity DESC
            LIMIT ?
        `).all(days, limit);

        res.json(topProducts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get low stock products
router.get('/low-stock', (req, res) => {
    try {
        const { threshold = 10 } = req.query;

        const lowStock = db.prepare(`
            SELECT * FROM products 
            WHERE stock <= ?
            ORDER BY stock ASC
        `).all(threshold);

        res.json(lowStock);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export transactions to CSV format
router.get('/export', (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        let query = `
            SELECT 
                t.id,
                t.created_at,
                t.subtotal,
                t.discount,
                t.total,
                t.payment_method,
                t.status
            FROM transactions t
            WHERE t.status = 'completed'
        `;
        const params = [];

        if (start_date) {
            query += ' AND DATE(t.created_at) >= DATE(?)';
            params.push(start_date);
        }

        if (end_date) {
            query += ' AND DATE(t.created_at) <= DATE(?)';
            params.push(end_date);
        }

        query += ' ORDER BY t.created_at DESC';

        const transactions = db.prepare(query).all(...params);

        // Convert to CSV
        const headers = ['ID', 'Date', 'Subtotal', 'Discount', 'Total', 'Payment Method', 'Status'];
        const csvRows = [headers.join(',')];

        for (const t of transactions) {
            csvRows.push([
                t.id,
                t.created_at,
                t.subtotal,
                t.discount,
                t.total,
                t.payment_method,
                t.status
            ].join(','));
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
        res.send(csvRows.join('\n'));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
