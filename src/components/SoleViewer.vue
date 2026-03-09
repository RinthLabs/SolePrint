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

let scene, camera, renderer, controls, soleMesh, treadGroup, animId

// ─── SVG path parsing ────────────────────────────────────────────────────────

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
      for (let i = 0; i < args.length; i += 2)
        commands.push({ type: 'L', x: args[i], y: args[i + 1] })
    } else if (type === 'C' && args.length >= 6) {
      for (let i = 0; i < args.length; i += 6)
        commands.push({ type: 'C', x1: args[i], y1: args[i+1], x2: args[i+2], y2: args[i+3], x: args[i+4], y: args[i+5] })
    } else if (type === 'Z') {
      commands.push({ type: 'Z' })
    }
  }
  return commands
}

function buildDefaultShape() {
  const s = new THREE.Shape()
  s.moveTo(0, -6)
  s.bezierCurveTo(2.5, -6, 4, -5.5, 4.5, -4)
  s.bezierCurveTo(5, -2, 4.8, 0, 4.5, 2)
  s.bezierCurveTo(4.2, 4, 3.8, 5, 3.2, 5.8)
  s.bezierCurveTo(2.5, 6.5, 1.5, 7, 0, 7)
  s.bezierCurveTo(-1.5, 7, -2.5, 6.5, -3.2, 5.8)
  s.bezierCurveTo(-3.8, 5, -4.2, 4, -4.5, 2)
  s.bezierCurveTo(-4.8, 0, -5, -2, -4.5, -4)
  s.bezierCurveTo(-4, -5.5, -2.5, -6, 0, -6)
  return s
}

// ─── Sole geometry ───────────────────────────────────────────────────────────

function buildAll(params, svgPathStr) {
  let shape

  if (svgPathStr) {
    const raw = new THREE.Shape()
    const cmds = parseSvgPath(svgPathStr)
    let first = true
    for (const cmd of cmds) {
      if (cmd.type === 'M') { if (first) { raw.moveTo(cmd.x, cmd.y); first = false } else raw.moveTo(cmd.x, cmd.y) }
      else if (cmd.type === 'L') raw.lineTo(cmd.x, cmd.y)
      else if (cmd.type === 'C') raw.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y)
      else if (cmd.type === 'Z') raw.closePath()
    }
    const box = new THREE.Box2()
    raw.getPoints(64).forEach(p => box.expandByPoint(new THREE.Vector2(p.x, p.y)))
    const size = new THREE.Vector2(); box.getSize(size)
    const sc = 10 / Math.max(size.x, size.y)
    const ctr = new THREE.Vector2(); box.getCenter(ctr)
    const tx = x => (x - ctr.x) * sc
    const ty = y => (y - ctr.y) * sc

    shape = new THREE.Shape()
    first = true
    for (const cmd of cmds) {
      if (cmd.type === 'M') { if (first) { shape.moveTo(tx(cmd.x), ty(cmd.y)); first = false } else shape.moveTo(tx(cmd.x), ty(cmd.y)) }
      else if (cmd.type === 'L') shape.lineTo(tx(cmd.x), ty(cmd.y))
      else if (cmd.type === 'C') shape.bezierCurveTo(tx(cmd.x1), ty(cmd.y1), tx(cmd.x2), ty(cmd.y2), tx(cmd.x), ty(cmd.y))
      else if (cmd.type === 'Z') shape.closePath()
    }
  } else {
    shape = buildDefaultShape()
  }

  const hasPath    = !!svgPathStr
  const bevel      = params.edgeRoundness * (hasPath ? 0.05 : 0.08)
  const bevelThick = params.edgeRoundness * (hasPath ? 0.03 : 0.06)
  const depth      = params.thickness * (hasPath ? 0.15 : 0.1)

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled:  params.edgeRoundness > 0,
    bevelSegments: 4,
    bevelSize:     bevel,
    bevelThickness: bevelThick,
    curveSegments: 32,
  })

  const mat = new THREE.MeshStandardMaterial({ color: 0xE2E2E2, roughness: 0.45, metalness: 0.08 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true

  // ── Tread grooves ──
  const treads = new THREE.Group()
  if (params.treadDepth > 0) {
    geo.computeBoundingBox()
    const bb = geo.boundingBox
    const bbW = bb.max.x - bb.min.x
    const bbH = bb.max.y - bb.min.y
    const numGrooves = 3 + Math.round(params.treadDepth * 0.6)
    const grooveH    = bbH * 0.013
    const grooveD    = Math.max(0.04, params.treadDepth * 0.05)
    const grooveMat  = new THREE.MeshStandardMaterial({ color: 0xB0B0B0, roughness: 0.8 })

    for (let i = 0; i < numGrooves; i++) {
      const t = (i + 1) / (numGrooves + 1)
      const grGeo = new THREE.BoxGeometry(bbW * 0.82, grooveH, grooveD)
      const gr    = new THREE.Mesh(grGeo, grooveMat)
      // Position on the bottom face of the sole (z = 0), slightly protruding downward
      gr.position.set((bb.min.x + bb.max.x) / 2, bb.min.y + t * bbH, -grooveD / 2)
      treads.add(gr)
    }
  }

  // ── Heel lift wedge ──
  // Sits on top of the "positive Y" half of the sole (approximate heel side).
  // Visual approximation — user should orient the sole correctly in their slicer.
  if (params.heelLift > 0 && hasPath) {
    geo.computeBoundingBox()
    const bb    = geo.boundingBox
    const bbW   = bb.max.x - bb.min.x
    const bbH   = bb.max.y - bb.min.y
    const wH    = params.heelLift * 0.15  // wedge max height in display units
    const wLen  = bbH * 0.5              // wedge covers back half of sole

    // Build wedge as a custom BufferGeometry (ramps from 0 → wH over wLen in Y)
    const x0 = bb.min.x + bbW * 0.08, x1 = bb.max.x - bbW * 0.08
    const y0 = bb.max.y - wLen, y1 = bb.max.y
    const z  = depth  // top surface of sole

    const verts = new Float32Array([
      // bottom face (flat at z)
      x0, y0, z,  x1, y0, z,  x0, y1, z,  x1, y1, z,
      // top face (ramps to z + wH at y1)
      x0, y0, z,       x1, y0, z,       x0, y1, z + wH,  x1, y1, z + wH,
    ])
    const idx = new Uint16Array([
      0, 2, 1,  1, 2, 3,   // bottom quad
      4, 5, 6,  5, 7, 6,   // top quad (wedge surface)
      0, 1, 4,  1, 5, 4,   // front (toe) face
      2, 6, 3,  3, 6, 7,   // back (heel) face
      0, 4, 2,  4, 6, 2,   // left face
      1, 3, 5,  3, 7, 5,   // right face
    ])
    const wGeo = new THREE.BufferGeometry()
    wGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    wGeo.setIndex(new THREE.BufferAttribute(idx, 1))
    wGeo.computeVertexNormals()
    const wedge = new THREE.Mesh(wGeo, new THREE.MeshStandardMaterial({ color: 0xD5D5D5, roughness: 0.5 }))
    wedge.castShadow = true
    treads.add(wedge)
  }

  return { mesh, treads, depth }
}

// ─── Scene ───────────────────────────────────────────────────────────────────

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
  scene.add(Object.assign(new THREE.DirectionalLight(0xffffff, 0.4), { position: new THREE.Vector3(-6, 4, -6) }))

  addSoleToScene()

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping   = true
  controls.dampingFactor   = 0.05
  controls.autoRotate      = true
  controls.autoRotateSpeed = 1.2
  controls.maxDistance     = 60
  controls.minDistance     = 4
  renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false })

  loading.value = false
  animate()
}

