import { createRouter, createWebHistory } from 'vue-router';
import POSView from '../views/POSView.vue';
import ProductsView from '../views/ProductsView.vue';
import ReportsView from '../views/ReportsView.vue';

const routes = [
    {
        path: '/',
        name: 'pos',
        component: POSView
    },
    {
        path: '/products',
        name: 'products',
        component: ProductsView
    },
    {
        path: '/reports',
        name: 'reports',
        component: ReportsView
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

export default router;
