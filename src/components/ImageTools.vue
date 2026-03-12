<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
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
const dragging = ref(null)  // 'shadows' | 'highlights' | 'threshold'
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
  const H = 74
  c.width = W
  c.height = H
  const handleH = 20  // handle zone height at the bottom

  ctx.clearRect(0, 0, W, H)

  // Histogram area background
  ctx.fillStyle = '#F5F5F5'
  ctx.fillRect(0, 0, W, H - handleH)

  // Handle zone background
  ctx.fillStyle = '#EBEBEB'
  ctx.fillRect(0, H - handleH, W, handleH)

  const hist = histogram.value
  let max = 0
  for (let i = 0; i < 256; i++) max = Math.max(max, hist[i])
  const maxLog = Math.log1p(max || 1)
  const barArea = H - handleH - 4

  // Bars (greyscale tinted)
  for (let x = 0; x < 256; x++) {
    const barH = Math.round((Math.log1p(hist[x]) / maxLog) * barArea)
    if (barH < 1) continue
    ctx.fillStyle = `rgb(${x},${x},${x})`
    ctx.fillRect(x, H - handleH - barH, 1, barH)
  }

  const bp  = Math.max(0, Math.min(254, localAdj.value.blackPoint  ?? 0))
  const wp  = Math.max(bp + 1, Math.min(255, localAdj.value.whitePoint ?? 255))
  const thr = Math.max(0, Math.min(255, localAdj.value.threshold ?? 128))

  // Clipped-out shading
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(0, 0, bp, H - handleH)
  ctx.fillStyle = 'rgba(230,230,230,0.45)'
  ctx.fillRect(wp, 0, W - wp, H - handleH)

  const drawHandle = (val, color, label) => {
    const x = val + 0.5

    // Vertical line
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H - handleH + 2)
    ctx.stroke()

    // Triangle marker in handle zone
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(x, H - handleH + 2)
    ctx.lineTo(x - 6, H - handleH + 13)
    ctx.lineTo(x + 7, H - handleH + 13)
    ctx.closePath()
    ctx.fill()

    // Label in triangle
    ctx.fillStyle = label === 'H' ? '#555' : '#fff'
    ctx.font = 'bold 7.5px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x, H - handleH + 8)
  }

  drawHandle(bp,  '#2ECC8F', 'S')
  drawHandle(wp,  '#C8C8C8', 'H')
  drawHandle(thr, '#E87A3A', 'T')
}

// ── Histogram drag interaction ────────────────────────────────────────────────

function pickHandle(xPx, canvasW) {
  const bp  = (localAdj.value.blackPoint  ?? 0)   * (canvasW / 255)
  const wp  = (localAdj.value.whitePoint  ?? 255)  * (canvasW / 255)
  const thr = (localAdj.value.threshold   ?? 128)  * (canvasW / 255)
  const handles = { shadows: bp, highlights: wp, threshold: thr }
  let best = null, bestDist = 22 // px tap radius
  for (const [name, hx] of Object.entries(handles)) {
    const d = Math.abs(xPx - hx)
    if (d < bestDist) { bestDist = d; best = name }
  }
  return best
}

function onHistPointerDown(e) {
  e.preventDefault()
  const rect = histCanvas.value.getBoundingClientRect()
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const xPx = clientX - rect.left
  const handle = pickHandle(xPx, rect.width)
  if (handle) {
    dragging.value = handle
    window.addEventListener('mousemove', onHistDrag, { passive: false })
    window.addEventListener('touchmove', onHistDrag, { passive: false })
    window.addEventListener('mouseup',   onHistDragEnd)
    window.addEventListener('touchend',  onHistDragEnd)
  }
}

function onHistDrag(e) {
  if (!dragging.value || !histCanvas.value) return
  e.preventDefault()
  const rect = histCanvas.value.getBoundingClientRect()
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
  const val = Math.round((x / rect.width) * 255)
  const adj = { ...localAdj.value }
  if (dragging.value === 'shadows') {
    adj.blackPoint = Math.max(0, Math.min(254, val))
    if (adj.blackPoint >= adj.whitePoint) adj.whitePoint = Math.min(255, adj.blackPoint + 1)
  } else if (dragging.value === 'highlights') {
    adj.whitePoint = Math.max(1, Math.min(255, val))
    if (adj.whitePoint <= adj.blackPoint) adj.blackPoint = Math.max(0, adj.whitePoint - 1)
  } else if (dragging.value === 'threshold') {
    adj.threshold = Math.max(0, Math.min(255, val))
  }
  localAdj.value = adj
}

function onHistDragEnd() {
  dragging.value = null
  window.removeEventListener('mousemove', onHistDrag)
  window.removeEventListener('touchmove', onHistDrag)
  window.removeEventListener('mouseup',   onHistDragEnd)
  window.removeEventListener('touchend',  onHistDragEnd)
}

onUnmounted(() => {
  onHistDragEnd() // clean up any dangling listeners
})

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
              <span class="levels-legend">
                <span class="leg-s">S</span> shadows &nbsp;
                <span class="leg-t">T</span> threshold &nbsp;
                <span class="leg-h">H</span> highlights
              </span>
            </div>
            <canvas
              ref="histCanvas"
              class="hist-canvas"
              @mousedown="onHistPointerDown"
              @touchstart.prevent="onHistPointerDown"
            ></canvas>
            <p class="hist-hint">Drag handles to adjust · S and H set the tonal range · T sets outline detection cutoff</p>
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
  gap: 6px;
  flex-wrap: wrap;
}

.levels-title {
  font-size: 12px;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.levels-legend {
  font-size: 10px;
  color: #aaa;
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
}

.leg-s { font-weight: 700; color: #2ECC8F; }
.leg-h { font-weight: 700; color: #999; }
.leg-t { font-weight: 700; color: #E87A3A; }

.hist-canvas {
  width: 100%;
  height: 74px;
  display: block;
  border-radius: 10px;
  border: 1px solid #EBEBEB;
  cursor: ew-resize;
  touch-action: none;
}

.hist-hint {
  font-size: 10px;
  color: #ccc;
  margin-top: 5px;
  line-height: 1.4;
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