function addSoleToScene() {
  if (soleMesh) { scene.remove(soleMesh); soleMesh.geometry.dispose() }
  if (treadGroup) scene.remove(treadGroup)

  const { mesh, treads } = buildAll(store.params, props.svgPath)
  soleMesh = mesh
  treadGroup = treads

  soleMesh.rotation.x = -Math.PI / 2
  treadGroup.rotation.x = -Math.PI / 2

  scene.add(soleMesh)
  scene.add(treadGroup)
}

function animate() {
  animId = requestAnimationFrame(animate)
  controls?.update()
  renderer.render(scene, camera)
}

function setView(view) {
  const positions = { top: [0, 18, 0.1], bottom: [0, -18, 0.1], front: [0, 0, 20] }
  const p = positions[view] || positions.top
  camera.position.set(...p)
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

watch(() => store.params, addSoleToScene, { deep: true })
watch(() => props.svgPath, addSoleToScene)

onMounted(() => { init(); window.addEventListener('resize', onResize) })
onUnmounted(() => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); renderer?.dispose() })

// ─── Export ──────────────────────────────────────────────────────────────────

function getScaledGeometry() {
  if (!soleMesh) return null
  const widthMm  = store.detectedWidthMm  || 100
  const heightMm = store.detectedHeightMm || 100
  const maxDim   = Math.max(widthMm, heightMm)
  const xyScale  = maxDim / 10
  const zScale   = store.params.thickness / (store.params.thickness * 0.15)

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
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function exportSTL() {
  const geom = getScaledGeometry(); if (!geom) return
  const data = new STLExporter().parse(new THREE.Mesh(geom, soleMesh.material), { binary: true })
  downloadBlob(new Blob([data], { type: 'application/octet-stream' }), 'soleprint-sole.stl')
  geom.dispose()
}

function exportOBJ() {
  const geom = getScaledGeometry(); if (!geom) return
  const mesh = new THREE.Mesh(geom, soleMesh.material)
  const sc   = new THREE.Scene(); sc.add(mesh)
  const data = new OBJExporter().parse(sc)
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
      <button class="btn-ghost btn-sm" @click="setView('top')">Top</button>
      <button class="btn-ghost btn-sm" @click="setView('bottom')">Bottom</button>
      <button class="btn-ghost btn-sm" @click="setView('front')">Front</button>
      <button class="btn-ghost btn-sm" @click="controls && (controls.autoRotate = !controls.autoRotate)">Auto-Rotate</button>
    </div>
  </div>
</template>

<style scoped>
.sole-viewer { position: relative; }
.canvas-container {
  border-radius: 16px; overflow: hidden; background: #FAFAFA;
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
.btn-sm { padding: 7px 16px; font-size: 13px; }
</style>
