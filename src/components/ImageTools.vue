<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { useSoleStore } from '../stores/soleStore'

const props = defineProps({
  detecting: { type: Boolean, default: false },
  detectionCanvas: { type: Object, default: null },   // HTMLCanvasElement from processImage
  detectionError:  { type: String,  default: null },
  detectionSize:   { type: String,  default: null },
})

const emit = defineEmits(['process', 'continue'])

const store = useSoleStore()
const previewCanvas = ref(null)
const debugCanvasWrap = ref(null)
const localAdj = ref({ ...store.imageAdjustments })

// Mount detection canvas into the debug container whenever it arrives
watch(() => props.detectionCanvas, async (canvas) => {
  await nextTick()
  if (debugCanvasWrap.value && canvas) {
    debugCanvasWrap.value.innerHTML = ''
    canvas.style.width = '100%'
    canvas.style.height = 'auto'
    canvas.style.borderRadius = '8px'
    debugCanvasWrap.value.appendChild(canvas)
  }
})

function applyAdjustments() {
  if (!store.uploadedImage || !previewCanvas.value) return
  const ctx = previewCanvas.value.getContext('2d')
  const img = new Image()
  img.onload = () => {
    const maxW = 420
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
      const imageData = ctx.getImageData(0, 0, previewCanvas.value.width, previewCanvas.value.height)
      const data = imageData.data
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
        const val = avg > localAdj.value.threshold ? 255 : 0
        data[i] = data[i + 1] = data[i + 2] = val
      }
      ctx.putImageData(imageData, 0, 0)
    }
  }
  img.src = store.uploadedImage
}

watch(localAdj, () => {
  store.updateAdjustments(localAdj.value)
  applyAdjustments()
}, { deep: true })

onMounted(() => { nextTick(applyAdjustments) })

function resetAll() {
  localAdj.value = { rotate: 0, brightness: 100, contrast: 100, threshold: 128, blur: 0 }
}
</script>

<template>
  <div class="image-tools" v-if="store.uploadedImage">

    <!-- Canvas area: image preview → spinner → detection result -->
    <div class="canvas-area">
      <!-- Spinner while detecting -->
      <div v-if="detecting" class="spinner-overlay">
        <div class="spinner"></div>
        <p>Detecting outline…</p>
      </div>

      <!-- Detection result canvas (replaces preview once we have a result) -->
      <div v-else-if="detectionCanvas" ref="debugCanvasWrap" class="canvas-wrap"></div>

      <!-- Normal image preview -->
      <div v-else class="canvas-wrap">
        <canvas ref="previewCanvas"></canvas>
      </div>
    </div>

    <!-- Inline detection status -->
    <div v-if="detectionError" class="status-banner status-error">
      {{ detectionError }}
    </div>
    <div v-else-if="detectionSize" class="status-banner status-success">
      <span>&#10003;</span> Scale detected — {{ detectionSize }}
    </div>

    <!-- Sliders -->
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
        <label>Threshold <span>{{ localAdj.threshold }}</span></label>
        <input type="range" v-model.number="localAdj.threshold" min="0" max="255" />
      </div>
      <div class="slider-group">
        <label>
          Blur <span>{{ localAdj.blur }}</span>
          <small class="hint">helps bridge marker gaps</small>
        </label>
        <input type="range" v-model.number="localAdj.blur" min="0" max="8" step="1" />
      </div>
    </div>

    <!-- Actions -->
    <div class="tools-actions">
      <button class="btn-ghost" @click="resetAll">Reset</button>

      <!-- Show Continue only after a successful detection -->
      <template v-if="detectionSize && !detectionError">
        <button class="btn-ghost" :disabled="detecting" @click="emit('process')">Re-detect</button>
        <button class="btn-primary" @click="emit('continue')">Continue to Preview →</button>
      </template>
      <template v-else>
        <button class="btn-primary" :disabled="detecting" @click="emit('process')">
          {{ detecting ? 'Detecting…' : (detectionCanvas || detectionError) ? 'Try Again' : 'Detect Outline' }}
        </button>
      </template>
    </div>

  </div>
</template>

<style scoped>
.image-tools {
  background: #fff;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.06);
  margin-top: 24px;
  animation: slideUp 300ms ease;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.canvas-area {
  margin-bottom: 20px;
}

.canvas-wrap {
  display: flex;
  justify-content: center;
}

.canvas-wrap canvas {
  border-radius: 12px;
  border: 1px solid #EBEBEB;
  max-width: 100%;
}

.spinner-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 36px;
  background: #F5F5F5;
  border-radius: 12px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #EBEBEB;
  border-top-color: #2ECC8F;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.spinner-overlay p {
  font-size: 14px;
  color: #999;
}

.status-banner {
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 20px;
}

.status-success {
  background: #E8F8F0;
  color: #1A8A5C;
}

.status-error {
  background: #FFF5F5;
  color: #C0392B;
  font-weight: 400;
  font-size: 13px;
}

.sliders {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.slider-group label {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 14px;
  font-weight: 500;
  color: #1A1A1A;
  margin-bottom: 8px;
  gap: 6px;
}

.slider-group label span {
  color: #2ECC8F;
  font-weight: 600;
  margin-left: auto;
}

.hint {
  font-size: 10px;
  color: #aaa;
  font-weight: 400;
}

.tools-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .sliders { grid-template-columns: 1fr; }
  .tools-actions { justify-content: stretch; }
  .tools-actions button { flex: 1; }
}
</style>
