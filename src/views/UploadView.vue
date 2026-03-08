<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import StepIndicator from '../components/StepIndicator.vue'
import UploadZone from '../components/UploadZone.vue'
import ImageTools from '../components/ImageTools.vue'

const router = useRouter()
const instructionsOpen = ref(false)

function onContinue() {
  router.push('/preview')
}
</script>

<template>
  <div class="upload-view">
    <div class="upload-inner">
      <StepIndicator :current="1" />

      <h2>Upload Your Sole Tracing</h2>
      <p class="subtitle">Take a photo of your shoe sole tracing to get started.</p>

      <UploadZone />
      <ImageTools @continue="onContinue" />

      <div class="instructions">
        <button class="instructions-toggle" @click="instructionsOpen = !instructionsOpen">
          <span>How to get a good tracing</span>
          <svg :class="['chevron', { open: instructionsOpen }]" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <transition name="slide">
          <ol v-if="instructionsOpen" class="instructions-list">
            <li>Place shoe sole-down on white paper</li>
            <li>Trace carefully around the entire edge</li>
            <li>Mark the longest toe and heel points</li>
            <li>Include a ruler or credit card for scale</li>
            <li>Photograph from directly above in good light</li>
          </ol>
        </transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload-view {
  padding: 40px 24px 80px;
}

.upload-inner {
  max-width: 640px;
  margin: 0 auto;
}

h2 {
  font-size: 28px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 8px;
}

.subtitle {
  text-align: center;
  font-size: 15px;
  color: #999;
  margin-bottom: 32px;
}

.instructions {
  margin-top: 24px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.06);
  overflow: hidden;
}

.instructions-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  font-size: 15px;
  font-weight: 600;
  color: #1A1A1A;
  transition: color 200ms ease;
}

.instructions-toggle:hover {
  color: #2ECC8F;
}

.chevron {
  transition: transform 200ms ease;
}

.chevron.open {
  transform: rotate(180deg);
}

.instructions-list {
  padding: 0 24px 20px 44px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.instructions-list li {
  font-size: 14px;
  color: #4A4A4A;
  line-height: 1.5;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 200ms ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 300px;
}
</style>
