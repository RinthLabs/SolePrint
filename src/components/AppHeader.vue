<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

const scrolled = ref(false)
const menuOpen = ref(false)
const route = useRoute()

function onScroll() {
  scrolled.value = window.scrollY > 10
}

onMounted(() => window.addEventListener('scroll', onScroll))
onUnmounted(() => window.removeEventListener('scroll', onScroll))

function scrollToSection(id) {
  menuOpen.value = false
  if (route.path !== '/') {
    window.location.hash = '#/'
    setTimeout(() => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }, 300)
  } else {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }
}
</script>

<template>
  <header :class="['app-header', { scrolled }]">
    <div class="header-inner">
      <router-link to="/" class="logo">
        <span class="logo-dot"></span>
        <span class="logo-text">SolePrint</span>
      </router-link>

      <nav class="nav-links" :class="{ open: menuOpen }">
        <a href="#" @click.prevent="scrollToSection('how-it-works')">How It Works</a>
        <a href="#" @click.prevent="scrollToSection('mission')">Mission</a>
        <a href="#" @click.prevent="scrollToSection('donate')">Donate</a>
      </nav>

      <router-link to="/upload" class="btn-primary header-cta">Upload Your Sole</router-link>

      <button class="hamburger" @click="menuOpen = !menuOpen" aria-label="Menu">
        <span :class="{ open: menuOpen }"></span>
      </button>
    </div>

    <div v-if="menuOpen" class="mobile-drawer">
      <a href="#" @click.prevent="scrollToSection('how-it-works')">How It Works</a>
      <a href="#" @click.prevent="scrollToSection('mission')">Mission</a>
      <a href="#" @click.prevent="scrollToSection('donate')">Donate</a>
      <router-link to="/upload" class="btn-primary" @click="menuOpen = false">Upload Your Sole</router-link>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(250, 250, 250, 0.85);
  backdrop-filter: blur(12px);
  transition: all 200ms ease;
}

.app-header.scrolled {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 8px rgba(0,0,0,0.06);
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #2ECC8F;
}

.logo-text {
  font-size: 20px;
  font-weight: 600;
  color: #1A1A1A;
}

.nav-links {
  display: flex;
  gap: 32px;
}

.nav-links a {
  font-size: 15px;
  font-weight: 500;
  color: #4A4A4A;
  transition: color 200ms ease;
}

.nav-links a:hover {
  color: #2ECC8F;
}

.header-cta {
  font-size: 14px;
  padding: 10px 22px;
}

.hamburger {
  display: none;
  width: 32px;
  height: 32px;
  position: relative;
}

.hamburger span,
.hamburger span::before,
.hamburger span::after {
  display: block;
  width: 22px;
  height: 2px;
  background: #1A1A1A;
  border-radius: 2px;
  position: absolute;
  left: 5px;
  transition: all 200ms ease;
}

.hamburger span {
  top: 15px;
}

.hamburger span::before {
  content: '';
  top: -7px;
}

.hamburger span::after {
  content: '';
  top: 7px;
}

.hamburger span.open {
  background: transparent;
}

.hamburger span.open::before {
  top: 0;
  transform: rotate(45deg);
}

.hamburger span.open::after {
  top: 0;
  transform: rotate(-45deg);
}

.mobile-drawer {
  display: none;
  flex-direction: column;
  gap: 16px;
  padding: 0 24px 20px;
  animation: slideDown 200ms ease;
}

.mobile-drawer a {
  font-size: 16px;
  font-weight: 500;
  color: #4A4A4A;
  padding: 8px 0;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  .nav-links, .header-cta {
    display: none;
  }
  .hamburger {
    display: block;
  }
  .mobile-drawer {
    display: flex;
  }
}
</style>
