<script setup>
import { ref } from 'vue'
import { useSoleStore } from '../stores/soleStore'

const store = useSoleStore()
const dragging = ref(false)
const fileName = ref('')
const fileSize = ref('')

function handleFile(file) {
  if (!file) return
  const valid = ['image/jpeg', 'image/png', 'application/pdf']
  if (!valid.includes(file.type)) return

  fileName.value = file.name
  fileSize.value = (file.size / 1024).toFixed(1) + ' KB'

  const reader = new FileReader()
  reader.onload = (e) => {
    store.setImage(e.target.result)
  }
  reader.readAsDataURL(file)
}

function onDrop(e) {
  dragging.value = false
  const file = e.dataTransfer.files[0]
  handleFile(file)
}

function onFileInput(e) {
  const file = e.target.files[0]
  handleFile(file)
}

function triggerInput() {
  document.getElementById('file-input').click()
}
</script>

<template>
  <div
    :class="['upload-zone', { dragging, 'has-image': store.uploadedImage }]"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
    @click="triggerInput"
  >
    <input
      id="file-input"
      type="file"
      accept=".jpg,.jpeg,.png,.pdf"
      @change="onFileInput"
      hidden
    />

    <template v-if="!store.uploadedImage">
      <svg class="upload-icon" width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="4" y="4" width="40" height="40" rx="12" stroke="#CDCDCD" stroke-width="2" stroke-dasharray="4 3"/>
        <path d="M24 16v16M16 24h16" stroke="#2ECC8F" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
      <p class="upload-text">Drop your sole tracing here</p>
      <p class="upload-sub">or click to browse</p>
      <p class="upload-formats">Accepts JPG, PNG, PDF</p>
    </template>

    <template v-else>
      <div class="preview-info">
        <img v-if="store.uploadedImage.startsWith('data:image')" :src="store.uploadedImage" class="preview-thumb" alt="Preview" />
        <div v-else class="pdf-thumb">PDF</div>
        <div class="file-meta">
          <span class="file-name">{{ fileName }}</span>
          <span class="file-size">{{ fileSize }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.upload-zone {
  border: 2px dashed #EBEBEB;
  border-radius: 20px;
  background: #F5F5F5;
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  cursor: pointer;
  transition: all 200ms ease;
  position: relative;
}

.upload-zone:hover {
  border-color: #2ECC8F;
  background: #F8FBF9;
}

.upload-zone.dragging {
  border-color: #2ECC8F;
  background: #F0FAF5;
  animation: pulse 1.2s ease infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(46,204,143,0.2); }
  50% { box-shadow: 0 0 0 12px rgba(46,204,143,0); }
}

.upload-icon {
  margin-bottom: 8px;
}

.upload-text {
  font-size: 17px;
  font-weight: 600;
  color: #1A1A1A;
}

.upload-sub {
  font-size: 14px;
  color: #999;
}

.upload-formats {
  font-size: 12px;
  color: #BBB;
  margin-top: 4px;
}

.preview-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.preview-thumb {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid #EBEBEB;
}

.pdf-thumb {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #E8F8F0;
  color: #2ECC8F;
  font-weight: 700;
  border-radius: 12px;
}

.file-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-name {
  font-size: 15px;
  font-weight: 600;
  color: #1A1A1A;
}

.file-size {
  font-size: 13px;
  color: #999;
}
</style>
