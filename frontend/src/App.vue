<script setup>
import { RouterView } from 'vue-router';
import NavBar from './components/NavBar.vue';
</script>

<template>
  <div class="app-container">
    <NavBar />
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%);
}

.main-content {
  flex: 1;
  padding: 0;
  overflow: hidden;
}
</style>
