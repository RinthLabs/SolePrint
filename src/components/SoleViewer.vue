<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { useSoleStore } from '../stores/soleStore'

const props = defineProps({
  height:   { type: Number,  default: 500 },
  svgPath:  { type: String,  default: null },
  mirrored: { type: Boolean, default: false },
})

const store = useSoleStore()
const container = ref(null)
const loading = ref(true)

let scene, camera, renderer, controls, soleMesh, extrasGroup, animId

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

  const hasPath     = !!svgPathStr
  const bevel       = params.edgeRoundness * (hasPath ? 0.05 : 0.08)
  const bevelThick  = params.edgeRoundness * (hasPath ? 0.03 : 0.06)
  const depth       = params.thickness * (hasPath ? 0.15 : 0.1)

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled:   params.edgeRoundness > 0,
    bevelSegments:  4,
    bevelSize:      bevel,
    bevelThickness: bevelThick,
    curveSegments:  32,
  })

  // ── Get bounding box for heel taper + rim placement ──
  geo.computeBoundingBox()
  const bb     = geo.boundingBox
  const yMin   = bb.min.y
  const yRange = bb.max.y - bb.min.y

  // ── Single vertex pass: flatten top bevel + heel taper ──
  //
  // Bevel at the top (Z > depth) makes the shoe-facing surface rounded.
  // We only want rounding on the bottom (ground-facing) edges, so we clamp
  // any vertex that went above `depth` back down to exactly `depth`.
  //
  // Heel taper: scale each vertex's Z proportionally based on its Y position
  // (toe = yMin = no extra, heel = yMax = heelExtra added).
  // The bottom face (Z ≤ 0) stays flat; only the body and top get tapered.
  const heelExtra = params.heelLift * 0.08  // max extra depth at heel in display units
  const pos = geo.attributes.position

  for (let i = 0; i < pos.count; i++) {
    let z = pos.getZ(i)
    const y = pos.getY(i)

    // 1. Flatten top bevel → bottom edges only
    if (z > depth) z = depth

    // 2. Heel taper → whole body scales in Z based on Y
    if (heelExtra > 0 && z > 0.001) {
      const t = Math.max(0, Math.min(1, (y - yMin) / yRange))  // 0=toe, 1=heel
      const localDepth = depth + heelExtra * t
      z = z * (localDepth / depth)
    }

    pos.setZ(i, z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()

  const mat  = new THREE.MeshStandardMaterial({ color: 0xE2E2E2, roughness: 0.45, metalness: 0.08 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true

  // ── Raised rim ──
  // An annular ring extruded up from the top face, acting like a cup rim.
  // Outer wall follows the sole outline; inner wall is the outline scaled inward
  // toward the bounding-box center.
  const extras = new THREE.Group()
  if (params.rimHeight > 0) {
    const cx     = (bb.min.x + bb.max.x) / 2
    const cy     = (bb.min.y + bb.max.y) / 2
    const halfW  = (bb.max.x - bb.min.x) / 2
    const halfH  = (bb.max.y - bb.min.y) / 2
    const rimWall = 0.35  // wall thickness in display units (~2–3 mm physical)

    const outerPts = shape.getPoints(96)
    const rimShape = new THREE.Shape(outerPts)

    const holePts = outerPts.map(p =>
      new THREE.Vector2(
        cx + (p.x - cx) * (1 - rimWall / halfW),
        cy + (p.y - cy) * (1 - rimWall / halfH)
      )
    )
    const hole = new THREE.Path()
    hole.setFromPoints(holePts)
    rimShape.holes.push(hole)

    const rimDisplayH = params.rimHeight * 0.08
    const rimGeo = new THREE.ExtrudeGeometry(rimShape, {
      depth: rimDisplayH,
      bevelEnabled: false,
      curveSegments: 32,
    })

    const rimMesh = new THREE.Mesh(
      rimGeo,
      new THREE.MeshStandardMaterial({ color: 0xD8D8D8, roughness: 0.45, metalness: 0.08 })
    )
    rimMesh.position.z = depth  // sit on top of the sole
    rimMesh.castShadow = true
    extras.add(rimMesh)
  }

  return { mesh, extras, depth }
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
  const fill = new THREE.DirectionalLight(0xffffff, 0.4)
  fill.position.set(-6, 4, -6)
  scene.add(fill)

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
  if (soleMesh)     { scene.remove(soleMesh);     soleMesh.geometry.dispose() }
  if (extrasGroup)    scene.remove(extrasGroup)

  const { mesh, extras } = buildAll(store.params, props.svgPath)
  soleMesh    = mesh
  extrasGroup = extras

  soleMesh.rotation.x    = -Math.PI / 2
  extrasGroup.rotation.x = -Math.PI / 2

  const mirrorX = props.mirrored ? -1 : 1
  soleMesh.scale.x    = mirrorX
  extrasGroup.scale.x = mirrorX

  if (props.mirrored) {
    soleMesh.material.side = THREE.DoubleSide
    extrasGroup.traverse(c => { if (c.material) c.material.side = THREE.DoubleSide })
  }

  scene.add(soleMesh)
  scene.add(extrasGroup)
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

watch(() => store.params,   addSoleToScene, { deep: true })
watch(() => props.svgPath,  addSoleToScene)
watch(() => props.mirrored, addSoleToScene)

onMounted(() => { init(); window.addEventListener('resize', onResize) })
onUnmounted(() => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); renderer?.dispose() })

// ─── Export ──────────────────────────────────────────────────────────────────

function getExportGeometry() {
  if (!soleMesh) return null

  const widthMm  = store.detectedWidthMm  || 100
  const heightMm = store.detectedHeightMm || 100
  const maxDim   = Math.max(widthMm, heightMm)
  const xyScale  = maxDim / 10
  // The heel taper is already baked into the geometry vertex Z values.
  // We only need to un-do the display scale factor (thickness * 0.15 → real mm).
  const zScale   = store.params.thickness / (store.params.thickness * 0.15)
  const mirrorX  = props.mirrored ? -1 : 1

  function scaleGeom(src, zOffset = 0) {
    const g = src.clone()
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      p.setX(i, p.getX(i) * xyScale * mirrorX)
      p.setY(i, p.getY(i) * xyScale)
      p.setZ(i, (p.getZ(i) + zOffset) * zScale)
    }
    p.needsUpdate = true
    return g
  }

  const geoms = [ scaleGeom(soleMesh.geometry) ]

  extrasGroup.traverse(child => {
    if (child.isMesh) {
      // child.position.z is in display space (e.g., depth), so include it in zOffset
      geoms.push(scaleGeom(child.geometry, child.position.z))
    }
  })

  const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false)

  // Mirrored X flip reverses winding order → normals point inward; fix by swapping verts 1 & 2
  if (props.mirrored && merged.index) {
    const idx = merged.index.array
    for (let i = 0; i < idx.length; i += 3) {
      const tmp = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = tmp
    }
    merged.index.needsUpdate = true
  }

  merged.computeVertexNormals()
  return merged
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function exportSTL() {
  const geom = getExportGeometry(); if (!geom) return
  const data = new STLExporter().parse(new THREE.Mesh(geom, soleMesh.material), { binary: true })
  downloadBlob(new Blob([data], { type: 'application/octet-stream' }), 'soleprint-sole.stl')
  geom.dispose()
}

function exportOBJ() {
  const geom = getExportGeometry(); if (!geom) return
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
