<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSoleStore } from '../stores/soleStore'
import StepIndicator from '../components/StepIndicator.vue'
import SoleViewer from '../components/SoleViewer.vue'
import ToastNotification from '../components/ToastNotification.vue'

const router = useRouter()
const store  = useSoleStore()
const viewer   = ref(null)
const mirrored = ref(false)

const toast = ref({ message: '', visible: false, type: 'success' })
function showToast(msg, type = 'success') {
  toast.value = { message: msg, visible: true, type }
}

// Sole parameter sliders
const sliders = [
  { key: 'thickness',     label: 'Thickness',      min: 6,  max: 18, unit: 'mm', tip: 'Overall sole depth from top to bottom.' },
  { key: 'edgeRoundness', label: 'Edge Roundness',  min: 0,  max: 10, unit: '',   tip: 'Bevel on the perimeter edge.' },
  { key: 'treadDepth',    label: 'Tread Grooves',   min: 0,  max: 8,  unit: '',   tip: 'Horizontal groove lines on the sole bottom. Visual approximation — actual cuts need post-processing in your slicer.' },
  { key: 'heelLift',      label: 'Heel Wedge',      min: 0,  max: 15, unit: 'mm', tip: 'Adds a raised wedge to the back half of the sole. Rotate in your slicer so the heel side aligns correctly.' },
]

function updateParam(key, val) {
  store.updateParams({ [key]: val })
}

// Actual detected dimensions (or placeholder if detection wasn't run)
const lengthMm = computed(() => store.detectedHeightMm ? `${store.detectedHeightMm}mm` : '—')
const widthMm  = computed(() => store.detectedWidthMm  ? `${store.detectedWidthMm}mm`  : '—')

function doExportSTL() {
  viewer.value?.exportSTL()
  showToast('STL exported — open in PrusaSlicer, Cura, or Bambu Studio')
}

function doExportOBJ() {
  viewer.value?.exportOBJ()
  showToast('OBJ exported')
}

const copied = ref(false)
function copyLink() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    copied.value = true
    showToast('Link copied to clipboard!')
    setTimeout(() => { copied.value = false }, 2000)
  })
}

function startOver() {
  store.reset()
  router.push('/upload')
}
</script>

<template>
  <div class="preview-view">
    <div class="preview-inner">
      <StepIndicator :current="2" />

      <h2>Customize &amp; Export</h2>
      <p class="subtitle">Orbit to inspect, adjust parameters, then download your sole.</p>

      <!-- ── Big 3D Viewer ── -->
      <SoleViewer ref="viewer" :height="460" :svgPath="store.detectedSvgPath" :mirrored="mirrored" />

      <!-- ── Controls row ── -->
      <div class="controls-row">

        <!-- Parameters -->
        <div class="panel">
          <h3>Sole Parameters</h3>
          <div v-for="s in sliders" :key="s.key" class="slider-group">
            <label>
              {{ s.label }}
              <span>{{ store.params[s.key] }}{{ s.unit }}</span>
            </label>
            <input
              type="range"
              :value="store.params[s.key]"
              :min="s.min"
              :max="s.max"
              @input="updateParam(s.key, +$event.target.value)"
            />
            <p class="slider-tip">{{ s.tip }}</p>
          </div>
        </div>

        <!-- Dimensions + Export -->
        <div class="panel export-panel">

          <div class="section">
            <h3>Detected Dimensions</h3>
            <div class="dim-grid">
              <div class="dim">
                <span class="dim-label">Length</span>
                <span class="dim-value">{{ lengthMm }}</span>
              </div>
              <div class="dim">
                <span class="dim-label">Width</span>
                <span class="dim-value">{{ widthMm }}</span>
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

          <div class="section">
            <h3>Export</h3>

            <!-- Mirror toggle — trace one foot, flip for the other -->
            <div class="mirror-row">
              <button
                :class="['mirror-btn', { active: !mirrored }]"
                @click="mirrored = false"
                title="Original orientation"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v12M2 8h4M2 5l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Original
              </button>
              <button
                :class="['mirror-btn', { active: mirrored }]"
                @click="mirrored = true"
                title="Mirrored — for the opposite foot"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v12M14 8h-4M14 5l-3 3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Mirrored
              </button>
            </div>
            <p class="mirror-hint">Trace one shoe — mirror for the other foot.</p>

            <div class="export-buttons">
              <button class="btn-primary export-btn" @click="doExportSTL">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Download STL
              </button>
              <button class="btn-ghost export-btn" @click="doExportOBJ">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Download OBJ
              </button>
            </div>
            <p class="export-hint">Open in PrusaSlicer, Cura, or Bambu Studio to slice and print.</p>
          </div>

          <div class="section">
            <h3>Share</h3>
            <div class="share-buttons">
              <button :class="['btn-ghost', { copied }]" @click="copyLink">
                {{ copied ? '✓ Copied!' : 'Copy Link' }}
              </button>
              <button class="btn-ghost" @click="() => {
                const text = encodeURIComponent('I just designed a custom sole with SolePrint!')
                window.open('https://twitter.com/intent/tweet?text=' + text, '_blank')
              }">Share on X</button>
            </div>
          </div>

        </div>
      </div>

      <div class="bottom-actions">
        <button class="btn-ghost" @click="router.push('/upload')">← Back to Upload</button>
        <button class="btn-start-over" @click="startOver">Start a New Sole</button>
      </div>
    </div>

    <ToastNotification
      :message="toast.message"
      :visible="toast.visible"
      :type="toast.type"
      @close="toast.visible = false"
    />
  </div>
