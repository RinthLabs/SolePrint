<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useSoleStore } from '../stores/soleStore'

const props = defineProps({
  readonly: Boolean,
  height: { type: Number, default: 500 }
})

const store = useSoleStore()
const container = ref(null)
const loading = ref(true)

let scene, camera, renderer, controls, soleMesh, animId

function createSoleShape() {
  const shape = new THREE.Shape()
  const p = store.params

  // Shoe sole outline (elongated oval with toe and heel shape)
  shape.moveTo(0, -6)
  shape.bezierCurveTo(2.5, -6, 4, -5.5, 4.5, -4)
  shape.bezierCurveTo(5, -2, 4.8, 0, 4.5, 2)
  shape.bezierCurveTo(4.2, 4, 3.8, 5, 3.2, 5.8)
  shape.bezierCurveTo(2.5, 6.5, 1.5, 7, 0, 7)
  shape.bezierCurveTo(-1.5, 7, -2.5, 6.5, -3.2, 5.8)
  shape.bezierCurveTo(-3.8, 5, -4.2, 4, -4.5, 2)
  shape.bezierCurveTo(-4.8, 0, -5, -2, -4.5, -4)
  shape.bezierCurveTo(-4, -5.5, -2.5, -6, 0, -6)

  const bevelSize = p.edgeRoundness * 0.08
  const bevelThickness = p.edgeRoundness * 0.06

  const extrudeSettings = {
    depth: p.thickness * 0.1,
    bevelEnabled: true,
    bevelSegments: 6,
    bevelSize: bevelSize,
    bevelThickness: bevelThickness,
    curveSegments: 32
  }

  return new THREE.ExtrudeGeometry(shape, extrudeSettings)
}

function init() {
  if (!container.value) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xFAFAFA)

  const w = container.value.clientWidth
  const h = props.height

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
  camera.position.set(0, 8, 14)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  container.value.appendChild(renderer.domElement)

  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)

  const point = new THREE.PointLight(0xffffff, 1, 50)
  point.position.set(5, 10, 5)
  point.castShadow = true
  scene.add(point)

  const point2 = new THREE.PointLight(0xffffff, 0.4, 50)
  point2.position.set(-5, 5, -5)
  scene.add(point2)

  const geo = createSoleShape()
  const mat = new THREE.MeshStandardMaterial({
    color: 0xE8E8E8,
    roughness: 0.55,
    metalness: 0.1
  })
  soleMesh = new THREE.Mesh(geo, mat)
  soleMesh.castShadow = true
  soleMesh.rotation.x = -Math.PI / 2
  scene.add(soleMesh)

  if (!props.readonly) {
    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxDistance = 30
    controls.minDistance = 5
  }

  loading.value = false
  animate()
}

let idleTime = 0
function animate() {
  animId = requestAnimationFrame(animate)
  if (controls) {
    controls.update()
  }
  if (soleMesh && !props.readonly) {
    idleTime += 0.003
    soleMesh.rotation.z = Math.sin(idleTime) * 0.15
  }
  renderer.render(scene, camera)
}

function setView(view) {
  if (view === 'top') {
    camera.position.set(0, 15, 0.01)
  } else {
    camera.position.set(0, -15, 0.01)
  }
  camera.lookAt(0, 0, 0)
}

function updateGeometry() {
  if (!soleMesh || !scene) return
  scene.remove(soleMesh)
  const geo = createSoleShape()
  soleMesh = new THREE.Mesh(geo, soleMesh.material)
  soleMesh.castShadow = true
  soleMesh.rotation.x = -Math.PI / 2
  scene.add(soleMesh)
}

watch(() => store.params, updateGeometry, { deep: true })

function onResize() {
  if (!container.value || !renderer || !camera) return
  const w = container.value.clientWidth
  const h = props.height
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

onMounted(() => {
  init()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  window.removeEventListener('resize', onResize)
  if (renderer) {
    renderer.dispose()
  }
})
</script>

<template>
  <div class="sole-viewer">
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Generating your sole...</p>
    </div>
    <div ref="container" class="canvas-container" :style="{ minHeight: height + 'px' }"></div>
    <div v-if="!readonly" class="view-buttons">
      <button class="btn-ghost btn-sm" @click="setView('top')">Top View</button>
      <button class="btn-ghost btn-sm" @click="setView('bottom')">Bottom View</button>
    </div>
  </div>
</template>

<style scoped>
.sole-viewer {
  position: relative;
}

.canvas-container {
  border-radius: 16px;
  overflow: hidden;
  background: #FAFAFA;
}

.canvas-container canvas {
  display: block;
}

.loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(250,250,250,0.9);
  z-index: 5;
  border-radius: 16px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #EBEBEB;
  border-top-color: #2ECC8F;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading p {
  font-size: 14px;
  color: #999;
}

.view-buttons {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}

.btn-sm {
  padding: 8px 20px;
  font-size: 13px;
}
</style>
