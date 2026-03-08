<script setup>
import { useRouter } from 'vue-router'
import { useSoleStore } from '../stores/soleStore'
import StepIndicator from '../components/StepIndicator.vue'
import ParameterPanel from '../components/ParameterPanel.vue'
import SoleViewer from '../components/SoleViewer.vue'

const router = useRouter()
const store = useSoleStore()

function onGenerate() {
  store.setPreviewReady(true)
  router.push('/results')
}

function onStartOver() {
  store.reset()
  router.push('/upload')
}
</script>

<template>
  <div class="preview-view">
    <div class="preview-inner">
      <StepIndicator :current="2" />

      <h2>Customize Your Sole</h2>
      <p class="subtitle">Adjust the parameters and preview your 3D sole model.</p>

      <div class="two-col">
        <ParameterPanel @generate="onGenerate" @start-over="onStartOver" />
        <SoleViewer :height="500" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-view {
  padding: 40px 24px 80px;
}

.preview-inner {
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
  grid-template-columns: 320px 1fr;
  gap: 28px;
  align-items: start;
}

@media (max-width: 768px) {
  .two-col {
    grid-template-columns: 1fr;
  }
}
</style>
