<script setup>
defineProps({
  current: { type: Number, default: 1 }
})

const steps = ['Upload', 'Adjust', 'Preview']
</script>

<template>
  <div class="steps">
    <div
      v-for="(step, i) in steps"
      :key="i"
      :class="['step', { active: i + 1 === current, done: i + 1 < current }]"
    >
      <span class="step-num">{{ i + 1 }}</span>
      <span class="step-label">{{ step }}</span>
    </div>
  </div>
</template>

<style scoped>
.steps {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 40px;
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  color: #999;
  background: #F5F5F5;
  transition: all 200ms ease;
}

.step.active {
  background: #2ECC8F;
  color: #fff;
}

.step.done {
  background: #E8F8F0;
  color: #2ECC8F;
}

.step-num {
  font-weight: 600;
}

@media (max-width: 768px) {
  .step-label {
    display: none;
  }
  .step {
    padding: 8px 14px;
  }
}
</style>
