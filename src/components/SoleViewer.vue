<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useSoleStore } from '../stores/soleStore'

const props = defineProps({
  readonly: Boolean,
  height: { type: Number, default: 500 },
  svgPath: { type: String, default: null }
})

const store = useSoleStore()
const container = ref(null)
const loading = ref(true)

let scene, camera, renderer, controls, soleMesh, treadGroup, animId

function buildShapeFromSvgPath(pathStr) {
  const shape = new THREE.Shape()
  const commands = parseSvgPath(pathStr)

  let first = true
  for (const cmd of commands) {
    if (cmd.type === 'M') {
      if (first) {
        shape.moveTo(cmd.x, cmd.y)
        first = false
      } else {
        shape.moveTo(cmd.x, cmd.y)
      }
    } else if (cmd.type === 'L') {
      shape.lineTo(cmd.x, cmd.y)
    } else if (cmd.type === 'C') {
      shape.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y)
    } else if (cmd.type === 'Z') {
      shape.closePath()
    }
  }

  return shape
}

function parseSvgPath(d) {
  const commands = []
  const re = /([MLCZHVS])\s*([\d\s,.\-e+]*)/gi
  let match
  while ((match = re.exec(d)) !== null) {
    const type = match[1].toUpperCase()
    const args = match[2].trim().split(/[\s,]+/).filter(s => s).map(Number)

    if (type === 'M' && args.length >= 2) {
      commands.push({ type: 'M', x: args[0], y: args[1] })
    } else if (type === 'L' && args.length >= 2) {
      for (let i = 0; i < args.length; i += 2) {
        commands.push({ type: 'L', x: args[i], y: args[i + 1] })
      }
    } else if (type === 'C' && args.length >= 6) {
      for (let i = 0; i < args.length; i += 6) {
        commands.push({
          type: 'C',
          x1: args[i], y1: args[i + 1],
          x2: args[i + 2], y2: args[i + 3],
          x: args[i + 4], y: args[i + 5]
        })
      }
    } else if (type === 'Z') {
      commands.push({ type: 'Z' })
    }
  }
  return commands
}

function buildDefaultShape() {
  const shape = new THREE.Shape()
  shape.moveTo(0, -6)
  shape.bezierCurveTo(2.5, -6, 4, -5.5, 4.5, -4)
  shape.bezierCurveTo(5, -2, 4.8, 0, 4.5, 2)
  shape.bezierCurveTo(4.2, 4, 3.8, 5, 3.2, 5.8)
  shape.bezierCurveTo(2.5, 6.5, 1.5, 7, 0, 7)
  shape.bezierCurveTo(-1.5, 7, -2.5, 6.5, -3.2, 5.8)
  shape.bezierCurveTo(-3.8, 5, -4.2, 4, -4.5, 2)
  shape.bezierCurveTo(-4.8, 0, -5, -2, -4.5, -4)
  shape.bezierCurveTo(-4, -5.5, -2.5, -6, 0, -6)
  return shape
}

function buildSole(params, svgPathStr) {
  let shape
  if (svgPathStr) {
    shape = buildShapeFromSvgPath(svgPathStr)
    // Normalize shape to fit ~100 units wide
    const box = new THREE.Box2()
    const pts = shape.getPoints(64)
    for (const p of pts) box.expandByPoint(new THREE.Vector2(p.x, p.y))
    const size = new THREE.Vector2()
    box.getSize(size)
    const scale = 10 / Math.max(size.x, size.y)
    const center = new THREE.Vector2()
    box.getCenter(center)

    // Rebuild shape scaled and centered
    const scaledPath = svgPathStr
    shape = buildShapeFromSvgPath(scaledPath)
    // Apply transform by recreating
    const newShape = new THREE.Shape()
    const commands = parseSvgPath(svgPathStr)
    let first = true
    for (const cmd of commands) {
      const tx = (x) => (x - center.x) * scale
      const ty = (y) => (y - center.y) * scale
      if (cmd.type === 'M') {
        if (first) { newShape.moveTo(tx(cmd.x), ty(cmd.y)); first = false }
        else newShape.moveTo(tx(cmd.x), ty(cmd.y))
      } else if (cmd.type === 'L') {
        newShape.lineTo(tx(cmd.x), ty(cmd.y))
      } else if (cmd.type === 'C') {
        newShape.bezierCurveTo(tx(cmd.x1), ty(cmd.y1), tx(cmd.x2), ty(cmd.y2), tx(cmd.x), ty(cmd.y))
      } else if (cmd.type === 'Z') {
        newShape.closePath()
      }
    }
    shape = newShape
  } else {
    shape = buildDefaultShape()
  }

  const bevelSize = params.edgeRoundness * (svgPathStr ? 0.05 : 0.08)
  const bevelThickness = params.edgeRoundness * (svgPathStr ? 0.03 : 0.06)

  const extrudeSettings = {
    depth: params.thickness * (svgPathStr ? 0.15 : 0.1),
    bevelEnabled: params.edgeRoundness > 0,
    bevelSegments: 4,
    bevelSize,
    bevelThickness,
    curveSegments: 32
  }

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
  const material = new THREE.MeshStandardMaterial({
    color: 0xE8E8E8,
    roughness: 0.4,
    metalness: 0.1
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true

  // Tread grooves
  const treads = new THREE.Group()
  if (params.treadDepth > 0) {
    geometry.computeBoundingBox()
    const bb = geometry.boundingBox
    const w = bb.max.x - bb.min.x
    const h = bb.max.y - bb.min.y
    const grooveMat = new THREE.MeshStandardMaterial({ color: 0xD0D0D0, roughness: 0.6, metalness: 0.05 })

    for (let i = 0; i < 5; i++) {
      const t = (i + 1) / 6
      const grooveGeo = new THREE.BoxGeometry(w * 0.85, h * 0.01, params.treadDepth * 0.05)
      const groove = new THREE.Mesh(grooveGeo, grooveMat)
      groove.position.set(
        (bb.min.x + bb.max.x) / 2,
        bb.min.y + t * h,
        -params.treadDepth * 0.02
      )
      treads.add(groove)
    }
  }

  return { mesh, treads }
}

function init() {
  if (!container.value) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xFAFAFA)

  const w = container.value.clientWidth
  const h = props.height

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200)
  const heelLift = store.params.heelLift || 0
  camera.position.set(0, heelLift * 3, props.svgPath ? 25 : 14)

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

  const { mesh, treads } = buildSole(store.params, props.svgPath)
  soleMesh = mesh
  soleMesh.rotation.x = -Math.PI / 2
  scene.add(soleMesh)
  treadGroup = treads
  treadGroup.rotation.x = -Math.PI / 2
  scene.add(treadGroup)

  if (!props.readonly) {
    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxDistance = 50
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
    if (treadGroup) treadGroup.rotation.z = Math.sin(idleTime) * 0.15
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
  if (treadGroup) scene.remove(treadGroup)

  const { mesh, treads } = buildSole(store.params, props.svgPath)
  soleMesh = mesh
  soleMesh.castShadow = true
  soleMesh.rotation.x = -Math.PI / 2
  scene.add(soleMesh)
  treadGroup = treads
  treadGroup.rotation.x = -Math.PI / 2
  scene.add(treadGroup)
}

watch(() => store.params, updateGeometry, { deep: true })
watch(() => props.svgPath, updateGeometry)

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
