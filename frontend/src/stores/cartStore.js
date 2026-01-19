import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useCartStore = defineStore('cart', () => {
    const items = ref([]);
    const discount = ref(0);

    // Computed
    const subtotal = computed(() => {
        return items.value.reduce((sum, item) => sum + item.subtotal, 0);
    });

    const total = computed(() => {
        return Math.max(0, subtotal.value - discount.value);
    });

    const itemCount = computed(() => {
        return items.value.reduce((sum, item) => sum + item.quantity, 0);
    });

    const isEmpty = computed(() => items.value.length === 0);

    // Actions
    function addItem(product) {
        const existingIndex = items.value.findIndex(item => item.product_id === product.id);
        
        if (existingIndex > -1) {
            // If product exists, increase quantity
            items.value[existingIndex].quantity += 1;
            items.value[existingIndex].subtotal = items.value[existingIndex].quantity * items.value[existingIndex].price;
        } else {
            // Add new item
            items.value.push({
                product_id: product.id,
                product_name: product.name,
                barcode: product.barcode,
                price: product.price,
                cost: product.cost || 0,
                unit: product.unit,
                quantity: 1,
                subtotal: product.price
            });
        }
    }

    function removeItem(productId) {
        const index = items.value.findIndex(item => item.product_id === productId);
        if (index > -1) {
            items.value.splice(index, 1);
        }
    }

    function updateQuantity(productId, quantity) {
        const item = items.value.find(item => item.product_id === productId);
        if (item) {
            if (quantity <= 0) {
                removeItem(productId);
            } else {
                item.quantity = quantity;
                item.subtotal = item.quantity * item.price;
            }
        }
    }

    function increaseQuantity(productId) {
        const item = items.value.find(item => item.product_id === productId);
        if (item) {
            item.quantity += 1;
            item.subtotal = item.quantity * item.price;
        }
    }

    function decreaseQuantity(productId) {
        const item = items.value.find(item => item.product_id === productId);
        if (item) {
            if (item.quantity <= 1) {
                removeItem(productId);
            } else {
                item.quantity -= 1;
                item.subtotal = item.quantity * item.price;
            }
        }
    }

    function setDiscount(amount) {
        discount.value = Math.max(0, amount);
    }

    function clearCart() {
        items.value = [];
        discount.value = 0;
    }

    function loadFromHeldBill(billData) {
        items.value = billData.items || [];
        discount.value = billData.discount || 0;
    }

    function getCartData() {
        return {
            items: items.value,
            discount: discount.value,
            subtotal: subtotal.value,
            total: total.value
        };
    }

    return {
        items,
        discount,
        subtotal,
        total,
        itemCount,
        isEmpty,
        addItem,
        removeItem,
        updateQuantity,
        increaseQuantity,
        decreaseQuantity,
        setDiscount,
        clearCart,
        loadFromHeldBill,
        getCartData
    };
});
