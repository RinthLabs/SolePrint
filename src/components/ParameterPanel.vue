<script setup>
import { ref, watch } from 'vue'
import { useSoleStore } from '../stores/soleStore'

const store = useSoleStore()
const localParams = ref({ ...store.params })

watch(localParams, (val) => {
  store.updateParams(val)
}, { deep: true })

const emit = defineEmits(['generate', 'startOver'])

const sliders = [
  { key: 'thickness', label: 'Sole Thickness', min: 8, max: 18, unit: 'mm', desc: 'Overall thickness of the sole from top to bottom.' },
  { key: 'edgeRoundness', label: 'Edge Roundness', min: 0, max: 10, unit: '', desc: 'How rounded the edges of the sole are.' },
  { key: 'treadDepth', label: 'Tread Depth', min: 0, max: 8, unit: 'mm', desc: 'Depth of the tread pattern on the bottom surface.' },
  { key: 'heelLift', label: 'Heel Lift', min: 0, max: 15, unit: 'mm', desc: 'Additional height added to the heel area.' }
]
</script>

<template>
  <div class="parameter-panel">
    <h3>Sole Parameters</h3>

    <div v-for="s in sliders" :key="s.key" class="slider-group">
      <label>
        {{ s.label }}
        <span>{{ localParams[s.key] }}{{ s.unit }}</span>
      </label>
      <input type="range" v-model.number="localParams[s.key]" :min="s.min" :max="s.max" />
      <p class="desc">{{ s.desc }}</p>
    </div>

    <button class="btn-primary full-width" @click="emit('generate')">Generate Preview</button>
    <button class="start-over" @click="emit('startOver')">Start Over</button>
  </div>
</template>

<style scoped>
.parameter-panel {
  background: #fff;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.06);
}

h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 24px;
}

.slider-group {
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

.desc {
  font-size: 12px;
  color: #999;
  margin-top: 6px;
}

.full-width {
  width: 100%;
  margin-top: 8px;
}

.start-over {
  display: block;
  width: 100%;
  text-align: center;
  margin-top: 12px;
  font-size: 14px;
  color: #999;
  transition: color 200ms ease;
}

.start-over:hover {
  color: #2ECC8F;
}
</style>
