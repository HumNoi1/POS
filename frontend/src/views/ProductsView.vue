<script setup>
import { ref, onMounted, computed } from 'vue';
import { productsApi } from '../services/api';

// State
const products = ref([]);
const loading = ref(false);
const error = ref('');
const success = ref('');
const searchQuery = ref('');
const showForm = ref(false);
const editingProduct = ref(null);

// Form
const form = ref({
  barcode: '',
  name: '',
  price: '',
  cost: '',
  unit: 'ชิ้น',
  stock: 0
});

// Filtered products
const filteredProducts = computed(() => {
  if (!searchQuery.value) return products.value;
  const query = searchQuery.value.toLowerCase();
  return products.value.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.barcode.toLowerCase().includes(query)
  );
});

// Load products
const loadProducts = async () => {
  loading.value = true;
  try {
    const response = await productsApi.getAll();
    products.value = response.data;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// Open form for new product
const openNewProductForm = () => {
  editingProduct.value = null;
  form.value = {
    barcode: '',
    name: '',
    price: '',
    cost: '',
    unit: 'ชิ้น',
    stock: 0
  };
  showForm.value = true;
};

// Open form for edit
const openEditForm = (product) => {
  editingProduct.value = product;
  form.value = {
    barcode: product.barcode,
    name: product.name,
    price: product.price,
    cost: product.cost || '',
    unit: product.unit,
    stock: product.stock
  };
  showForm.value = true;
};

// Save product
const saveProduct = async () => {
  if (!form.value.barcode || !form.value.name || !form.value.price) {
    error.value = 'กรุณากรอกบาร์โค้ด ชื่อ และราคา';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const productData = {
      ...form.value,
      price: parseFloat(form.value.price),
      cost: parseFloat(form.value.cost) || 0,
      stock: parseInt(form.value.stock) || 0
    };

    if (editingProduct.value) {
      await productsApi.update(editingProduct.value.id, productData);
      success.value = 'อัพเดทสินค้าสำเร็จ';
    } else {
      await productsApi.create(productData);
      success.value = 'เพิ่มสินค้าสำเร็จ';
    }

    showForm.value = false;
    await loadProducts();
    setTimeout(() => success.value = '', 2000);
  } catch (err) {
    error.value = err.response?.data?.error || err.message;
  } finally {
    loading.value = false;
  }
};

// Delete product
const deleteProduct = async (product) => {
  if (!confirm(`ลบสินค้า "${product.name}"?`)) return;

  try {
    await productsApi.delete(product.id);
    success.value = 'ลบสินค้าสำเร็จ';
    await loadProducts();
    setTimeout(() => success.value = '', 2000);
  } catch (err) {
    error.value = err.response?.data?.error || err.message;
  }
};

// Update stock
const updateStock = async (product, adjustment) => {
  try {
    await productsApi.updateStock(product.id, adjustment);
    await loadProducts();
  } catch (err) {
    error.value = err.response?.data?.error || err.message;
  }
};

onMounted(() => {
  loadProducts();
});
</script>

<template>
  <div class="products-container">
    <!-- Messages -->
    <Transition name="slide">
      <div v-if="error" class="message error" @click="error = ''">
        ❌ {{ error }}
      </div>
    </Transition>
    <Transition name="slide">
      <div v-if="success" class="message success">
        {{ success }}
      </div>
    </Transition>

    <!-- Header -->
    <div class="products-header">
      <h1>📦 จัดการสินค้า</h1>
      <div class="header-actions">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="ค้นหาสินค้าหรือบาร์โค้ด..."
            class="search-input"
          />
        </div>
        <button class="btn btn-primary" @click="openNewProductForm">
          ➕ เพิ่มสินค้า
        </button>
      </div>
    </div>

    <!-- Products Table -->
    <div class="products-table-container">
      <table class="products-table">
        <thead>
          <tr>
            <th>บาร์โค้ด</th>
            <th>ชื่อสินค้า</th>
            <th class="text-right">ราคาขาย</th>
            <th class="text-right">ต้นทุน</th>
            <th>หน่วย</th>
            <th class="text-center">สต็อก</th>
            <th class="text-center">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="loading-cell">
              <div class="loading-spinner"></div>
              กำลังโหลด...
            </td>
          </tr>
          <tr v-else-if="filteredProducts.length === 0">
            <td colspan="7" class="empty-cell">
              <span class="empty-icon">📦</span>
              <p v-if="searchQuery">ไม่พบสินค้าที่ค้นหา</p>
              <p v-else>ยังไม่มีสินค้า</p>
            </td>
          </tr>
          <tr v-for="product in filteredProducts" :key="product.id">
            <td>
              <code class="barcode">{{ product.barcode }}</code>
            </td>
            <td class="product-name">{{ product.name }}</td>
            <td class="text-right price">฿{{ product.price.toFixed(2) }}</td>
            <td class="text-right cost">฿{{ (product.cost || 0).toFixed(2) }}</td>
            <td>{{ product.unit }}</td>
            <td class="text-center">
              <div class="stock-control">
                <button class="stock-btn" @click="updateStock(product, -1)" :disabled="product.stock <= 0">−</button>
                <span :class="['stock-value', { low: product.stock <= 10 }]">{{ product.stock }}</span>
                <button class="stock-btn" @click="updateStock(product, 1)">+</button>
              </div>
            </td>
            <td class="text-center">
              <div class="action-btns">
                <button class="action-btn edit" @click="openEditForm(product)" title="แก้ไข">✏️</button>
                <button class="action-btn delete" @click="deleteProduct(product)" title="ลบ">🗑️</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Product count -->
    <div class="products-footer">
      <span>ทั้งหมด {{ products.length }} รายการ</span>
    </div>

    <!-- Add/Edit Form Modal -->
    <Transition name="modal">
      <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
        <div class="modal">
          <h3>{{ editingProduct ? '✏️ แก้ไขสินค้า' : '➕ เพิ่มสินค้าใหม่' }}</h3>
          
          <div class="form-group">
            <label>บาร์โค้ด *</label>
            <input 
              v-model="form.barcode" 
              type="text" 
              class="input" 
              placeholder="สแกนหรือพิมพ์บาร์โค้ด"
              :disabled="!!editingProduct"
            />
          </div>

          <div class="form-group">
            <label>ชื่อสินค้า *</label>
            <input 
              v-model="form.name" 
              type="text" 
              class="input" 
              placeholder="ระบุชื่อสินค้า"
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>ราคาขาย *</label>
              <input 
                v-model="form.price" 
                type="number" 
                step="0.01" 
                class="input" 
                placeholder="0.00"
              />
            </div>
            <div class="form-group">
              <label>ต้นทุน</label>
              <input 
                v-model="form.cost" 
                type="number" 
                step="0.01" 
                class="input" 
                placeholder="0.00"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>หน่วย</label>
              <select v-model="form.unit" class="input">
                <option value="ชิ้น">ชิ้น</option>
                <option value="กล่อง">กล่อง</option>
                <option value="แพ็ค">แพ็ค</option>
                <option value="ขวด">ขวด</option>
                <option value="กระป๋อง">กระป๋อง</option>
                <option value="ซอง">ซอง</option>
                <option value="ถุง">ถุง</option>
                <option value="kg">kg</option>
              </select>
            </div>
            <div class="form-group">
              <label>สต็อก</label>
              <input 
                v-model="form.stock" 
                type="number" 
                class="input" 
                placeholder="0"
              />
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" @click="showForm = false">ยกเลิก</button>
            <button class="btn btn-primary" @click="saveProduct" :disabled="loading">
              {{ loading ? 'กำลังบันทึก...' : 'บันทึก' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.products-container {
  height: calc(100vh - 60px);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.products-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.products-header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #fff;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-box {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 0.5rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.search-icon {
  margin-right: 0.5rem;
}

.search-input {
  background: none;
  border: none;
  color: #fff;
  font-size: 1rem;
  width: 250px;
  outline: none;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.btn {
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* Table */
.products-table-container {
  flex: 1;
  background: linear-gradient(135deg, #1a1a3e 0%, #252550 100%);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.products-table {
  width: 100%;
  border-collapse: collapse;
}

.products-table thead {
  background: rgba(255, 255, 255, 0.05);
  position: sticky;
  top: 0;
}

.products-table th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.products-table tbody {
  display: block;
  max-height: calc(100vh - 280px);
  overflow-y: auto;
}

.products-table thead, .products-table tbody tr {
  display: table;
  width: 100%;
  table-layout: fixed;
}

.products-table td {
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  vertical-align: middle;
}

.products-table tbody tr {
  transition: background 0.2s;
}

.products-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.05);
}

.text-right {
  text-align: right;
}

.text-center {
  text-align: center;
}

.barcode {
  font-family: 'Courier New', monospace;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  font-size: 0.9rem;
}

.product-name {
  font-weight: 500;
}

.price {
  color: #00d4ff;
  font-weight: 600;
}

.cost {
  color: rgba(255, 255, 255, 0.5);
}

/* Stock Control */
.stock-control {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.stock-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.stock-btn:hover:not(:disabled) {
  background: rgba(124, 58, 237, 0.5);
}

.stock-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.stock-value {
  min-width: 40px;
  text-align: center;
  font-weight: 600;
}

.stock-value.low {
  color: #f59e0b;
}

/* Action Buttons */
.action-btns {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.action-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.edit:hover {
  background: rgba(59, 130, 246, 0.3);
}

.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.3);
}

/* Footer */
.products-footer {
  padding: 1rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
}

/* Loading & Empty States */
.loading-cell, .empty-cell {
  text-align: center;
  padding: 3rem !important;
  color: rgba(255, 255, 255, 0.5);
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #7c3aed;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 3rem;
  opacity: 0.3;
  display: block;
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

.message.success {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: linear-gradient(135deg, #1e1e3f 0%, #2d2d5a 100%);
  border-radius: 20px;
  padding: 2rem;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.modal h3 {
  margin: 0 0 1.5rem 0;
  font-size: 1.4rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.8);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.input {
  width: 100%;
  padding: 0.8rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 1rem;
  transition: all 0.2s;
  box-sizing: border-box;
}

.input:focus {
  outline: none;
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2);
}

.input:disabled {
  opacity: 0.5;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.modal-actions .btn {
  flex: 1;
}

/* Animations */
.modal-enter-active, .modal-leave-active {
  transition: all 0.3s ease;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal, .modal-leave-to .modal {
  transform: scale(0.9);
}

.slide-enter-active, .slide-leave-active {
  transition: all 0.3s ease;
}
.slide-enter-from, .slide-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}
</style>
