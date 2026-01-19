<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useCartStore } from '../stores/cartStore';
import { productsApi, salesApi } from '../services/api';

const cartStore = useCartStore();

// Refs
const barcodeInput = ref('');
const barcodeInputRef = ref(null);
const searchResults = ref([]);
const showQuickAdd = ref(false);
const showCheckout = ref(false);
const showHeldBills = ref(false);
const heldBills = ref([]);
const loading = ref(false);
const error = ref('');
const success = ref('');

// Quick Add Product Form
const quickAddForm = ref({
  barcode: '',
  name: '',
  price: '',
  cost: '',
  unit: 'ชิ้น',
  stock: 0
});

// Checkout
const paymentMethod = ref('cash');
const cashReceived = ref('');

const changeAmount = computed(() => {
  if (paymentMethod.value !== 'cash' || !cashReceived.value) return 0;
  return Math.max(0, parseFloat(cashReceived.value) - cartStore.total);
});

// Focus barcode input
const focusBarcodeInput = () => {
  nextTick(() => {
    barcodeInputRef.value?.focus();
  });
};

// Handle barcode scan/input
const handleBarcodeSubmit = async () => {
  if (!barcodeInput.value.trim()) return;
  
  error.value = '';
  const barcode = barcodeInput.value.trim();
  
  try {
    const response = await productsApi.getByBarcode(barcode);
    cartStore.addItem(response.data);
    barcodeInput.value = '';
    success.value = `เพิ่ม ${response.data.name} แล้ว`;
    setTimeout(() => success.value = '', 2000);
  } catch (err) {
    if (err.response?.status === 404) {
      // Product not found, show quick add form
      quickAddForm.value.barcode = barcode;
      showQuickAdd.value = true;
    } else {
      error.value = 'เกิดข้อผิดพลาด: ' + err.message;
    }
  }
  
  focusBarcodeInput();
};

// Quick add product
const handleQuickAdd = async () => {
  if (!quickAddForm.value.name || !quickAddForm.value.price) {
    error.value = 'กรุณากรอกชื่อและราคา';
    return;
  }
  
  loading.value = true;
  try {
    const response = await productsApi.create({
      ...quickAddForm.value,
      price: parseFloat(quickAddForm.value.price),
      cost: parseFloat(quickAddForm.value.cost) || 0
    });
    cartStore.addItem(response.data);
    showQuickAdd.value = false;
    quickAddForm.value = { barcode: '', name: '', price: '', cost: '', unit: 'ชิ้น', stock: 0 };
    success.value = 'เพิ่มสินค้าใหม่และเพิ่มลงตะกร้าแล้ว';
    setTimeout(() => success.value = '', 2000);
    barcodeInput.value = '';
  } catch (err) {
    error.value = err.response?.data?.error || err.message;
  } finally {
    loading.value = false;
    focusBarcodeInput();
  }
};

// Checkout
const handleCheckout = async () => {
  if (cartStore.isEmpty) {
    error.value = 'ตะกร้าว่าง';
    return;
  }

  if (paymentMethod.value === 'cash' && (!cashReceived.value || parseFloat(cashReceived.value) < cartStore.total)) {
    error.value = 'เงินที่รับไม่เพียงพอ';
    return;
  }
  
  loading.value = true;
  try {
    const saleData = {
      items: cartStore.items,
      subtotal: cartStore.subtotal,
      discount: cartStore.discount,
      total: cartStore.total,
      payment_method: paymentMethod.value,
      cash_received: paymentMethod.value === 'cash' ? parseFloat(cashReceived.value) : null,
      change_amount: paymentMethod.value === 'cash' ? changeAmount.value : null
    };
    
    await salesApi.create(saleData);
    cartStore.clearCart();
    showCheckout.value = false;
    cashReceived.value = '';
    success.value = '✅ บันทึกการขายสำเร็จ!';
    setTimeout(() => success.value = '', 3000);
  } catch (err) {
    error.value = err.response?.data?.error || err.message;
  } finally {
    loading.value = false;
    focusBarcodeInput();
  }
};

