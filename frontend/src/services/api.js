import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3001/api',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Products API
export const productsApi = {
    getAll: () => api.get('/products'),
    getByBarcode: (barcode) => api.get(`/products/barcode/${barcode}`),
    getById: (id) => api.get(`/products/${id}`),
    create: (product) => api.post('/products', product),
    update: (id, product) => api.put(`/products/${id}`, product),
    delete: (id) => api.delete(`/products/${id}`),
    updateStock: (id, adjustment) => api.patch(`/products/${id}/stock`, { adjustment })
};

// Sales API
export const salesApi = {
    getAll: (params) => api.get('/sales', { params }),
    getById: (id) => api.get(`/sales/${id}`),
    create: (sale) => api.post('/sales', sale),
    void: (id) => api.delete(`/sales/${id}`),
    holdBill: (data) => api.post('/sales/hold', data),
    getHeldBills: () => api.get('/sales/held/all'),
    getHeldBill: (id) => api.get(`/sales/held/${id}`),
    deleteHeldBill: (id) => api.delete(`/sales/held/${id}`)
};

// Reports API
export const reportsApi = {
    getDaily: (date) => api.get('/reports/daily', { params: { date } }),
    getMonthly: (year, month) => api.get('/reports/monthly', { params: { year, month } }),
    getTopProducts: (limit, days) => api.get('/reports/top-products', { params: { limit, days } }),
    getLowStock: (threshold) => api.get('/reports/low-stock', { params: { threshold } }),
    exportCsv: (startDate, endDate) => api.get('/reports/export', { 
        params: { start_date: startDate, end_date: endDate },
        responseType: 'blob'
    })
};

export default api;
