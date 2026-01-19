<script setup>
import { ref, onMounted, computed } from 'vue';
import { reportsApi } from '../services/api';

// State
const loading = ref(false);
const error = ref('');
const activeTab = ref('daily');

// Report Data
const dailyReport = ref(null);
const monthlyReport = ref(null);
const topProducts = ref([]);
const lowStock = ref([]);

// Date filters
const selectedDate = ref(new Date().toISOString().split('T')[0]);
const selectedYear = ref(new Date().getFullYear());
const selectedMonth = ref(new Date().getMonth() + 1);

// Load daily report
const loadDailyReport = async () => {
  loading.value = true;
  try {
    const response = await reportsApi.getDaily(selectedDate.value);
    dailyReport.value = response.data;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// Load monthly report
const loadMonthlyReport = async () => {
  loading.value = true;
  try {
    const response = await reportsApi.getMonthly(selectedYear.value, selectedMonth.value);
    monthlyReport.value = response.data;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// Load top products
const loadTopProducts = async () => {
  loading.value = true;
  try {
    const response = await reportsApi.getTopProducts(10, 30);
    topProducts.value = response.data;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// Load low stock
const loadLowStock = async () => {
  loading.value = true;
  try {
    const response = await reportsApi.getLowStock(10);
    lowStock.value = response.data;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// Export CSV
const exportCsv = async () => {
  try {
    const startDate = selectedYear.value + '-' + String(selectedMonth.value).padStart(2, '0') + '-01';
    const endDate = selectedYear.value + '-' + String(selectedMonth.value).padStart(2, '0') + '-31';
    
    const response = await reportsApi.exportCsv(startDate, endDate);
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `transactions_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    error.value = err.message;
  }
};

// Switch tab
const switchTab = (tab) => {
  activeTab.value = tab;
  switch(tab) {
    case 'daily':
      loadDailyReport();
      break;
    case 'monthly':
      loadMonthlyReport();
      break;
    case 'products':
      loadTopProducts();
      break;
    case 'stock':
      loadLowStock();
      break;
  }
};

// Format currency
const formatCurrency = (value) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB'
  }).format(value || 0);
};

// Month names
const monthNames = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

onMounted(() => {
  loadDailyReport();
});
</script>

<template>
  <div class="reports-container">
    <!-- Error Message -->
    <Transition name="slide">
      <div v-if="error" class="message error" @click="error = ''">
        ❌ {{ error }}
      </div>
    </Transition>

    <!-- Header -->
    <div class="reports-header">
      <h1>📊 รายงาน</h1>
      <button class="btn btn-export" @click="exportCsv">
        📥 Export CSV
      </button>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button 
        :class="['tab', { active: activeTab === 'daily' }]"
        @click="switchTab('daily')"
      >
        📅 ยอดขายวันนี้
      </button>
      <button 
        :class="['tab', { active: activeTab === 'monthly' }]"
        @click="switchTab('monthly')"
      >
        📆 ยอดขายรายเดือน
      </button>
      <button 
        :class="['tab', { active: activeTab === 'products' }]"
        @click="switchTab('products')"
      >
        🏆 สินค้าขายดี
      </button>
      <button 
        :class="['tab', { active: activeTab === 'stock' }]"
        @click="switchTab('stock')"
      >
        ⚠️ สินค้าใกล้หมด
      </button>
    </div>

    <!-- Content -->
    <div class="report-content">
      <!-- Daily Report -->
      <div v-if="activeTab === 'daily'" class="report-panel">
        <div class="date-filter">
          <label>เลือกวันที่:</label>
          <input 
            v-model="selectedDate" 
            type="date" 
            class="date-input"
            @change="loadDailyReport"
          />
        </div>

        <div v-if="loading" class="loading">
          <div class="loading-spinner"></div>
          กำลังโหลด...
        </div>

        <div v-else-if="dailyReport" class="stats-grid">
          <div class="stat-card primary">
            <div class="stat-icon">💰</div>
            <div class="stat-info">
              <span class="stat-label">ยอดขายรวม</span>
              <span class="stat-value">{{ formatCurrency(dailyReport.total_sales) }}</span>
            </div>
          </div>

          <div class="stat-card success">
            <div class="stat-icon">📈</div>
            <div class="stat-info">
              <span class="stat-label">กำไร</span>
              <span class="stat-value">{{ formatCurrency(dailyReport.profit) }}</span>
            </div>
          </div>

          <div class="stat-card info">
            <div class="stat-icon">🧾</div>
            <div class="stat-info">
              <span class="stat-label">จำนวนบิล</span>
              <span class="stat-value">{{ dailyReport.bill_count }}</span>
            </div>
          </div>

          <div class="stat-card warning">
            <div class="stat-icon">🏷️</div>
            <div class="stat-info">
              <span class="stat-label">ส่วนลดรวม</span>
              <span class="stat-value">{{ formatCurrency(dailyReport.total_discount) }}</span>
            </div>
          </div>
        </div>

        <!-- Payment Method Breakdown -->
        <div v-if="dailyReport && dailyReport.by_payment_method?.length" class="payment-breakdown">
          <h3>แยกตามวิธีชำระเงิน</h3>
          <div class="payment-methods-list">
            <div v-for="method in dailyReport.by_payment_method" :key="method.payment_method" class="payment-item">
              <span class="method-icon">{{ method.payment_method === 'cash' ? '💵' : '📱' }}</span>
              <span class="method-name">{{ method.payment_method === 'cash' ? 'เงินสด' : 'PromptPay' }}</span>
              <span class="method-count">{{ method.count }} บิล</span>
              <span class="method-total">{{ formatCurrency(method.total) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Monthly Report -->
      <div v-if="activeTab === 'monthly'" class="report-panel">
        <div class="date-filter">
          <label>ปี:</label>
          <select v-model="selectedYear" class="date-input" @change="loadMonthlyReport">
            <option v-for="year in [2024, 2025, 2026]" :key="year" :value="year">{{ year }}</option>
          </select>
          <label>เดือน:</label>
          <select v-model="selectedMonth" class="date-input" @change="loadMonthlyReport">
            <option v-for="(name, index) in monthNames" :key="index" :value="index + 1">
              {{ name }}
            </option>
          </select>
        </div>

        <div v-if="loading" class="loading">
          <div class="loading-spinner"></div>
          กำลังโหลด...
        </div>

        <div v-else-if="monthlyReport" class="stats-grid">
          <div class="stat-card primary">
            <div class="stat-icon">💰</div>
            <div class="stat-info">
              <span class="stat-label">ยอดขายรวม</span>
              <span class="stat-value">{{ formatCurrency(monthlyReport.total_sales) }}</span>
            </div>
          </div>

          <div class="stat-card success">
            <div class="stat-icon">📈</div>
            <div class="stat-info">
              <span class="stat-label">กำไร</span>
              <span class="stat-value">{{ formatCurrency(monthlyReport.profit) }}</span>
            </div>
          </div>

          <div class="stat-card info">
            <div class="stat-icon">🧾</div>
            <div class="stat-info">
              <span class="stat-label">จำนวนบิล</span>
              <span class="stat-value">{{ monthlyReport.bill_count }}</span>
            </div>
          </div>

          <div class="stat-card warning">
            <div class="stat-icon">🏷️</div>
            <div class="stat-info">
              <span class="stat-label">ส่วนลดรวม</span>
              <span class="stat-value">{{ formatCurrency(monthlyReport.total_discount) }}</span>
            </div>
          </div>
        </div>

        <!-- Daily Breakdown -->
        <div v-if="monthlyReport && monthlyReport.daily_breakdown?.length" class="daily-breakdown">
          <h3>ยอดขายรายวัน</h3>
          <div class="daily-chart">
            <div v-for="day in monthlyReport.daily_breakdown" :key="day.date" class="day-bar">
              <div 
                class="bar" 
                :style="{ 
                  height: (day.total_sales / Math.max(...monthlyReport.daily_breakdown.map(d => d.total_sales)) * 100) + '%' 
                }"
                :title="`${day.date}: ${formatCurrency(day.total_sales)}`"
              ></div>
              <span class="day-label">{{ new Date(day.date).getDate() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Products -->
      <div v-if="activeTab === 'products'" class="report-panel">
        <h3>🏆 สินค้าขายดี (30 วันล่าสุด)</h3>

        <div v-if="loading" class="loading">
          <div class="loading-spinner"></div>
          กำลังโหลด...
        </div>

        <div v-else-if="topProducts.length === 0" class="empty-state">
          <span class="empty-icon">📦</span>
          <p>ยังไม่มีข้อมูลการขาย</p>
        </div>

        <div v-else class="products-ranking">
          <div v-for="(product, index) in topProducts" :key="product.product_id" class="ranking-item">
            <div class="rank">
              <span v-if="index === 0" class="medal gold">🥇</span>
              <span v-else-if="index === 1" class="medal silver">🥈</span>
              <span v-else-if="index === 2" class="medal bronze">🥉</span>
              <span v-else class="rank-number">{{ index + 1 }}</span>
            </div>
            <div class="product-info">
              <span class="product-name">{{ product.product_name }}</span>
              <span class="product-stats">
                ขาย {{ product.total_quantity }} ชิ้น | 
                รายได้ {{ formatCurrency(product.total_revenue) }}
              </span>
            </div>
            <div class="product-profit">
              <span class="profit-label">กำไร</span>
              <span class="profit-value">{{ formatCurrency(product.total_profit) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Low Stock -->
      <div v-if="activeTab === 'stock'" class="report-panel">
        <h3>⚠️ สินค้าใกล้หมด (สต็อก ≤ 10)</h3>

        <div v-if="loading" class="loading">
          <div class="loading-spinner"></div>
          กำลังโหลด...
        </div>

        <div v-else-if="lowStock.length === 0" class="empty-state success">
          <span class="empty-icon">✅</span>
          <p>ไม่มีสินค้าที่สต็อกต่ำ</p>
        </div>

        <div v-else class="stock-list">
          <div v-for="product in lowStock" :key="product.id" class="stock-item" :class="{ critical: product.stock <= 5 }">
            <div class="stock-product-info">
              <span class="product-name">{{ product.name }}</span>
              <code class="barcode">{{ product.barcode }}</code>
            </div>
            <div class="stock-level">
              <span class="stock-number">{{ product.stock }}</span>
              <span class="stock-unit">{{ product.unit }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reports-container {
  height: calc(100vh - 60px);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.reports-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.reports-header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #fff;
}

.btn-export {
  padding: 0.8rem 1.5rem;
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-export:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
}

/* Tabs */
.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.tab {
  padding: 0.8rem 1.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tab.active {
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
  color: #fff;
  border-color: transparent;
}

/* Report Content */
.report-content {
  flex: 1;
  overflow-y: auto;
}

.report-panel {
  background: linear-gradient(135deg, #1a1a3e 0%, #252550 100%);
  border-radius: 16px;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Date Filter */
.date-filter {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.date-filter label {
  color: rgba(255, 255, 255, 0.7);
}

.date-input {
  padding: 0.6rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  font-size: 1rem;
}

.date-input:focus {
  outline: none;
  border-color: #7c3aed;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-card.primary {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(0, 212, 255, 0.1));
  border-color: rgba(124, 58, 237, 0.3);
}

.stat-card.success {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1));
  border-color: rgba(16, 185, 129, 0.3);
}

.stat-card.info {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.1));
  border-color: rgba(59, 130, 246, 0.3);
}

.stat-card.warning {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.1));
  border-color: rgba(245, 158, 11, 0.3);
}

.stat-icon {
  font-size: 2.5rem;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.6);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
}

/* Payment Breakdown */
.payment-breakdown h3 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.8);
}

.payment-methods-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.payment-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
}

.method-icon {
  font-size: 1.5rem;
}

.method-name {
  flex: 1;
  font-weight: 500;
}

.method-count {
  color: rgba(255, 255, 255, 0.5);
}

.method-total {
  font-weight: 600;
  color: #00d4ff;
}

/* Daily Chart */
.daily-breakdown h3 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.8);
}

.daily-chart {
  display: flex;
  gap: 4px;
  height: 150px;
  align-items: flex-end;
  padding: 1rem 0;
  overflow-x: auto;
}

.day-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 20px;
  flex: 1;
}

.bar {
  width: 100%;
  background: linear-gradient(180deg, #7c3aed 0%, #00d4ff 100%);
  border-radius: 4px 4px 0 0;
  min-height: 4px;
  transition: all 0.2s;
}

.bar:hover {
  opacity: 0.8;
}

.day-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 0.3rem;
}

/* Products Ranking */
.report-panel h3 {
  margin: 0 0 1.5rem 0;
  font-size: 1.2rem;
  color: #fff;
}

.products-ranking {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  transition: all 0.2s;
}

.ranking-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.rank {
  width: 40px;
  text-align: center;
}

.medal {
  font-size: 1.5rem;
}

.rank-number {
  font-size: 1.2rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
}

.product-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.product-name {
  font-weight: 500;
  color: #fff;
}

.product-stats {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
}

.product-profit {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.profit-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.profit-value {
  font-size: 1.1rem;
  font-weight: 600;
  color: #10b981;
}

/* Stock List */
.stock-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stock-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  border-left: 4px solid #f59e0b;
}

.stock-item.critical {
  border-left-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.stock-product-info {
  display: flex;
  flex-direction: column;
}

.barcode {
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}

.stock-level {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
}

.stock-number {
  font-size: 1.5rem;
  font-weight: 700;
  color: #f59e0b;
}

.stock-item.critical .stock-number {
  color: #ef4444;
}

.stock-unit {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
}

/* Loading & Empty States */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
  color: rgba(255, 255, 255, 0.5);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #7c3aed;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
  color: rgba(255, 255, 255, 0.5);
}

.empty-state.success {
  color: #10b981;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

/* Messages */
.message {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 1rem 2rem;
  border-radius: 10px;
  font-weight: 500;
  z-index: 1000;
  cursor: pointer;
}

.message.error {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  color: #fff;
}

/* Animations */
.slide-enter-active, .slide-leave-active {
  transition: all 0.3s ease;
}
.slide-enter-from, .slide-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}
</style>