// Hold bill
const handleHoldBill = async () => {
  if (cartStore.isEmpty) return;
  
  try {
    await salesApi.holdBill({ cart_data: cartStore.getCartData() });
    cartStore.clearCart();
    success.value = 'พักบิลแล้ว';
    setTimeout(() => success.value = '', 2000);
  } catch (err) {
    error.value = err.message;
  }
  focusBarcodeInput();
};

// Load held bills
const loadHeldBills = async () => {
  try {
    const response = await salesApi.getHeldBills();
    heldBills.value = response.data;
    showHeldBills.value = true;
  } catch (err) {
    error.value = err.message;
  }
};

// Resume held bill
const resumeHeldBill = async (bill) => {
  cartStore.loadFromHeldBill(bill.cart_data);
  await salesApi.deleteHeldBill(bill.id);
  showHeldBills.value = false;
  focusBarcodeInput();
};

// Void/Clear cart
const handleVoid = () => {
  if (confirm('ล้างตะกร้าทั้งหมด?')) {
    cartStore.clearCart();
    focusBarcodeInput();
  }
};

// Keyboard shortcuts
const handleKeydown = (e) => {
  // Don't trigger shortcuts if modal is open
  if (showQuickAdd.value || showCheckout.value || showHeldBills.value) {
    if (e.key === 'Escape') {
      showQuickAdd.value = false;
      showCheckout.value = false;
      showHeldBills.value = false;
      focusBarcodeInput();
    }
    return;
  }
  
  switch(e.key) {
    case 'F2':
      e.preventDefault();
      focusBarcodeInput();
      break;
    case 'F9':
      e.preventDefault();
      if (!cartStore.isEmpty) {
        showCheckout.value = true;
      }
      break;
    case 'Escape':
      e.preventDefault();
      barcodeInput.value = '';
      focusBarcodeInput();
      break;
  }
};

