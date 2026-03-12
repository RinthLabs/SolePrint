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
const histCanvas = ref(null)
const histogram = ref(null) // Uint32Array[256]
const localAdj = ref({ ...store.imageAdjustments })

function computeHistogram(img) {
  // Histogram of original grayscale (pre-levels)
  const tmp = document.createElement('canvas')
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  tmp.width = w
  tmp.height = h
  const tctx = tmp.getContext('2d', { willReadFrequently: true })
  tctx.drawImage(img, 0, 0, w, h)
  const id = tctx.getImageData(0, 0, w, h)
  const hist = new Uint32Array(256)
  for (let i = 0; i < id.data.length; i += 4) {
    const r = id.data[i], g = id.data[i + 1], b = id.data[i + 2]
    const v = Math.round(r * 0.299 + g * 0.587 + b * 0.114)
    hist[v]++
  }
  histogram.value = hist
}

function drawHistogram() {
  if (!histCanvas.value || !histogram.value) return
  const c = histCanvas.value
  const ctx = c.getContext('2d')

  const W = 256
  const H = 54
  c.width = W
  c.height = H

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#FAFAFA'
  ctx.fillRect(0, 0, W, H)

  const hist = histogram.value
  let max = 0
  for (let i = 0; i < 256; i++) max = Math.max(max, hist[i])
  const maxLog = Math.log1p(max || 1)

  // Bars
  ctx.fillStyle = '#DADADA'
  for (let x = 0; x < 256; x++) {
    const hLog = Math.log1p(hist[x])
    const barH = Math.round((hLog / maxLog) * (H - 10))
    ctx.fillRect(x, H - barH, 1, barH)
  }

  // Level handles
  const bp = Math.max(0, Math.min(254, localAdj.value.blackPoint ?? 0))
  const wp = Math.max(bp + 1, Math.min(255, localAdj.value.whitePoint ?? 255))

  ctx.strokeStyle = '#2ECC8F'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(bp + 0.5, 0); ctx.lineTo(bp + 0.5, H); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(wp + 0.5, 0); ctx.lineTo(wp + 0.5, H); ctx.stroke()

  // Small triangles at bottom
  ctx.fillStyle = '#2ECC8F'
  const tri = (x) => {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, H)
    ctx.lineTo(x - 4, H - 6)
    ctx.lineTo(x + 5, H - 6)
    ctx.closePath()
    ctx.fill()
  }
  tri(bp)
  tri(wp)
}

function applyAdjustments() {
  if (!store.uploadedImage || !previewCanvas.value) return
  const ctx = previewCanvas.value.getContext('2d', { willReadFrequently: true })
  const img = new Image()
  img.onload = () => {
    const maxW = 480
    const scale = Math.min(maxW / img.width, maxW / img.height, 1)
    previewCanvas.value.width = Math.round(img.width * scale)
    previewCanvas.value.height = Math.round(img.height * scale)

    ctx.clearRect(0, 0, previewCanvas.value.width, previewCanvas.value.height)
    ctx.drawImage(img, 0, 0, previewCanvas.value.width, previewCanvas.value.height)

    // Levels on preview canvas
    const bp = Math.max(0, Math.min(254, localAdj.value.blackPoint ?? 0))
    const wp = Math.max(bp + 1, Math.min(255, localAdj.value.whitePoint ?? 255))
    const denom = wp - bp

    const d = ctx.getImageData(0, 0, previewCanvas.value.width, previewCanvas.value.height)
    for (let i = 0; i < d.data.length; i += 4) {
      const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2]
      const v = Math.round(r * 0.299 + g * 0.587 + b * 0.114)
      let n = (v - bp) / denom
      if (n < 0) n = 0
      if (n > 1) n = 1
      const o = Math.round(n * 255)
      d.data[i] = d.data[i + 1] = d.data[i + 2] = o
    }

    // Threshold preview (binary) for easier tuning
    const thr = Math.max(0, Math.min(255, localAdj.value.threshold ?? 128))
    for (let i = 0; i < d.data.length; i += 4) {
      const v = d.data[i] > thr ? 255 : 0
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v
    }

    ctx.putImageData(d, 0, 0)

    // histogram overlay updates with sliders
    drawHistogram()
  }
  img.src = store.uploadedImage
}

watch(localAdj, () => {
  // Keep levels sane
  if (localAdj.value.blackPoint >= localAdj.value.whitePoint) {
    localAdj.value.whitePoint = Math.min(255, localAdj.value.blackPoint + 1)
  }
  store.updateAdjustments(localAdj.value)
  applyAdjustments()
}, { deep: true })

watch(() => store.uploadedImage, (val) => {
  if (!val) return
  const img = new Image()
  img.onload = () => {
    computeHistogram(img)
    drawHistogram()
    applyAdjustments()
  }
  img.src = val
})

onMounted(() => {
  if (store.uploadedImage) {
    const img = new Image()
    img.onload = () => {
      computeHistogram(img)
      drawHistogram()
      applyAdjustments()
    }
    img.src = store.uploadedImage
  } else {
    applyAdjustments()
  }
})

function resetAll() {
  localAdj.value = { blackPoint: 0, whitePoint: 220, threshold: 128, blur: 5, detail: 64, smooth: 2 }
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
          <div class="levels-block">
            <div class="levels-head">
              <span class="levels-title">Levels</span>
              <span class="levels-values">{{ localAdj.blackPoint }}–{{ localAdj.whitePoint }}</span>
            </div>
            <canvas ref="histCanvas" class="hist-canvas"></canvas>
          </div>

          <div class="slider-group">
            <label>
              Shadows <span>{{ localAdj.blackPoint }}</span>
              <small class="hint">raise to darken ink</small>
            </label>
            <input type="range" v-model.number="localAdj.blackPoint" min="0" max="254" step="1" />
          </div>

          <div class="slider-group">
            <label>
              Highlights <span>{{ localAdj.whitePoint }}</span>
              <small class="hint">lower to whiten paper</small>
            </label>
            <input type="range" v-model.number="localAdj.whitePoint" min="1" max="255" step="1" />
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

        <!-- Outline quality — always visible -->
        <div class="quality-body">
          <div class="slider-group">
            <label>
              Detail <span>{{ localAdj.detail }}/100</span>
              <small class="hint">← less / more →</small>
            </label>
            <input type="range" v-model.number="localAdj.detail" min="0" max="100" step="1" />
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

/* Levels */
.levels-block {
  padding: 10px 10px 8px;
  border: 1px solid #EFEFEF;
  border-radius: 12px;
  background: #FCFCFC;
}

.levels-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}

.levels-title {
  font-size: 12px;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.levels-values {
  font-size: 12px;
  font-weight: 600;
  color: #2ECC8F;
}

.hist-canvas {
  width: 100%;
  height: 54px;
  display: block;
  border-radius: 10px;
  border: 1px solid #EBEBEB;
  background: #FAFAFA;
}

/* Outline quality */
.quality-body {
  border-top: 1px solid #F0F0F0;
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
