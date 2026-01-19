<script setup>
import { useRoute } from 'vue-router';
import { computed } from 'vue';

const route = useRoute();

const isActive = (path) => {
  return route.path === path;
};
</script>

<template>
  <nav class="navbar">
    <div class="nav-brand">
      <span class="brand-icon">🛒</span>
      <span class="brand-text">POS</span>
    </div>
    <div class="nav-links">
      <router-link to="/" :class="{ active: isActive('/') }">
        <span class="nav-icon">💳</span>
        <span class="nav-text">ขายสินค้า</span>
      </router-link>
      <router-link to="/products" :class="{ active: isActive('/products') }">
        <span class="nav-icon">📦</span>
        <span class="nav-text">สินค้า</span>
      </router-link>
      <router-link to="/reports" :class="{ active: isActive('/reports') }">
        <span class="nav-icon">📊</span>
        <span class="nav-text">รายงาน</span>
      </router-link>
    </div>
    <div class="nav-time">
      {{ new Date().toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) }}
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  height: 60px;
  background: linear-gradient(90deg, #1e1e3f 0%, #2d2d5a 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.brand-icon {
  font-size: 1.5rem;
}

.brand-text {
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #00d4ff, #7c3aed);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.nav-links {
  display: flex;
  gap: 0.5rem;
}

.nav-links a {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  border-radius: 10px;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
  transition: all 0.2s ease;
  position: relative;
}

.nav-links a:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-links a.active {
  background: linear-gradient(135deg, #7c3aed 0%, #00d4ff 100%);
  color: #fff;
  box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
}

.nav-icon {
  font-size: 1.1rem;
}

.shortcut {
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.6);
  margin-left: 0.3rem;
}

.nav-time {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
}
</style>
