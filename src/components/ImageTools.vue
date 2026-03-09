<script setup>
import { ref, watch, onMounted } from 'vue'
import { useSoleStore } from '../stores/soleStore'

const props = defineProps({
  detecting:          { type: Boolean, default: false },
  autoDetecting:      { type: Boolean, default: false },
  autoDetectEnabled:  { type: Boolean, default: true },
  detectionCanvas:    { type: String,  default: null },
  detectionError:     { type: String,  default: null },
  detectionSize:      { type: String,  default: null },
})

const emit = defineEmits(['process', 'continue', 'toggleAutoDetect'])

const store = useSoleStore()
const previewCanvas = ref(null)
const qualityOpen   = ref(false)
const localAdj = ref({ ...store.imageAdjustments })

function applyAdjustments() {
  if (!store.uploadedImage || !previewCanvas.value) return
  const ctx = previewCanvas.value.getContext('2d')
  const img = new Image()
  img.onload = () => {
    const maxW = 480
    const scale = Math.min(maxW / img.width, maxW / img.height, 1)
    previewCanvas.value.width  = img.width  * scale
    previewCanvas.value.height = img.height * scale

    ctx.save()
    ctx.clearRect(0, 0, previewCanvas.value.width, previewCanvas.value.height)
    ctx.translate(previewCanvas.value.width / 2, previewCanvas.value.height / 2)
    ctx.rotate((localAdj.value.rotate * Math.PI) / 180)
    ctx.filter = `brightness(${localAdj.value.brightness}%) contrast(${localAdj.value.contrast}%)`
    ctx.drawImage(img, -previewCanvas.value.width / 2, -previewCanvas.value.height / 2,
      previewCanvas.value.width, previewCanvas.value.height)
    ctx.restore()

    if (localAdj.value.threshold < 255) {
      const d = ctx.getImageData(0, 0, previewCanvas.value.width, previewCanvas.value.height)
      for (let i = 0; i < d.data.length; i += 4) {
        const v = (d.data[i] + d.data[i+1] + d.data[i+2]) / 3 > localAdj.value.threshold ? 255 : 0
        d.data[i] = d.data[i+1] = d.data[i+2] = v
      }
      ctx.putImageData(d, 0, 0)
    }
  }
  img.src = store.uploadedImage
}

watch(localAdj, () => {
  store.updateAdjustments(localAdj.value)
  applyAdjustments()
}, { deep: true })

onMounted(() => { applyAdjustments() })

function resetAll() {
  localAdj.value = { rotate: 0, brightness: 100, contrast: 100, threshold: 128, blur: 0, simplify: 1.5, smooth: 5 }
}

// Status: what to show at top of controls column
const hasResult = () => props.detectionSize && !props.detectionError
</script>

<template>
  <div class="image-tools" v-if="store.uploadedImage">
    <div class="tool-layout">

      <!-- ── Left: canvas column ── -->
      <div class="canvas-col">
        <!-- Spinner while detecting -->
        <div v-if="detecting" class="canvas-state spinner-state">
          <div class="spinner"></div>
          <p>Detecting outline…</p>
        </div>

        <template v-else>
          <!-- Detection result image — visible when we have a result AND not mid-adjustment -->
          <div v-if="detectionCanvas && !autoDetecting" class="canvas-result">
            <img :src="detectionCanvas" class="detection-img" />
          </div>

          <!-- Preview canvas — ALWAYS mounted so the ref stays valid.
               Hidden via CSS when detection image is showing. Immediately visible
               when user adjusts sliders (autoDetecting=true) so they see live feedback. -->
          <div class="canvas-preview" :class="{ hidden: detectionCanvas && !autoDetecting }">
            <canvas ref="previewCanvas"></canvas>
            <!-- "Updating..." badge shown while debounce is counting down -->
            <div v-if="autoDetecting" class="updating-overlay">
              <div class="spinner-sm"></div>
              <span>Updating…</span>
            </div>
          </div>

          <!-- Error -->
          <div v-if="detectionError" class="canvas-state error-state">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="#E74C3C" stroke-width="1.5"/>
              <path d="M14 8v7M14 18v1" stroke="#E74C3C" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <p>{{ detectionError }}</p>
          </div>
        </template>
      </div>

      <!-- ── Right: controls column ── -->
      <div class="controls-col">

        <!-- Auto-detect toggle -->
        <div class="auto-detect-row">
          <span class="auto-label">Auto re-detect</span>
          <button
            :class="['toggle-switch', { on: autoDetectEnabled }]"
            @click="emit('toggleAutoDetect', !autoDetectEnabled)"
            :title="autoDetectEnabled
              ? 'On — re-detects 700ms after any slider change'
              : 'Off — click Re-detect manually'"
          >
            <span class="toggle-knob"></span>
          </button>
        </div>

        <!-- Status banner -->
        <div v-if="hasResult() || autoDetecting" class="status-banner"
             :class="autoDetecting ? 'status-pending' : 'status-success'">
          <template v-if="autoDetecting">
            <div class="spinner-xs"></div> Updating…
          </template>
          <template v-else>
            <span class="check">✓</span> {{ detectionSize }}
          </template>
        </div>
        <div v-else-if="!detectionCanvas && !detectionError" class="status-banner status-idle">
          Adjust sliders, then click <strong>Detect Outline</strong>
        </div>

        <!-- Image adjustment sliders -->
        <div class="sliders">
          <div class="slider-group">
            <label>Rotate <span>{{ localAdj.rotate }}°</span></label>
            <input type="range" v-model.number="localAdj.rotate" min="-180" max="180" />
          </div>
          <div class="slider-group">
            <label>Brightness <span>{{ localAdj.brightness }}%</span></label>
            <input type="range" v-model.number="localAdj.brightness" min="50" max="200" />
          </div>
          <div class="slider-group">
            <label>Contrast <span>{{ localAdj.contrast }}%</span></label>
            <input type="range" v-model.number="localAdj.contrast" min="50" max="200" />
          </div>
          <div class="slider-group">
            <label>
              Threshold <span>{{ localAdj.threshold }}</span>
              <small class="hint">outline darkness cutoff</small>
            </label>
            <input type="range" v-model.number="localAdj.threshold" min="0" max="255" />
          </div>
          <div class="slider-group">
            <label>
              Blur <span>{{ localAdj.blur }}</span>
              <small class="hint">bridges marker gaps</small>
            </label>
            <input type="range" v-model.number="localAdj.blur" min="0" max="8" step="1" />
          </div>
        </div>

        <!-- Outline quality — collapsible -->
        <div class="quality-section">
          <button class="quality-toggle" @click="qualityOpen = !qualityOpen">
            <span>Outline Quality</span>
            <svg :class="['chevron', { open: qualityOpen }]" width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-if="qualityOpen" class="quality-body">
            <div class="slider-group">
              <label>
                Detail Level <span>{{ localAdj.simplify }}mm</span>
                <small class="hint">↓ more points / ↑ fewer points</small>
              </label>
              <input type="range" v-model.number="localAdj.simplify" min="0.2" max="8" step="0.1" />
            </div>
            <div class="slider-group">
              <label>
                Smoothing <span>{{ localAdj.smooth }}/10</span>
                <small class="hint">↑ softer bezier curves</small>
              </label>
              <input type="range" v-model.number="localAdj.smooth" min="0" max="10" step="1" />
            </div>
            <p class="quality-note">Changes take effect on next detection.</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="actions">
          <button class="btn-ghost btn-sm" @click="resetAll">Reset</button>
          <template v-if="hasResult()">
            <button class="btn-ghost" :disabled="detecting" @click="emit('process')">Re-detect</button>
            <button class="btn-primary" @click="emit('continue')">Continue →</button>
          </template>
          <template v-else>
            <button class="btn-primary full-action" :disabled="detecting" @click="emit('process')">
              {{ detecting ? 'Detecting…' : (detectionError ? 'Try Again' : 'Detect Outline') }}
            </button>
          </template>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.image-tools {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.06);
  margin-top: 20px;
  animation: slideUp 300ms ease;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Two-column layout */
