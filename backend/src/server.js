import express from 'express';
import cors from 'cors';
import { initDatabase } from './database/database.js';
import productRoutes from './routes/productRoutes.js';
import salesRoutes from './routes/salesRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize database and start server
async function startServer() {
    try {
        await initDatabase();
        console.log('✅ Database initialized');
        
        app.listen(PORT, () => {
            console.log(`🚀 POS Backend Server running on http://localhost:${PORT}`);
            console.log(`📦 API endpoints:`);
            console.log(`   - Products: http://localhost:${PORT}/api/products`);
            console.log(`   - Sales: http://localhost:${PORT}/api/sales`);
            console.log(`   - Reports: http://localhost:${PORT}/api/reports`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