</template>

<style scoped>
.preview-view {
  padding: 40px 24px 80px;
}

.preview-inner {
  max-width: 1080px;
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
  margin-bottom: 28px;
}

/* Controls row */
.controls-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 28px;
  align-items: start;
}

.panel {
  background: #fff;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.06);
}

h3 {
  font-size: 15px;
  font-weight: 600;
  color: #1A1A1A;
  margin-bottom: 16px;
}

/* Parameter sliders */
.slider-group {
  margin-bottom: 20px;
}

.slider-group:last-child { margin-bottom: 0; }

.slider-tip {
  font-size: 11px;
  color: #bbb;
  margin-top: 5px;
  line-height: 1.5;
}

.slider-group label {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 500;
  color: #1A1A1A;
  margin-bottom: 8px;
}

.slider-group label span {
  color: #2ECC8F;
  font-weight: 600;
}

/* Export panel sections */
.export-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.section {
  padding-bottom: 20px;
  margin-bottom: 20px;
  border-bottom: 1px solid #F0F0F0;
}

.section:last-child {
  padding-bottom: 0;
  margin-bottom: 0;
  border-bottom: none;
}

.dim-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.dim { display: flex; flex-direction: column; gap: 3px; }

.dim-label {
  font-size: 11px;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dim-value {
  font-size: 20px;
  font-weight: 700;
  color: #1A1A1A;
}

/* Mirror toggle */
.mirror-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.mirror-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1.5px solid #E0E0E0;
  font-size: 13px;
  font-weight: 500;
  color: #888;
  background: #F8F8F8;
  cursor: pointer;
  transition: all 180ms ease;
}

.mirror-btn.active {
  border-color: #2ECC8F;
  color: #2ECC8F;
  background: #F0FBF6;
  font-weight: 600;
}

.mirror-hint {
  font-size: 11px;
  color: #bbb;
  margin-bottom: 14px;
  line-height: 1.4;
}

.export-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  width: 100%;
}

.export-hint {
  font-size: 12px;
  color: #aaa;
  margin-top: 10px;
  line-height: 1.5;
}

.share-buttons {
  display: flex;
  gap: 10px;
}

.copied {
  border-color: #2ECC8F;
  color: #2ECC8F;
}

/* Bottom */
.bottom-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 32px;
}

.btn-start-over {
  font-size: 14px;
  color: #999;
  transition: color 200ms ease;
  padding: 8px 16px;
}

.btn-start-over:hover { color: #2ECC8F; }

@media (max-width: 768px) {
  .controls-row { grid-template-columns: 1fr; }
  .bottom-actions { flex-direction: column; gap: 12px; }
}
</style>