.tool-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 24px;
  align-items: start;
}

/* ── Canvas column ── */
.canvas-col {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.canvas-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: #F5F5F5;
  border-radius: 12px;
  padding: 32px;
  min-height: 240px;
  text-align: center;
}

.spinner-state p, .error-state p {
  font-size: 13px;
  color: #999;
  max-width: 260px;
}

.error-state p { color: #C0392B; }

.canvas-result {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
}

.detection-img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 10px;
}

.updating-overlay {
  position: absolute;
  top: 10px; right: 10px;
  background: rgba(0,0,0,0.55);
  color: #fff;
  border-radius: 20px;
  padding: 5px 12px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 7px;
  z-index: 4;
}

.canvas-preview {
  position: relative;
}

.canvas-preview.hidden {
  display: none;
}

.canvas-preview canvas {
  width: 100%;
  height: auto;
  border-radius: 12px;
  border: 1px solid #EBEBEB;
  display: block;
}

/* ── Controls column ── */
.controls-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Auto-detect toggle */
.auto-detect-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}

.auto-label {
  font-size: 13px;
  font-weight: 500;
  color: #555;
}

.toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  background: #DDD;
  border-radius: 20px;
  cursor: pointer;
  transition: background 200ms ease;
  flex-shrink: 0;
}

.toggle-switch.on { background: #2ECC8F; }

.toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  transition: transform 200ms ease;
}

.toggle-switch.on .toggle-knob { transform: translateX(16px); }

/* Status banner */
.status-banner {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 7px;
}

.status-success { background: #E8F8F0; color: #1A8A5C; }
.status-idle    { background: #F5F5F5; color: #888; font-weight: 400; }
.status-pending { background: #FFF8EC; color: #B07A00; }

.check { font-weight: 700; color: #2ECC8F; }

/* Sliders */
.sliders { display: flex; flex-direction: column; gap: 14px; }

.slider-group label {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
  font-weight: 500;
  color: #1A1A1A;
  margin-bottom: 6px;
  gap: 4px;
}

.slider-group label span { color: #2ECC8F; font-weight: 600; margin-left: auto; }
.hint { font-size: 10px; color: #bbb; font-weight: 400; }

input[type=range] { width: 100%; }

/* Quality section */
.quality-section {
  border-top: 1px solid #F0F0F0;
  padding-top: 10px;
}

.quality-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  font-size: 12px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 4px 0;
  transition: color 200ms ease;
}

.quality-toggle:hover { color: #2ECC8F; }

.chevron { transition: transform 200ms ease; flex-shrink: 0; }
.chevron.open { transform: rotate(180deg); }

.quality-body {
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.quality-note {
  font-size: 11px;
  color: #ccc;
  margin-top: -4px;
}

/* Actions */
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.full-action { flex: 1; }
.btn-sm { padding: 7px 14px; font-size: 13px; }

/* Spinners */
.spinner {
  width: 28px; height: 28px;
  border: 3px solid #EBEBEB; border-top-color: #2ECC8F;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}

.spinner-sm {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.7s linear infinite;
}

.spinner-xs {
  width: 12px; height: 12px;
  border: 2px solid rgba(0,0,0,0.15); border-top-color: #B07A00;
  border-radius: 50%; animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 700px) {
  .tool-layout { grid-template-columns: 1fr; }
}
</style>
