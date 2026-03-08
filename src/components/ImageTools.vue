<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { useSoleStore } from '../stores/soleStore'

const store = useSoleStore()
const canvas = ref(null)
const localAdj = ref({ ...store.imageAdjustments })

function applyAdjustments() {
  if (!store.uploadedImage || !canvas.value) return
  const ctx = canvas.value.getContext('2d')
  const img = new Image()
  img.onload = () => {
    const maxW = 400
    const scale = Math.min(maxW / img.width, maxW / img.height, 1)
    canvas.value.width = img.width * scale
    canvas.value.height = img.height * scale

    ctx.save()
    ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
    ctx.translate(canvas.value.width / 2, canvas.value.height / 2)
    ctx.rotate((localAdj.value.rotate * Math.PI) / 180)
    ctx.filter = `brightness(${localAdj.value.brightness}%) contrast(${localAdj.value.contrast}%)`
    ctx.drawImage(img, -canvas.value.width / 2, -canvas.value.height / 2, canvas.value.width, canvas.value.height)
    ctx.restore()

    if (localAdj.value.threshold < 255) {
      const imageData = ctx.getImageData(0, 0, canvas.value.width, canvas.value.height)
      const data = imageData.data
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i+1] + data[i+2]) / 3
        const val = avg > localAdj.value.threshold ? 255 : 0
        data[i] = data[i+1] = data[i+2] = val
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

onMounted(() => {
  nextTick(applyAdjustments)
})

function resetAll() {
  localAdj.value = { rotate: 0, brightness: 100, contrast: 100, threshold: 128 }
}

const emit = defineEmits(['continue'])
</script>

<template>
  <div class="image-tools" v-if="store.uploadedImage">
    <div class="canvas-wrap">
      <canvas ref="canvas"></canvas>
    </div>

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
    </div>

    <div class="tools-actions">
      <button class="btn-ghost" @click="resetAll">Reset</button>
      <button class="btn-primary" @click="emit('continue')">Continue to Preview</button>
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
  to { opacity: 1; transform: translateY(0); }
}

.canvas-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

canvas {
  border-radius: 12px;
  border: 1px solid #EBEBEB;
  max-width: 100%;
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
  font-size: 14px;
  font-weight: 500;
  color: #1A1A1A;
  margin-bottom: 8px;
}

.slider-group label span {
  color: #2ECC8F;
  font-weight: 600;
}

.tools-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 768px) {
  .sliders {
    grid-template-columns: 1fr;
  }
}
</style>
