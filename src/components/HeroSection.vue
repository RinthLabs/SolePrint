<script setup>
import { onMounted, ref } from 'vue'

const drawn = ref(false)
onMounted(() => {
  setTimeout(() => { drawn.value = true }, 300)
})
</script>

<template>
  <section class="hero">
    <div class="hero-content">
      <span class="eyebrow">Sustainable Footwear Repair</span>
      <h1>Give Your Shoes a Second Life</h1>
      <p class="subhead">
        Upload a tracing of your shoe sole. We will help you generate a custom 3D
        replacement sole you can have printed locally.
      </p>
      <div class="cta-row">
        <router-link to="/upload" class="btn-primary btn-lg">Upload Your Sole</router-link>
        <a href="#mission" class="btn-ghost btn-lg">Learn How It Works</a>
      </div>

      <div class="sole-visual">
        <svg :class="['sole-svg', { drawn }]" viewBox="0 0 200 420" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            class="sole-outline"
            d="M100 10 C140 10 170 40 175 80 C180 120 175 160 170 200 C165 240 168 280 172 320 C175 350 160 400 100 410 C40 400 25 350 28 320 C32 280 35 240 30 200 C25 160 20 120 25 80 C30 40 60 10 100 10Z"
          />
          <path
            class="sole-fill"
            d="M100 10 C140 10 170 40 175 80 C180 120 175 160 170 200 C165 240 168 280 172 320 C175 350 160 400 100 410 C40 400 25 350 28 320 C32 280 35 240 30 200 C25 160 20 120 25 80 C30 40 60 10 100 10Z"
          />
        </svg>
      </div>
    </div>

    <div class="trust-badges" id="how-it-works">
      <div class="badge">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="#2ECC8F" stroke-width="2"/><path d="M6 10l3 3 5-5" stroke="#2ECC8F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>100% Open Source</span>
      </div>
      <div class="badge">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="#2ECC8F" stroke-width="2"/><path d="M6 10l3 3 5-5" stroke="#2ECC8F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>No Account Required</span>
      </div>
      <div class="badge">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="#2ECC8F" stroke-width="2"/><path d="M6 10l3 3 5-5" stroke="#2ECC8F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>Privacy First</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 80px 24px 40px;
  max-width: 800px;
  margin: 0 auto;
}

.hero-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.eyebrow {
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #2ECC8F;
  margin-bottom: 16px;
}

h1 {
  font-size: 56px;
  font-weight: 700;
  margin-bottom: 20px;
  letter-spacing: -0.02em;
}

.subhead {
  font-size: 18px;
  line-height: 1.7;
  color: #4A4A4A;
  max-width: 560px;
  margin-bottom: 36px;
}

.cta-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.btn-lg {
  padding: 16px 36px;
  font-size: 16px;
}

.sole-visual {
  margin-top: 48px;
  width: 120px;
}

.sole-svg {
  width: 100%;
  height: auto;
}

.sole-outline {
  stroke: #2ECC8F;
  stroke-width: 2;
  stroke-dasharray: 1200;
  stroke-dashoffset: 1200;
  stroke-linecap: round;
  fill: none;
  transition: stroke-dashoffset 2s ease;
}

.sole-fill {
  fill: #2ECC8F;
  opacity: 0;
  transition: opacity 0.8s ease 1.8s;
}

.sole-svg.drawn .sole-outline {
  stroke-dashoffset: 0;
}

.sole-svg.drawn .sole-fill {
  opacity: 0.12;
}

.trust-badges {
  display: flex;
  gap: 32px;
  padding: 32px 0;
  flex-wrap: wrap;
  justify-content: center;
}

.badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #4A4A4A;
}

@media (max-width: 768px) {
  h1 {
    font-size: 36px;
  }
  .subhead {
    font-size: 16px;
  }
  .trust-badges {
    gap: 20px;
  }
}
</style>
