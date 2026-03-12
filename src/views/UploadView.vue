<script setup>
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSoleStore } from '../stores/soleStore'
import StepIndicator from '../components/StepIndicator.vue'
import UploadZone from '../components/UploadZone.vue'
import ImageTools from '../components/ImageTools.vue'
import { downloadTemplate } from '../utils/generateTemplate.js'
import { processImage } from '../utils/processImage.js'

const router = useRouter()
const store  = useSoleStore()
const instructionsOpen = ref(false)

// Detection state — passed as props into ImageTools
const detecting          = ref(false)
const autoDetecting      = ref(false)
const autoDetectEnabled  = ref(true)
const detectionCanvas    = ref(null)
const detectionError     = ref(null)
const detectionSize      = ref(null)

// ─── Detection ────────────────────────────────────────────────────────────────

async function onProcess() {
  if (!store.uploadedImage) return

  detecting.value       = true
  autoDetecting.value   = false
  detectionError.value  = null
  detectionSize.value   = null
  // Keep the old canvas visible while re-detecting (don't null it out)

  try {
    const img = new Image()
    img.src = store.uploadedImage
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject })

    const adj = store.imageAdjustments

    // Apply user adjustments (levels) to a full-res offscreen canvas.
    // This ensures the detection sees exactly what the user sees in the preview.
    const offscreen = document.createElement('canvas')
    offscreen.width = img.naturalWidth
    offscreen.height = img.naturalHeight
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true })

    offCtx.drawImage(img, 0, 0, offscreen.width, offscreen.height)

    // Levels: remap grayscale 0-255 using black/white points
    const bp = Math.max(0, Math.min(254, adj.blackPoint ?? 0))
    const wp = Math.max(bp + 1, Math.min(255, adj.whitePoint ?? 255))
    const denom = wp - bp

    const id = offCtx.getImageData(0, 0, offscreen.width, offscreen.height)
    for (let i = 0; i < id.data.length; i += 4) {
      const r = id.data[i], g = id.data[i + 1], b = id.data[i + 2]
      const v = Math.round(r * 0.299 + g * 0.587 + b * 0.114)
      let n = (v - bp) / denom
      if (n < 0) n = 0
      if (n > 1) n = 1
      const o = Math.round(n * 255)
      id.data[i] = id.data[i + 1] = id.data[i + 2] = o
    }
    offCtx.putImageData(id, 0, 0)

    // smooth UI value 0-10 → Catmull-Rom tension 1.0-0.0 (higher UI = smoother curve)
    const smoothTension = 1 - (adj.smooth ?? 5) / 10

    // Detail 0-100 → RDP epsilon in mm (lower epsilon = more detail)
    const detail = Math.max(0, Math.min(100, adj.detail ?? 64))
    const simplifyEpsilon = 8 - (detail / 100) * 7.8  // 8 → 0.2

    const result = await processImage(offscreen, {
      blurRadius: adj.blur ?? 0,
      fidThreshold: 80,
      outlineThreshold: adj.threshold ?? 110,
      simplifyEpsilon,
      smoothTension,
    })

    if (result.error) {
      detectionError.value  = result.error
      detectionCanvas.value = null
    } else {
      store.setDetectedOutline({
        svgPath:     result.svgPath,
        widthMm:     result.widthMm,
        heightMm:    result.heightMm,
        scaleMmPerPx: result.scaleMmPerPx
      })
      detectionSize.value   = `${result.widthMm}mm × ${result.heightMm}mm`
      // Convert to data URL — lets Vue manage the <img> natively (avoids direct DOM manipulation)
      detectionCanvas.value = result.debugCanvas.toDataURL('image/jpeg', 0.88)
    }
  } catch (e) {
    detectionError.value  = 'Processing failed: ' + e.message
    detectionCanvas.value = null
  } finally {
    detecting.value = false
  }
}

// ─── Debounce auto-detect ─────────────────────────────────────────────────────
// After the first successful detection, re-detect automatically 700ms
// after the user stops adjusting any slider.

let debounceTimer = null

watch(() => store.imageAdjustments, () => {
  if (!autoDetectEnabled.value) return                          // toggle is off
  if (!detectionSize.value && !detectionError.value) return    // no first detection yet
  if (detecting.value) return

  clearTimeout(debounceTimer)
  autoDetecting.value = true

  debounceTimer = setTimeout(async () => {
    await onProcess()
    autoDetecting.value = false
  }, 700)
}, { deep: true })

