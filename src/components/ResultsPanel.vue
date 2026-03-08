<script setup>
import { ref } from 'vue'
import { useSoleStore } from '../stores/soleStore'

const store = useSoleStore()

const emit = defineEmits(['toast'])

function exportSTL() {
  emit('toast', { message: 'STL export coming soon!', type: 'info' })
}

function exportOBJ() {
  emit('toast', { message: 'OBJ export coming soon!', type: 'info' })
}

const copied = ref(false)
function copyLink() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    copied.value = true
    emit('toast', { message: 'Link copied to clipboard!', type: 'success' })
    setTimeout(() => { copied.value = false }, 2000)
  })
}

function shareTweet() {
  const text = encodeURIComponent('I just designed a custom replacement sole with SolePrint! Sustainable footwear repair made easy.')
  const url = encodeURIComponent(window.location.href)
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank')
}
</script>

<template>
  <div class="results-panel">
    <div class="dimensions-card">
      <h3>Dimensions</h3>
      <div class="dim-grid">
        <div class="dim">
          <span class="dim-label">Length</span>
          <span class="dim-value">~280mm</span>
        </div>
        <div class="dim">
          <span class="dim-label">Width</span>
          <span class="dim-value">~105mm</span>
        </div>
        <div class="dim">
          <span class="dim-label">Thickness</span>
          <span class="dim-value">{{ store.params.thickness }}mm</span>
        </div>
        <div class="dim">
          <span class="dim-label">Heel Lift</span>
          <span class="dim-value">{{ store.params.heelLift }}mm</span>
        </div>
      </div>
    </div>

    <div class="export-section">
      <h3>Export</h3>
      <div class="export-buttons">
        <button class="btn-primary" @click="exportSTL">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Download STL
        </button>
        <button class="btn-primary" @click="exportOBJ">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Download OBJ
        </button>
      </div>
    </div>

    <div class="share-section">
      <h3>Share</h3>
      <div class="share-buttons">
        <button :class="['btn-ghost', { copied }]" @click="copyLink">
          {{ copied ? 'Copied!' : 'Copy Share Link' }}
        </button>
        <button class="btn-ghost" @click="shareTweet">
          Share on X
        </button>
      </div>
    </div>

    <router-link to="/upload" class="new-sole btn-primary full-width">
      Start a New Sole
    </router-link>
  </div>
</template>

<style scoped>
.results-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dimensions-card {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.06);
}

h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.dim-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.dim {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dim-label {
  font-size: 12px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dim-value {
  font-size: 20px;
  font-weight: 600;
  color: #1A1A1A;
}

.export-section, .share-section {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.06);
}

.export-buttons, .share-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.copied {
  border-color: #2ECC8F;
  color: #2ECC8F;
}

.full-width {
  width: 100%;
  text-align: center;
  justify-content: center;
}
</style>
