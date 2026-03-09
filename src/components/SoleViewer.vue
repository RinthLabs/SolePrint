<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js'
import { useSoleStore } from '../stores/soleStore'

const props = defineProps({
  height: { type: Number, default: 500 },
  svgPath: { type: String, default: null }
})

const store = useSoleStore()
const container = ref(null)
const loading = ref(true)

let scene, camera, renderer, controls, soleMesh, animId

// ─── Shape building ──────────────────────────────────────────────────────────

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
        commands.push({ type: 'C', x1: args[i], y1: args[i+1], x2: args[i+2], y2: args[i+3], x: args[i+4], y: args[i+5] })
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
    // Build shape from SVG, measure bounds, rescale to ~10 display units at max dim
    const raw = new THREE.Shape()
    const commands = parseSvgPath(svgPathStr)
    let first = true
    for (const cmd of commands) {
      if (cmd.type === 'M') { if (first) { raw.moveTo(cmd.x, cmd.y); first = false } else raw.moveTo(cmd.x, cmd.y) }
      else if (cmd.type === 'L') raw.lineTo(cmd.x, cmd.y)
      else if (cmd.type === 'C') raw.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y)
      else if (cmd.type === 'Z') raw.closePath()
    }
    const box = new THREE.Box2()
    raw.getPoints(64).forEach(p => box.expandByPoint(new THREE.Vector2(p.x, p.y)))
    const size = new THREE.Vector2(); box.getSize(size)
    const scale = 10 / Math.max(size.x, size.y)
    const center = new THREE.Vector2(); box.getCenter(center)
    const tx = x => (x - center.x) * scale
    const ty = y => (y - center.y) * scale

    shape = new THREE.Shape()
    first = true
    for (const cmd of commands) {
      if (cmd.type === 'M') { if (first) { shape.moveTo(tx(cmd.x), ty(cmd.y)); first = false } else shape.moveTo(tx(cmd.x), ty(cmd.y)) }
      else if (cmd.type === 'L') shape.lineTo(tx(cmd.x), ty(cmd.y))
      else if (cmd.type === 'C') shape.bezierCurveTo(tx(cmd.x1), ty(cmd.y1), tx(cmd.x2), ty(cmd.y2), tx(cmd.x), ty(cmd.y))
      else if (cmd.type === 'Z') shape.closePath()
    }
  } else {
    shape = buildDefaultShape()
  }

  const bevelSize      = params.edgeRoundness * (svgPathStr ? 0.05 : 0.08)
  const bevelThickness = params.edgeRoundness * (svgPathStr ? 0.03 : 0.06)
  const depth          = params.thickness * (svgPathStr ? 0.15 : 0.1)

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled:   params.edgeRoundness > 0,
    bevelSegments:  4,
    bevelSize,
    bevelThickness,
    curveSegments:  32,
  })

  const material = new THREE.MeshStandardMaterial({ color: 0xE8E8E8, roughness: 0.4, metalness: 0.1 })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  return mesh
}

// ─── Scene init ──────────────────────────────────────────────────────────────

function init() {
  if (!container.value) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xFAFAFA)

  const w = container.value.clientWidth
  const h = props.height

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200)
  camera.position.set(0, props.svgPath ? 20 : 12, props.svgPath ? 10 : 8)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  container.value.appendChild(renderer.domElement)

  scene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const key = new THREE.DirectionalLight(0xffffff, 1.2)
  key.position.set(8, 14, 8); key.castShadow = true; scene.add(key)
  const fill = new THREE.DirectionalLight(0xffffff, 0.4)
  fill.position.set(-6, 4, -6); scene.add(fill)

  soleMesh = buildSole(store.params, props.svgPath)
  soleMesh.rotation.x = -Math.PI / 2
  scene.add(soleMesh)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping    = true
  controls.dampingFactor    = 0.05
  controls.autoRotate       = true
  controls.autoRotateSpeed  = 1.2
  controls.maxDistance      = 60
  controls.minDistance      = 4
  // Stop auto-rotate when user touches the model
  renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false })

  loading.value = false
  animate()
}

function animate() {
  animId = requestAnimationFrame(animate)
  controls?.update()
  renderer.render(scene, camera)
}

