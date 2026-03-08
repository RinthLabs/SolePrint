<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  message: String,
  visible: Boolean,
  type: { type: String, default: 'success' }
})

const emit = defineEmits(['close'])

watch(() => props.visible, (val) => {
  if (val) {
    setTimeout(() => emit('close'), 3000)
  }
})
</script>

<template>
  <transition name="toast">
    <div v-if="visible" :class="['toast', type]">
      {{ message }}
    </div>
  </transition>
</template>

<style scoped>
.toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  padding: 14px 28px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  z-index: 200;
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
}

.toast.success {
  background: #2ECC8F;
}

.toast.info {
  background: #4A4A4A;
}

.toast-enter-active {
  animation: slideUp 300ms ease;
}

.toast-leave-active {
  animation: slideUp 200ms ease reverse;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