onMounted(() => {
  focusBarcodeInput();
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

// Preset amounts for quick cash selection
const presetAmounts = [20, 50, 100, 500, 1000];
</script>

<template>
  <div class="pos-container">
    <!-- Error/Success Messages -->
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

    <!-- Main POS Layout -->
    <div class="pos-layout">
      <!-- Left: Scanner & Cart -->
      <div class="pos-left">
        <!-- Barcode Scanner Zone -->
        <div class="scanner-zone">
          <div class="scanner-icon">🔍</div>
          <input
            ref="barcodeInputRef"
            v-model="barcodeInput"
            @keyup.enter="handleBarcodeSubmit"
            type="text"
            placeholder="สแกนบาร์โค้ดหรือพิมพ์รหัสสินค้า..."
            class="barcode-input"
            autocomplete="off"
          />
          <div class="scanner-hint">กด Enter เพื่อเพิ่มสินค้า | F2 = Focus | Esc = Clear</div>
        </div>

        <!-- Shopping Cart -->
        <div class="cart-zone">
          <div class="cart-header">
            <h2>🛒 ตะกร้าสินค้า</h2>
            <span class="item-count">{{ cartStore.itemCount }} รายการ</span>
          </div>
          
          <div class="cart-items" v-if="!cartStore.isEmpty">
            <div class="cart-table">
              <div class="cart-table-header">
                <span class="col-name">สินค้า</span>
                <span class="col-price">ราคา</span>
                <span class="col-qty">จำนวน</span>
                <span class="col-total">รวม</span>
                <span class="col-action"></span>
              </div>
              <TransitionGroup name="list" tag="div" class="cart-table-body">
                <div v-for="item in cartStore.items" :key="item.product_id" class="cart-row">
                  <span class="col-name">
                    <span class="product-name">{{ item.product_name }}</span>
                    <span class="product-barcode">{{ item.barcode }}</span>
                  </span>
                  <span class="col-price">฿{{ item.price.toFixed(2) }}</span>
                  <span class="col-qty">
                    <button class="qty-btn" @click="cartStore.decreaseQuantity(item.product_id)">−</button>
                    <span class="qty-value">{{ item.quantity }}</span>
                    <button class="qty-btn" @click="cartStore.increaseQuantity(item.product_id)">+</button>
                  </span>
                  <span class="col-total">฿{{ item.subtotal.toFixed(2) }}</span>
                  <span class="col-action">
                    <button class="delete-btn" @click="cartStore.removeItem(item.product_id)">🗑️</button>
                  </span>
                </div>
              </TransitionGroup>
            </div>
          </div>
          
          <div v-else class="cart-empty">
            <div class="empty-icon">📦</div>
            <p>ยังไม่มีสินค้าในตะกร้า</p>
            <p class="empty-hint">สแกนบาร์โค้ดเพื่อเริ่มต้น</p>
          </div>
        </div>
      </div>

      <!-- Right: Bill Summary -->
      <div class="pos-right">
        <div class="summary-zone">
          <h2>📋 สรุปบิล</h2>
          
          <div class="summary-rows">
            <div class="summary-row">
              <span>ยอดรวม</span>
              <span>฿{{ cartStore.subtotal.toFixed(2) }}</span>
            </div>
            <div class="summary-row discount">
              <span>ส่วนลด</span>
              <input 
                type="number" 
                :value="cartStore.discount"
                @input="cartStore.setDiscount(parseFloat($event.target.value) || 0)"
                class="discount-input"
                placeholder="0"
              />
            </div>
            <div class="summary-row total">
              <span>ยอดสุทธิ</span>
              <span class="total-amount">฿{{ cartStore.total.toFixed(2) }}</span>
            </div>
          </div>

          <div class="action-buttons">
            <button 
              class="btn btn-checkout" 
              @click="showCheckout = true"
              :disabled="cartStore.isEmpty"
            >
              💳 ชำระเงิน (F9)
            </button>
            <div class="btn-row">
              <button class="btn btn-hold" @click="handleHoldBill" :disabled="cartStore.isEmpty">
                ⏸️ พักบิล
              </button>
              <button class="btn btn-recall" @click="loadHeldBills">
                📥 เรียกบิล
              </button>
            </div>
            <button class="btn btn-void" @click="handleVoid" :disabled="cartStore.isEmpty">
              🗑️ ยกเลิก
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Add Modal -->
    <Transition name="modal">
      <div v-if="showQuickAdd" class="modal-overlay" @click.self="showQuickAdd = false">
        <div class="modal">
          <h3>➕ เพิ่มสินค้าใหม่</h3>
          <p class="modal-subtitle">ไม่พบบาร์โค้ด: {{ quickAddForm.barcode }}</p>
          
          <div class="form-group">
            <label>บาร์โค้ด</label>
            <input v-model="quickAddForm.barcode" type="text" disabled class="input disabled" />
          </div>
          <div class="form-group">
            <label>ชื่อสินค้า *</label>
            <input v-model="quickAddForm.name" type="text" class="input" placeholder="ระบุชื่อสินค้า" @keyup.enter="handleQuickAdd" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>ราคาขาย *</label>
              <input v-model="quickAddForm.price" type="number" step="0.01" class="input" placeholder="0.00" />
            </div>
            <div class="form-group">
              <label>ต้นทุน</label>
              <input v-model="quickAddForm.cost" type="number" step="0.01" class="input" placeholder="0.00" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>หน่วย</label>
              <select v-model="quickAddForm.unit" class="input">
                <option value="ชิ้น">ชิ้น</option>
                <option value="กล่อง">กล่อง</option>
                <option value="แพ็ค">แพ็ค</option>
                <option value="ขวด">ขวด</option>
                <option value="กระป๋อง">กระป๋อง</option>
                <option value="ซอง">ซอง</option>
                <option value="ถุง">ถุง</option>
              </select>
            </div>
            <div class="form-group">
              <label>สต็อก</label>
              <input v-model="quickAddForm.stock" type="number" class="input" placeholder="0" />
            </div>
          </div>
          
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="showQuickAdd = false">ยกเลิก</button>
            <button class="btn btn-primary" @click="handleQuickAdd" :disabled="loading">
              {{ loading ? 'กำลังบันทึก...' : 'บันทึกและเพิ่มลงตะกร้า' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Checkout Modal -->
    <Transition name="modal">
      <div v-if="showCheckout" class="modal-overlay" @click.self="showCheckout = false">
        <div class="modal checkout-modal">
          <h3>💳 ชำระเงิน</h3>
          
          <div class="checkout-total">
            <span>ยอดที่ต้องชำระ</span>
            <span class="amount">฿{{ cartStore.total.toFixed(2) }}</span>
          </div>

          <div class="payment-methods">
            <button 
              :class="['payment-btn', { active: paymentMethod === 'cash' }]"
              @click="paymentMethod = 'cash'"
            >
              💵 เงินสด
            </button>
            <button 
              :class="['payment-btn', { active: paymentMethod === 'promptpay' }]"
              @click="paymentMethod = 'promptpay'"
            >
              📱 PromptPay
            </button>
          </div>

          <div v-if="paymentMethod === 'cash'" class="cash-section">
            <div class="form-group">
              <label>รับเงิน</label>
              <input 
                v-model="cashReceived" 
                type="number" 
                step="0.01" 
                class="input cash-input"
                placeholder="0.00"
                @keyup.enter="handleCheckout"
              />
            </div>
            <div class="preset-amounts">
              <button 
                v-for="amount in presetAmounts" 
                :key="amount"
                class="preset-btn"
                @click="cashReceived = amount"
              >
                ฿{{ amount }}
              </button>
              <button class="preset-btn exact" @click="cashReceived = cartStore.total">
                พอดี
              </button>
            </div>
            <div v-if="cashReceived && parseFloat(cashReceived) >= cartStore.total" class="change-display">
              <span>เงินทอน</span>
              <span class="change-amount">฿{{ changeAmount.toFixed(2) }}</span>
            </div>
          </div>

          <div v-if="paymentMethod === 'promptpay'" class="promptpay-section">
            <div class="qr-container">
              <img src="/promptpay-qr.jpg" alt="PromptPay QR Code" class="qr-image" />
              <div class="qr-info">
                <p class="qr-label">สแกน QR Code เพื่อชำระเงิน</p>
                <p class="qr-amount">ยอด ฿{{ cartStore.total.toFixed(2) }}</p>
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" @click="showCheckout = false">ยกเลิก</button>
            <button 
              class="btn btn-success" 
              @click="handleCheckout" 
              :disabled="loading || (paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < cartStore.total))"
            >
              {{ loading ? 'กำลังบันทึก...' : '✅ ยืนยันชำระเงิน' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Held Bills Modal -->
    <Transition name="modal">
      <div v-if="showHeldBills" class="modal-overlay" @click.self="showHeldBills = false">
        <div class="modal">
          <h3>📥 บิลที่พัก</h3>
          
          <div v-if="heldBills.length === 0" class="empty-state">
            <p>ไม่มีบิลที่พัก</p>
          </div>
          
          <div v-else class="held-bills-list">
            <div 
              v-for="bill in heldBills" 
              :key="bill.id" 
              class="held-bill-item"
              @click="resumeHeldBill(bill)"
            >
              <div class="bill-info">
                <span class="bill-items">{{ bill.cart_data.items.length }} รายการ</span>
                <span class="bill-total">฿{{ bill.cart_data.total.toFixed(2) }}</span>
              </div>
              <div class="bill-time">
                {{ new Date(bill.created_at).toLocaleString('th-TH') }}
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" @click="showHeldBills = false">ปิด</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.pos-container {
  height: calc(100vh - 60px);
  padding: 1rem;
  overflow: hidden;
  position: relative;
}

.pos-layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 1rem;
  height: 100%;
}

/* Scanner Zone */
.pos-left {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
}

.scanner-zone {
  background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.scanner-icon {
  font-size: 2rem;
}

.barcode-input {
  flex: 1;
  padding: 1rem 1.5rem;
  font-size: 1.2rem;
  border: none;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  color: #1a1a2e;
  outline: none;
  transition: all 0.3s ease;
}

.barcode-input:focus {
  box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.5);
  transform: scale(1.01);
}

.scanner-hint {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}

/* Cart Zone */
.cart-zone {
  flex: 1;
  background: linear-gradient(135deg, #1a1a3e 0%, #252550 100%);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.cart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.cart-header h2 {
  font-size: 1.3rem;
  margin: 0;
  color: #fff;
}

.item-count {
  background: linear-gradient(135deg, #7c3aed, #00d4ff);
  padding: 0.3rem 0.8rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
}

.cart-items {
  flex: 1;
  overflow-y: auto;
}

.cart-table {
  width: 100%;
}

.cart-table-header {
  display: grid;
  grid-template-columns: 2fr 1fr 1.2fr 1fr 50px;
  gap: 0.5rem;
  padding: 0.8rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 0.5rem;
}

.cart-table-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cart-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1.2fr 1fr 50px;
  gap: 0.5rem;
  padding: 1rem 0.8rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  align-items: center;
  transition: all 0.2s ease;
}

.cart-row:hover {
  background: rgba(255, 255, 255, 0.08);
}

.col-name {
  display: flex;
  flex-direction: column;
}

.product-name {
  font-weight: 500;
  color: #fff;
}

.product-barcode {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.col-qty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.qty-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(124, 58, 237, 0.3);
  color: #fff;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.qty-btn:hover {
  background: rgba(124, 58, 237, 0.6);
  transform: scale(1.1);
}

.qty-value {
  min-width: 30px;
  text-align: center;
  font-weight: 600;
}

.col-total {
  font-weight: 600;
  color: #00d4ff;
}

.delete-btn {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  opacity: 0.5;
  transition: all 0.2s;
}

.delete-btn:hover {
  opacity: 1;
  transform: scale(1.2);
}

/* Cart Empty */
.cart-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.3;
}

.empty-hint {
  font-size: 0.85rem;
  opacity: 0.6;
}

/* Summary Zone */
.pos-right {
  height: 100%;
}

.summary-zone {
  height: 100%;
  background: linear-gradient(135deg, #1a1a3e 0%, #252550 100%);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.summary-zone h2 {
  font-size: 1.3rem;
  margin: 0 0 1.5rem 0;
  color: #fff;
}

.summary-rows {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  font-size: 1.1rem;
}

.summary-row.total {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.3), rgba(0, 212, 255, 0.3));
  margin-top: auto;
}

.total-amount {
  font-size: 2rem;
  font-weight: 700;
  background: linear-gradient(135deg, #00d4ff, #7c3aed);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.discount-input {
  width: 100px;
  padding: 0.5rem;
  text-align: right;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 1rem;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin-top: 1.5rem;
}

.btn {
  padding: 1rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-checkout {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
  font-size: 1.2rem;
  padding: 1.2rem;
}

.btn-checkout:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
}

.btn-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.btn-hold, .btn-recall {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-hold:hover:not(:disabled), .btn-recall:hover {
  background: rgba(255, 255, 255, 0.2);
}

.btn-void {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-void:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.3);
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
  max-width: 450px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.modal h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.4rem;
}

.modal-subtitle {
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 1.5rem;
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

.input.disabled {
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

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.btn-primary {
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
  color: #fff;
}

.btn-success {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
}

/* Checkout Modal */
.checkout-modal {
  max-width: 500px;
}

.checkout-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(0, 212, 255, 0.2));
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

.checkout-total .amount {
  font-size: 2rem;
  font-weight: 700;
  color: #00d4ff;
}

.payment-methods {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.payment-btn {
  padding: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.payment-btn.active {
  border-color: #7c3aed;
  background: rgba(124, 58, 237, 0.2);
}

.cash-input {
  font-size: 1.5rem;
  text-align: center;
}

.preset-amounts {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.preset-btn {
  padding: 0.5rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.preset-btn.exact {
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
  border: none;
}

.change-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: rgba(16, 185, 129, 0.2);
  border-radius: 10px;
  margin-top: 1rem;
}

.change-amount {
  font-size: 1.5rem;
  font-weight: 700;
  color: #10b981;
}

.promptpay-section {
  text-align: center;
  padding: 1rem;
}

.qr-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.qr-image {
  max-width: 280px;
  width: 100%;
  height: auto;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.qr-info {
  text-align: center;
}

.qr-label {
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 0.5rem 0;
}

.qr-amount {
  font-size: 1.3rem;
  font-weight: 700;
  color: #00d4ff;
  margin: 0;
}

/* Held Bills */
.held-bills-list {
  max-height: 300px;
  overflow-y: auto;
}

.held-bill-item {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.held-bill-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.bill-info {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
}

.bill-total {
  color: #00d4ff;
}

.bill-time {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 0.3rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: rgba(255, 255, 255, 0.5);
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

.list-enter-active, .list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from, .list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>