function updateGeometry() {
  if (!soleMesh || !scene) return
  scene.remove(soleMesh)
  soleMesh.geometry.dispose()
  soleMesh = buildSole(store.params, props.svgPath)
  soleMesh.rotation.x = -Math.PI / 2
  scene.add(soleMesh)
}

function setView(view) {
  if (view === 'top') {
    camera.position.set(0, 18, 0.1)
  } else {
    camera.position.set(0, -18, 0.1)
  }
  camera.lookAt(0, 0, 0)
  controls.autoRotate = false
}

function onResize() {
  if (!container.value || !renderer || !camera) return
  const w = container.value.clientWidth
  camera.aspect = w / props.height
  camera.updateProjectionMatrix()
  renderer.setSize(w, props.height)
}

watch(() => store.params, updateGeometry, { deep: true })
watch(() => props.svgPath, updateGeometry)

onMounted(() => { init(); window.addEventListener('resize', onResize) })
onUnmounted(() => {
  cancelAnimationFrame(animId)
  window.removeEventListener('resize', onResize)
  renderer?.dispose()
})

// ─── Export ──────────────────────────────────────────────────────────────────

function getScaledGeometry() {
  if (!soleMesh) return null

  const widthMm  = store.detectedWidthMm  || 100
  const heightMm = store.detectedHeightMm || 100
  const maxDim   = Math.max(widthMm, heightMm)

  // Display geometry: shape normalized to 10 units at max dimension
  //   → xyScale converts display units back to real mm
  const xyScale = maxDim / 10
  // Z: extruded as params.thickness * 0.15 display units; should be params.thickness mm
  const zScale  = store.params.thickness / (store.params.thickness * 0.15)  // = 1/0.15

  const geom = soleMesh.geometry.clone()
  const pos  = geom.attributes.position
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) * xyScale)
    pos.setY(i, pos.getY(i) * xyScale)
    pos.setZ(i, pos.getZ(i) * zScale)
  }
  pos.needsUpdate = true
  geom.computeVertexNormals()
  return geom
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function exportSTL() {
  const geom = getScaledGeometry()
  if (!geom) return
  const mesh = new THREE.Mesh(geom, soleMesh.material)
  const data = new STLExporter().parse(mesh, { binary: true })
  downloadBlob(new Blob([data], { type: 'application/octet-stream' }), 'soleprint-sole.stl')
  geom.dispose()
}

function exportOBJ() {
  const geom = getScaledGeometry()
  if (!geom) return
  const mesh  = new THREE.Mesh(geom, soleMesh.material)
  const tmpScene = new THREE.Scene(); tmpScene.add(mesh)
  const data = new OBJExporter().parse(tmpScene)
  downloadBlob(new Blob([data], { type: 'text/plain' }), 'soleprint-sole.obj')
  geom.dispose()
}

defineExpose({ exportSTL, exportOBJ, setView })
</script>

<template>
  <div class="sole-viewer">
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Generating your sole…</p>
    </div>
    <div ref="container" class="canvas-container" :style="{ minHeight: height + 'px' }"></div>
    <div class="view-buttons">
      <button class="btn-ghost btn-sm" @click="setView('top')">Top View</button>
      <button class="btn-ghost btn-sm" @click="setView('bottom')">Bottom View</button>
      <button class="btn-ghost btn-sm" @click="controls && (controls.autoRotate = !controls.autoRotate)">Auto-Rotate</button>
    </div>
  </div>
</template>

<style scoped>
.sole-viewer { position: relative; }

.canvas-container {
  border-radius: 16px;
  overflow: hidden;
  background: #FAFAFA;
  box-shadow: 0 2px 20px rgba(0,0,0,0.07);
}

.canvas-container canvas { display: block; }

.loading {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  background: rgba(250,250,250,0.9); z-index: 5; border-radius: 16px;
}

.spinner {
  width: 32px; height: 32px;
  border: 3px solid #EBEBEB; border-top-color: #2ECC8F;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.loading p { font-size: 14px; color: #999; }

.view-buttons {
  display: flex; justify-content: center; gap: 10px; margin-top: 14px;
}

.btn-sm { padding: 7px 18px; font-size: 13px; }
</style>