// Reset detection state when a new image is uploaded, then auto-detect once
watch(() => store.uploadedImage, async (newVal) => {
  clearTimeout(debounceTimer)
  detecting.value       = false
  autoDetecting.value   = false
  detectionCanvas.value = null
  detectionError.value  = null
  detectionSize.value   = null

  // Auto-run detection on upload (one-shot with default settings).
  // After this, subsequent slider changes trigger the debounced auto-detect.
  if (newVal) {
    await onProcess()
  }
})

function onContinue() {
  router.push('/preview')
}

// Layout: switch to wide mode once image is loaded
const isWide = computed(() => !!store.uploadedImage)
</script>

<template>
  <div class="upload-view">
    <div :class="['upload-inner', { wide: isWide }]">
      <StepIndicator :current="1" />

      <div class="page-header">
        <div>
          <h2>Upload Your Sole Tracing</h2>
          <p class="subtitle">Print the template, trace your shoe, scan and upload.</p>
        </div>
        <button class="btn-template" @click="downloadTemplate">
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
            <path d="M9 3v9m0 0l-3-3m3 3l3-3M3 14h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Download Template
        </button>
      </div>

      <!-- Upload zone: full width until an image is loaded, then collapses -->
      <div v-if="!store.uploadedImage">
        <UploadZone />
        <p class="template-note">First time? Download the template above to get the fiducial markers.</p>
      </div>

      <!-- Once image is loaded: show a compact "change image" strip -->
      <div v-else class="change-image-bar">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h8M2 12h5" stroke="#2ECC8F" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Image loaded
        <button class="change-btn" @click="store.setImage(null)">Change image</button>
      </div>

      <!-- Two-column image tools -->
      <ImageTools
        :detecting="detecting"
        :autoDetecting="autoDetecting"
        :autoDetectEnabled="autoDetectEnabled"
        :detectionCanvas="detectionCanvas"
        :detectionError="detectionError"
        :detectionSize="detectionSize"
        @process="onProcess"
        @continue="onContinue"
        @toggleAutoDetect="val => autoDetectEnabled = val"
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
            <li>Download and print the template at <strong>100% scale</strong> — do not scale to fit</li>
            <li>Center your shoe on the four black squares</li>
            <li>Trace around the shoe with a thick <strong>black marker</strong></li>
            <li>Trace the <em>inside</em> of the marker line for the best fit</li>
            <li>Lift the shoe — both the squares and outline should be visible</li>
            <li><strong>Scan</strong> on a flatbed scanner for best results (photo from directly above also works)</li>
            <li>Upload here, then click <strong>Detect Outline</strong>. Adjust sliders if the outline is missed.</li>
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
  max-width: 660px;
  margin: 0 auto;
  transition: max-width 300ms ease;
}

/* Wider container when image is loaded (two-column ImageTools needs room) */
.upload-inner.wide {
  max-width: 960px;
}

/* Header row: title + template button side by side */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

h2 {
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 4px;
}

.subtitle {
  font-size: 14px;
  color: #999;
}

.btn-template {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  color: #2ECC8F;
  border: 2px solid #2ECC8F;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  transition: all 200ms ease;
  white-space: nowrap;
}

.btn-template:hover {
  background: #2ECC8F;
  color: #fff;
}

.template-note {
  font-size: 13px;
  color: #bbb;
  text-align: center;
  margin-top: 10px;
}

/* Compact "change image" strip */
.change-image-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #888;
  padding: 8px 14px;
  background: #F5FBF8;
  border-radius: 10px;
  border: 1px solid #D4F0E4;
}

.change-btn {
  margin-left: auto;
  font-size: 13px;
  color: #2ECC8F;
  font-weight: 600;
  transition: opacity 200ms ease;
}

.change-btn:hover { opacity: 0.75; }

/* Instructions */
.instructions {
  margin-top: 20px;
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
  padding: 16px 24px;
  font-size: 14px;
  font-weight: 600;
  color: #1A1A1A;
  transition: color 200ms ease;
}

.instructions-toggle:hover { color: #2ECC8F; }
.chevron { transition: transform 200ms ease; }
.chevron.open { transform: rotate(180deg); }

.instructions-list {
  padding: 0 24px 18px 44px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.instructions-list li {
  font-size: 13px;
  color: #555;
  line-height: 1.55;
}

.slide-enter-active, .slide-leave-active {
  transition: all 200ms ease;
  overflow: hidden;
}
.slide-enter-from, .slide-leave-to { opacity: 0; max-height: 0; }
.slide-enter-to, .slide-leave-from { opacity: 1; max-height: 500px; }
</style>
