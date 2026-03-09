<script setup>
import { ref } from 'vue'
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

// Detection state — passed as props into ImageTools
const detecting      = ref(false)
const detectionCanvas = ref(null)
const detectionError  = ref(null)
const detectionSize   = ref(null)

async function onProcess() {
  if (!store.uploadedImage) return

  detecting.value      = true
  detectionCanvas.value = null
  detectionError.value  = null
  detectionSize.value   = null

  try {
    const img = new Image()
    img.src = store.uploadedImage
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject })

    const adj = store.imageAdjustments
    const result = await processImage(img, {
      blurRadius:        adj.blur       || 0,
      fidThreshold:      80,
      outlineThreshold:  110,
    })

    if (result.error) {
      detectionError.value = result.error
    } else {
      store.setDetectedOutline({
        svgPath:     result.svgPath,
        widthMm:     result.widthMm,
        heightMm:    result.heightMm,
        scaleMmPerPx: result.scaleMmPerPx
      })
      detectionSize.value   = `${result.widthMm}mm × ${result.heightMm}mm`
      detectionCanvas.value = result.debugCanvas
    }
  } catch (e) {
    detectionError.value = 'Processing failed: ' + e.message
  } finally {
    detecting.value = false
  }
}

function onContinue() {
  router.push('/preview')
}
</script>

<template>
  <div class="upload-view">
    <div class="upload-inner">
      <StepIndicator :current="1" />

      <h2>Upload Your Sole Tracing</h2>
      <p class="subtitle">Scan your shoe sole tracing and upload to get started.</p>

      <!-- Download Template -->
      <div class="template-section">
        <button class="btn-template" @click="downloadTemplate">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3v9m0 0l-3-3m3 3l3-3M3 14h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Download Printable Template (PDF)
        </button>
        <p class="template-note">Print at 100% scale, trace your shoe, then scan and upload</p>
      </div>

      <UploadZone />

      <!-- Image tools + detection — all in one card -->
      <ImageTools
        :detecting="detecting"
        :detectionCanvas="detectionCanvas"
        :detectionError="detectionError"
        :detectionSize="detectionSize"
        @process="onProcess"
        @continue="onContinue"
      />

      <!-- How-to accordion -->
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
            <li>Place your shoe sole-down, centered on the four black squares</li>
            <li>Trace around the shoe with a BLACK marker</li>
            <li>Trace the INSIDE of the marker line for the most accurate fit</li>
            <li>Lift the shoe — both the squares and outline should now be visible</li>
            <li>Scan on a flatbed scanner for best results (photo from directly above as a fallback)</li>
            <li>Upload here and click <strong>Detect Outline</strong>. Adjust sliders if the first attempt misses edges.</li>
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

.instructions-toggle:hover { color: #2ECC8F; }

.chevron { transition: transform 200ms ease; }
.chevron.open { transform: rotate(180deg); }

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
.slide-leave-to { opacity: 0; max-height: 0; }
.slide-enter-to,
.slide-leave-from { opacity: 1; max-height: 400px; }
</style>
