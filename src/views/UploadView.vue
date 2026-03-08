<script setup>
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useSoleStore } from '../stores/soleStore'
import StepIndicator from '../components/StepIndicator.vue'
import UploadZone from '../components/UploadZone.vue'
import ImageTools from '../components/ImageTools.vue'
import { downloadTemplate } from '../utils/generateTemplate.js'
import { processImage } from '../utils/processImage.js'

const router = useRouter()
const store = useSoleStore()
const instructionsOpen = ref(false)

const processing = ref(false)
const processingError = ref(null)
const processSuccess = ref(false)
const detectedSize = ref('')
const debugCanvasContainer = ref(null)

async function onContinue() {
  if (!store.uploadedImage) {
    router.push('/preview')
    return
  }

  processing.value = true
  processingError.value = null
  processSuccess.value = false

  try {
    const img = new Image()
    img.src = store.uploadedImage
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })

    const result = await processImage(img)

    if (result.error) {
      processingError.value = result.error
      processing.value = false
      return
    }

    store.setDetectedOutline({
      svgPath: result.svgPath,
      widthMm: result.widthMm,
      heightMm: result.heightMm,
      scaleMmPerPx: result.scaleMmPerPx
    })

    detectedSize.value = `${result.widthMm}mm × ${result.heightMm}mm`
    processSuccess.value = true
    processing.value = false

    await nextTick()
    if (debugCanvasContainer.value && result.debugCanvas) {
      debugCanvasContainer.value.innerHTML = ''
      result.debugCanvas.style.width = '100%'
      result.debugCanvas.style.height = 'auto'
      result.debugCanvas.style.borderRadius = '12px'
      debugCanvasContainer.value.appendChild(result.debugCanvas)
    }
  } catch (e) {
    processingError.value = 'Processing failed: ' + e.message
    processing.value = false
  }
}

function onContinueToPreview() {
  router.push('/preview')
}

function onAdjustManually() {
  store.detectedSvgPath = null
  router.push('/preview')
}

function onRetry() {
  processingError.value = null
  processSuccess.value = false
}
</script>

<template>
  <div class="upload-view">
    <div class="upload-inner">
      <StepIndicator :current="1" />

      <h2>Upload Your Sole Tracing</h2>
      <p class="subtitle">Take a photo of your shoe sole tracing to get started.</p>

      <!-- Download Template Button -->
      <div class="template-section">
        <button class="btn-template" @click="downloadTemplate">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3v9m0 0l-3-3m3 3l3-3M3 14h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Download Printable Template (PDF)
        </button>
        <p class="template-note">Print at 100% scale, trace your shoe, then upload the photo</p>
      </div>

      <UploadZone />

      <!-- Processing overlay -->
      <div v-if="processing" class="processing-overlay">
        <div class="spinner"></div>
        <p>Detecting scale markers...</p>
      </div>

      <!-- Error state -->
      <div v-if="processingError" class="detection-error">
        <p class="error-text">{{ processingError }}</p>
        <button class="btn-ghost" @click="onRetry">Try again</button>
      </div>

      <!-- Success state -->
      <div v-if="processSuccess" class="detection-success">
        <div class="success-banner">
          <span class="check">&#10003;</span> Scale detected &mdash; {{ detectedSize }} sole
        </div>
        <div ref="debugCanvasContainer" class="debug-canvas-wrap"></div>
        <div class="success-actions">
          <button class="btn-primary" @click="onContinueToPreview">Looks good &mdash; Continue</button>
          <button class="btn-ghost" @click="onAdjustManually">Adjust Manually</button>
        </div>
      </div>

      <!-- Only show ImageTools if not in detection flow -->
      <ImageTools v-if="!processing && !processSuccess && !processingError" @continue="onContinue" />

      <div class="instructions">
        <button class="instructions-toggle" @click="instructionsOpen = !instructionsOpen">
          <span>How to get a good tracing</span>
          <svg :class="['chevron', { open: instructionsOpen }]" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <transition name="slide">
          <ol v-if="instructionsOpen" class="instructions-list">
            <li>Download and print the SolePrint template at 100% scale</li>
            <li>Place your shoe sole-down inside the dashed border</li>
            <li>Trace around the shoe with a BLACK marker</li>
            <li>Trace the INSIDE of the marker line (the line is 3-5mm, trace its inner edge)</li>
            <li>Photograph from directly above in bright, even light</li>
            <li>Upload the photo here &mdash; scale is detected automatically</li>
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
  margin-bottom: 24px;
}

.template-section {
  text-align: center;
  margin-bottom: 24px;
}

.btn-template {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  font-size: 15px;
  font-weight: 600;
  color: #2ECC8F;
  border: 2px solid #2ECC8F;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  transition: all 200ms ease;
}

.btn-template:hover {
  background: #2ECC8F;
  color: #fff;
}

.template-note {
  font-size: 13px;
  color: #999;
  margin-top: 8px;
}

.processing-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
  margin-top: 16px;
  background: #F5F5F5;
  border-radius: 16px;
}

.processing-overlay .spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #EBEBEB;
  border-top-color: #2ECC8F;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.processing-overlay p {
  font-size: 14px;
  color: #999;
}

.detection-error {
  text-align: center;
  padding: 24px;
  margin-top: 16px;
  background: #FFF5F5;
  border-radius: 16px;
}

.error-text {
  color: #E74C3C;
  font-size: 14px;
  margin-bottom: 12px;
}

.detection-success {
  margin-top: 16px;
}

.success-banner {
  background: #E8F8F0;
  color: #1A8A5C;
  padding: 14px 20px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
}

.success-banner .check {
  color: #2ECC8F;
  font-weight: 700;
}

.debug-canvas-wrap {
  margin-top: 16px;
  border-radius: 12px;
  overflow: hidden;
}

.success-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  justify-content: center;
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
