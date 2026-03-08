<script setup>
import { ref } from 'vue'
import StepIndicator from '../components/StepIndicator.vue'
import SoleViewer from '../components/SoleViewer.vue'
import ResultsPanel from '../components/ResultsPanel.vue'
import ToastNotification from '../components/ToastNotification.vue'

const toast = ref({ message: '', visible: false, type: 'success' })

function showToast(data) {
  toast.value = { ...data, visible: true }
}

function hideToast() {
  toast.value.visible = false
}
</script>

<template>
  <div class="results-view">
    <div class="results-inner">
      <StepIndicator :current="3" />

      <h2>Your Sole Is Ready</h2>
      <p class="subtitle">Export your 3D model or share it with others.</p>

      <div class="two-col">
        <div class="viewer-col">
          <SoleViewer :height="400" readonly />
        </div>
        <ResultsPanel @toast="showToast" />
      </div>
    </div>

    <ToastNotification
      :message="toast.message"
      :visible="toast.visible"
      :type="toast.type"
      @close="hideToast"
    />
  </div>
</template>

<style scoped>
.results-view {
  padding: 40px 24px 80px;
}

.results-inner {
  max-width: 1060px;
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

.two-col {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 28px;
  align-items: start;
}

@media (max-width: 768px) {
  .two-col {
    grid-template-columns: 1fr;
  }
}
</style>
