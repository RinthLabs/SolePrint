/**
 * SolePrint processImage.js
 *
 * Workflow:
 *  1. User places shoe on the center crosshair fiducial and traces around it
 *  2. Shoe is lifted; photo shows both the crosshair AND the traced shoe outline
 *  3. We detect the 4 black tip squares of the crosshair to find center + scale
 *  4. We ray-cast outward from center to find the traced outline ring
 *  5. Output: SVG path centered at origin (units: mm), plus debug canvas
 *
 * Fiducial physical dimensions:
 *   N/S tip squares: 40mm apart center-to-center (armLong = 20mm each side)
 *   E/W tip squares: 20mm apart center-to-center (armShort = 10mm each side)
 *   Tip squares: 10×10mm solid black
 */

export async function processImage(imageElement, options = {}) {
  const width = imageElement.naturalWidth || imageElement.width
  const height = imageElement.naturalHeight || imageElement.height

  if (!width || !height) {
    return { error: 'Invalid image element — no dimensions found.' }
  }

  // ─────────────────────────────────────────────
  // Step 1: Grayscale
  // ─────────────────────────────────────────────
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(imageElement, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  const gray = new Uint8Array(width * height)

  for (let i = 0; i < gray.length; i++) {
    const r = imageData.data[i * 4]
    const g = imageData.data[i * 4 + 1]
    const b = imageData.data[i * 4 + 2]
    gray[i] = Math.round(r * 0.299 + g * 0.587 + b * 0.114)
  }

  // ─────────────────────────────────────────────
  // Step 1.5: Optional blur (smooths marker edges, bridges small gaps)
  // ─────────────────────────────────────────────
  const blurRadius = options.blurRadius || 0
  const graySmoothed = blurRadius > 0 ? boxBlur(gray, width, height, blurRadius) : gray

  // ─────────────────────────────────────────────
  // Step 2: Binary threshold (dark = 1)
  // ─────────────────────────────────────────────
  const fidThreshold = options.fidThreshold || 80
  const binary = new Uint8Array(width * height)
  for (let i = 0; i < gray.length; i++) {
    binary[i] = graySmoothed[i] < fidThreshold ? 1 : 0
  }

  // ─────────────────────────────────────────────
  // Step 3: Connected component labeling (two-pass)
  //
  // The crosshair lines (~1-3px wide at scan resolution) connect all 4 tip
  // squares into one blob. We erode before CCL to sever those thin bridges
  // while the 8×8mm squares (80-120px at 300dpi) survive intact.
  // ─────────────────────────────────────────────
  const erodeRadius = options.erodeRadius !== undefined ? options.erodeRadius : 3
  const binaryForCCL = erodeRadius > 0
    ? erodeBinary(binary, width, height, erodeRadius)
    : binary

  const labels = new Int32Array(width * height)
  let nextLabel = 1
  const parent = [0]

  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  function union(a, b) {
    a = find(a); b = find(b)
    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b)
  }

  // First pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (!binaryForCCL[idx]) continue
      const n = []
      if (x > 0 && labels[idx - 1]) n.push(labels[idx - 1])
      if (y > 0 && labels[idx - width]) n.push(labels[idx - width])
      if (x > 0 && y > 0 && labels[idx - width - 1]) n.push(labels[idx - width - 1])
      if (x < width - 1 && y > 0 && labels[idx - width + 1]) n.push(labels[idx - width + 1])
      if (n.length === 0) {
        labels[idx] = nextLabel
        parent.push(nextLabel++)
      } else {
        const minL = Math.min(...n)
        labels[idx] = minL
        for (const nl of n) union(nl, minL)
      }
    }
  }

  // Second pass — resolve + compute bbox and centroid
  const compMap = new Map()
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (!labels[idx]) continue
      const root = find(labels[idx])
      labels[idx] = root
      if (!compMap.has(root)) {
        compMap.set(root, { area: 0, minX: x, minY: y, maxX: x, maxY: y, sumX: 0, sumY: 0 })
      }
      const c = compMap.get(root)
      c.area++; c.sumX += x; c.sumY += y
      if (x < c.minX) c.minX = x
      if (x > c.maxX) c.maxX = x
      if (y < c.minY) c.minY = y
      if (y > c.maxY) c.maxY = y
    }
  }

  // ─────────────────────────────────────────────
  // Step 4: Find fiducial tip squares
  // Solid black squares (no white hollow center), roughly square aspect ratio
  // ─────────────────────────────────────────────
  const candidates = []
  for (const [, c] of compMap) {
    const bw = c.maxX - c.minX + 1
    const bh = c.maxY - c.minY + 1
    const bboxArea = bw * bh
    if (bboxArea === 0) continue
    const solidity = c.area / bboxArea
    const aspect = bw / bh

    // Size range: 10×10mm tip squares at typical photo resolution
    // Allow generous range (500–80000 px²) to cover phone cameras at various distances
    if (c.area < 200 || c.area > 80000) continue
    if (solidity < 0.70) continue          // Must be fairly solid (not an outline or ring)
    if (aspect < 0.5 || aspect > 2.0) continue  // Roughly square

    // Must be SOLID (not hollow): sample center pixel
    const pcx = Math.floor((c.minX + c.maxX) / 2)
    const pcy = Math.floor((c.minY + c.maxY) / 2)
    if (gray[pcy * width + pcx] > 120) continue  // center must be dark

    // Exclude very large blobs that are likely the shoe outline itself
    if (bw > width * 0.3 || bh > height * 0.3) continue

    candidates.push({
      x: c.sumX / c.area,  // centroid x (subpixel)
      y: c.sumY / c.area,  // centroid y
      width: bw,
      height: bh,
      area: c.area,
    })
  }

  if (candidates.length < 4) {
    return {
      error: `Could not detect fiducial markers — found ${candidates.length} of 4 needed. ` +
             `Ensure the crosshair is fully visible, well-lit, and the photo is taken from above.`
    }
  }

  // ─────────────────────────────────────────────
  // Step 5: Identify the 4 markers forming a + pattern (2:1 N/S:E/W ratio)
  // ─────────────────────────────────────────────

  // Sort by area descending, take top 20 candidates to limit combinations
  const top = candidates.sort((a, b) => b.area - a.area).slice(0, 20)

  let bestGroup = null
  let bestScore = Infinity

  // Try all combinations of 4 from top candidates
  for (let i = 0; i < top.length - 3; i++) {
    for (let j = i + 1; j < top.length - 2; j++) {
      for (let k = j + 1; k < top.length - 1; k++) {
        for (let l = k + 1; l < top.length; l++) {
          const score = scorePlusPattern([top[i], top[j], top[k], top[l]])
          if (score < bestScore) {
            bestScore = score
            bestGroup = [top[i], top[j], top[k], top[l]]
          }
        }
      }
    }
  }

  if (!bestGroup || bestScore > 0.75) {
    return {
      error: 'Could not identify the + crosshair pattern. ' +
             'Make sure all 4 tip squares of the crosshair are visible in the photo.'
    }
  }

  // ─────────────────────────────────────────────
  // Step 6: Assign N/S/E/W, compute center + scale
  // ─────────────────────────────────────────────
  const { north, south, east, west, centerX, centerY, scaleMmPerPx, rotationRad, rotationDeg, warnings } =
    assignMarkers(bestGroup)

  const pxPerMm = 1 / scaleMmPerPx

  // ─────────────────────────────────────────────
  // Step 7: Ray-cast from center to find shoe outline
  // ─────────────────────────────────────────────
  const rayCount = 720  // 0.5° resolution for smoother outline
  // minRadius: must clear the N/S tip squares (center at 20mm, half-size 4mm → edge at 24mm).
  // Use 30mm with a generous margin so diagonal rays also skip past the marker corners.
  const minRadiusPx = 30 * pxPerMm
  const maxRadiusPx = 180 * pxPerMm // max shoe half-length ~180mm
  const outlineThreshold = options.outlineThreshold || 110
  const stepPx = 0.5  // sub-pixel stepping along ray

  // Marker exclusion zones — expanded bboxes around each tip square.
  // Any ray hit inside these zones is skipped; the ray continues outward.
  // This handles diagonal rays that clip through a marker corner even beyond minRadius.
  const markerExclRadius = Math.max(north.width, north.height, east.width, east.height) * 0.9
  const markerCenters = [north, south, east, west]

  const hitPoints = []

  for (let a = 0; a < rayCount; a++) {
    const angle = (a * Math.PI * 2) / rayCount
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    let hitX = null
    let hitY = null

    for (let r = minRadiusPx; r <= maxRadiusPx; r += stepPx) {
      const px = Math.round(centerX + dx * r)
      const py = Math.round(centerY + dy * r)
      if (px < 1 || px >= width - 1 || py < 1 || py >= height - 1) break
      if (graySmoothed[py * width + px] < outlineThreshold) {
        // Skip if the hit falls inside one of the 4 tip marker regions
        const inMarker = markerCenters.some(
          m => Math.hypot(px - m.x, py - m.y) < markerExclRadius
        )
        if (inMarker) continue
        hitX = centerX + dx * r
        hitY = centerY + dy * r
        break
      }
    }

    hitPoints.push(hitX !== null ? { x: hitX, y: hitY, angle } : null)
  }

  // Fill gaps (null rays) by interpolating from valid neighbors
  const filled = [...hitPoints]
  for (let i = 0; i < filled.length; i++) {
    if (filled[i] !== null) continue
    for (let d = 1; d < rayCount / 4; d++) {
      const prev = filled[(i - d + rayCount) % rayCount]
      const next = filled[(i + d) % rayCount]
      if (prev !== null && next !== null) {
        const t = 0.5
        filled[i] = { x: prev.x * (1 - t) + next.x * t, y: prev.y * (1 - t) + next.y * t, angle: 0 }
        break
      } else if (prev !== null) {
        filled[i] = { ...prev }; break
      } else if (next !== null) {
        filled[i] = { ...next }; break
      }
    }
  }

  const validPts = filled.filter(p => p !== null)
  if (validPts.length < rayCount * 0.5) {
    return {
      error: 'Could not detect the shoe outline — fewer than half of the rays found the tracing. ' +
             'Ensure the marker line is dark and continuous.'
    }
  }

  // Local angular-window outlier rejection.
  // Compare each hit to its angular neighbors within ±30° instead of the global median.
  // Rectangular/oval outlines have corners with much larger radii than flat sides — a global
  // median filter wrongly rejects those valid corner points. Local comparison handles this.
  const radii = validPts.map(p => Math.hypot(p.x - centerX, p.y - centerY))
  const windowHalf = Math.max(10, Math.floor(validPts.length * (30 / 360)))
  const filtered = validPts.filter((_, i) => {
    const localRs = []
    for (let d = -windowHalf; d <= windowHalf; d++) {
      const j = (i + d + validPts.length) % validPts.length
      localRs.push(radii[j])
    }
    localRs.sort((a, b) => a - b)
    const localMed = localRs[Math.floor(localRs.length / 2)]
    // Only reject hits that are shorter than 35% of the local median —
    // those are spurious blobs (dust, ink splatter) inside the shoe region.
    return radii[i] > localMed * 0.35
  })

  if (filtered.length < 60) {
    return {
      error: 'Too many outliers in the detected outline — the tracing may have gaps or debris. ' +
             'Try adjusting the threshold slider and re-processing.'
    }
  }

  // ─────────────────────────────────────────────
  // Step 8: Convert to mm, simplify, smooth → SVG
  // ─────────────────────────────────────────────
  const c = Math.cos(rotationRad)
  const s = Math.sin(rotationRad)

  // Convert px → mm, then de-rotate so the fiducial N/S axis is vertical.
  // Rotation uses -rotationRad.
  const mmPts = filtered.map(p => {
    const dx = (p.x - centerX) * scaleMmPerPx
    const dy = (p.y - centerY) * scaleMmPerPx
    return {
      x: dx * c + dy * s,
      y: -dx * s + dy * c,
    }
  })

  // Bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of mmPts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
  }
  const widthMm = maxX - minX
  const heightMm = maxY - minY

  // Ramer-Douglas-Peucker simplification
  function rdp(pts, eps) {
    if (pts.length <= 2) return pts
    let maxD = 0, maxI = 0
    const f = pts[0], l = pts[pts.length - 1]
    const dx = l.x - f.x, dy = l.y - f.y
    const lenSq = dx * dx + dy * dy
    for (let i = 1; i < pts.length - 1; i++) {
      let dist
      if (lenSq === 0) {
        dist = Math.hypot(pts[i].x - f.x, pts[i].y - f.y)
      } else {
        const t = Math.max(0, Math.min(1, ((pts[i].x - f.x) * dx + (pts[i].y - f.y) * dy) / lenSq))
        dist = Math.hypot(pts[i].x - f.x - t * dx, pts[i].y - f.y - t * dy)
      }
      if (dist > maxD) { maxD = dist; maxI = i }
    }
    if (maxD > eps) {
      const left = rdp(pts.slice(0, maxI + 1), eps)
      const right = rdp(pts.slice(maxI), eps)
      return left.slice(0, -1).concat(right)
    }
    return [f, l]
  }

  const epsilon = (options.simplifyEpsilon !== undefined) ? options.simplifyEpsilon : 1.2
  const simplified = rdp(mmPts, Math.max(0.1, epsilon))

  // Catmull-Rom → cubic Bezier SVG path
  function catmullRomSVG(pts, tension = 0.5) {
    if (pts.length < 3) {
      return 'M ' + pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ') + ' Z'
    }
    const alpha = 1 - tension
    let path = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[(i - 1 + pts.length) % pts.length]
      const p1 = pts[i]
      const p2 = pts[(i + 1) % pts.length]
      const p3 = pts[(i + 2) % pts.length]
      const cp1x = p1.x + (p2.x - p0.x) * alpha / 6
      const cp1y = p1.y + (p2.y - p0.y) * alpha / 6
      const cp2x = p2.x - (p3.x - p1.x) * alpha / 6
      const cp2y = p2.y - (p3.y - p1.y) * alpha / 6
      path += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
    }
    return path + ' Z'
  }

  const tension = (options.smoothTension !== undefined) ? options.smoothTension : 0.5
  const svgPath = catmullRomSVG(simplified, Math.max(0, Math.min(1, tension)))

  // ─────────────────────────────────────────────
  // Step 9: Debug canvas
  // ─────────────────────────────────────────────
  const debugCanvas = document.createElement('canvas')
  debugCanvas.width = width
  debugCanvas.height = height
  // willReadFrequently: true — avoids repeated getImageData performance warnings
  const dctx = debugCanvas.getContext('2d', { willReadFrequently: true })
  dctx.drawImage(imageElement, 0, 0, width, height)

  const lw = Math.max(2, width / 600)

  // Draw crosshair at detected center
  dctx.strokeStyle = '#2ECC8F'
  dctx.lineWidth = lw
  dctx.beginPath()
  const chSize = 25 * pxPerMm
  dctx.moveTo(centerX - chSize, centerY)
  dctx.lineTo(centerX + chSize, centerY)
  dctx.moveTo(centerX, centerY - chSize)
  dctx.lineTo(centerX, centerY + chSize)
  dctx.stroke()

  // Draw detected marker circles
  dctx.strokeStyle = '#2ECC8F'
  dctx.lineWidth = lw * 1.5
  for (const m of [north, south, east, west]) {
    dctx.beginPath()
    dctx.arc(m.x, m.y, Math.max(m.width, m.height) * 0.65, 0, Math.PI * 2)
    dctx.stroke()
  }

  // Draw raw ray-cast outline (faint) — shows what was detected before simplification
  dctx.strokeStyle = 'rgba(255, 120, 120, 0.35)'
  dctx.lineWidth = lw
  dctx.beginPath()
  filtered.forEach((p, i) => {
    if (i === 0) dctx.moveTo(p.x, p.y)
    else dctx.lineTo(p.x, p.y)
  })
  dctx.closePath()
  dctx.stroke()

  // Draw the smoothed bezier outline (solid red) — reflects Detail Level + Smoothing sliders.
  // svgPath is in mm, centered at origin; transform to pixel space for drawing.
  dctx.save()
  dctx.translate(centerX, centerY)
  dctx.rotate(rotationRad) // svgPath is de-rotated; rotate back for overlay on original image
  dctx.scale(1 / scaleMmPerPx, 1 / scaleMmPerPx)
  dctx.strokeStyle = 'rgba(255, 50, 50, 0.95)'
  dctx.lineWidth = lw * 1.8 * scaleMmPerPx   // compensate for scale transform
  dctx.stroke(new Path2D(svgPath))
  dctx.restore()

  return {
    svgPath,
    scaleMmPerPx,
    detectedMarkers: [north, south, east, west].map(m => ({ x: m.x, y: m.y, width: m.width, height: m.height })),
    widthMm: Math.round(widthMm * 10) / 10,
    heightMm: Math.round(heightMm * 10) / 10,
    centerX,
    centerY,
    rotationDeg,
    warnings,
    debugCanvas,
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Score how well 4 points form a + pattern with 2:1 N/S:E/W distance ratio.
 * Lower score = better match.
 */
function scorePlusPattern(group) {
  let best = Infinity

  // Try all 3 ways to split 4 points into 2 pairs
  const splits = [
    [[0, 1], [2, 3]],
    [[0, 2], [1, 3]],
    [[0, 3], [1, 2]],
  ]

  for (const [[ai, bi], [ci, di]] of splits) {
    const a = group[ai], b = group[bi], c = group[ci], d = group[di]
    const d1 = Math.hypot(a.x - b.x, a.y - b.y)
    const d2 = Math.hypot(c.x - d.x, c.y - d.y)
    if (d1 < 1 || d2 < 1) continue

    // Which pair is N/S (longer) and which is E/W (shorter)?
    const [longD, shortD, longPair, shortPair] =
      d1 >= d2
        ? [d1, d2, [a, b], [c, d]]
        : [d2, d1, [c, d], [a, b]]

    // Expect ratio ~2 (40mm vs 20mm)
    const ratio = longD / shortD
    const ratioErr = Math.abs(ratio - 2) / 2
    if (ratioErr > 0.55) continue

    // Midpoints of the two pairs should be close (they share a center)
    const longMidX = (longPair[0].x + longPair[1].x) / 2
    const longMidY = (longPair[0].y + longPair[1].y) / 2
    const shortMidX = (shortPair[0].x + shortPair[1].x) / 2
    const shortMidY = (shortPair[0].y + shortPair[1].y) / 2
    const midDist = Math.hypot(longMidX - shortMidX, longMidY - shortMidY)
    const midErr = midDist / longD

    // Pairs should be close to perpendicular (rotation-invariant)
    const v1x = longPair[1].x - longPair[0].x
    const v1y = longPair[1].y - longPair[0].y
    const v2x = shortPair[1].x - shortPair[0].x
    const v2y = shortPair[1].y - shortPair[0].y
    const denom = (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y)) || 1
    const orthErr = Math.abs((v1x * v2x + v1y * v2y) / denom) // 0=perfectly orthogonal

    const score = ratioErr * 2 + midErr * 1.6 + orthErr * 0.8
    if (score < best) best = score
  }

  return best
}

/**
 * Fast separable box blur on a Uint8Array grayscale image.
 * Equivalent to blurring with a (2r+1)×(2r+1) box kernel.
 */
function boxBlur(gray, width, height, radius) {
  if (radius <= 0) return gray
  const horiz = new Float32Array(gray.length)
  const out = new Uint8Array(gray.length)

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    let sum = 0, count = 0
    // Seed with left-edge pixels
    for (let x = 0; x < Math.min(radius, width); x++) { sum += gray[y * width + x]; count++ }
    for (let x = 0; x < width; x++) {
      if (x + radius < width)    { sum += gray[y * width + x + radius];     count++ }
      if (x - radius - 1 >= 0)   { sum -= gray[y * width + x - radius - 1]; count-- }
      horiz[y * width + x] = sum / count
    }
  }

  // Vertical pass
  for (let x = 0; x < width; x++) {
    let sum = 0, count = 0
    for (let y = 0; y < Math.min(radius, height); y++) { sum += horiz[y * width + x]; count++ }
    for (let y = 0; y < height; y++) {
      if (y + radius < height)   { sum += horiz[(y + radius) * width + x];     count++ }
      if (y - radius - 1 >= 0)   { sum -= horiz[(y - radius - 1) * width + x]; count-- }
      out[y * width + x] = Math.round(sum / count)
    }
  }

  return out
}

/**
 * Morphological binary erosion — shrinks each dark region by `radius` pixels.
 * Thin connections (crosshair lines at ~1-3px) vanish; fat squares (80-120px) survive.
 */
function erodeBinary(binary, width, height, radius) {
  const out = new Uint8Array(binary.length)
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      let ok = true
      outer: for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (!binary[(y + dy) * width + (x + dx)]) { ok = false; break outer }
        }
      }
      out[y * width + x] = ok ? 1 : 0
    }
  }
  return out
}

/**
 * Given 4 candidate markers forming a + pattern, assign N/S/E/W roles
 * and compute center + scale.
 */
function assignMarkers(group) {
  // Robust N/S/E/W assignment at any rotation:
  // 1) N/S pair is the longest distance (40mm)
  // 2) Remaining pair is E/W (20mm)
  const pts = [...group]

  let bestLong = { i: 0, j: 1, d: -Infinity }
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
      if (d > bestLong.d) bestLong = { i, j, d }
    }
  }

  const longA = pts[bestLong.i]
  const longB = pts[bestLong.j]
  const shortPts = pts.filter((_, idx) => idx !== bestLong.i && idx !== bestLong.j)
  const shortA = shortPts[0]
  const shortB = shortPts[1]

  const north = longA.y <= longB.y ? longA : longB
  const south = longA.y <= longB.y ? longB : longA
  const west = shortA.x <= shortB.x ? shortA : shortB
  const east = shortA.x <= shortB.x ? shortB : shortA

  const centerX = (north.x + south.x + east.x + west.x) / 4
  const centerY = (north.y + south.y + east.y + west.y) / 4

  // Known physical distances
  const physNS = 40  // mm
  const physEW = 20  // mm

  const pixNS = Math.hypot(north.x - south.x, north.y - south.y)
  const pixEW = Math.hypot(east.x - west.x, east.y - west.y)

  const scaleFromNS = physNS / pixNS
  const scaleFromEW = physEW / pixEW
  const scaleMmPerPx = (scaleFromNS + scaleFromEW) / 2

  // Rotation: angle to rotate by (-theta) so N→S axis becomes +Y.
  // If the image is perfectly upright, vx=0, vy>0 => theta=0.
  const vx = south.x - north.x
  const vy = south.y - north.y
  const rotationRad = Math.atan2(vx, vy)
  const rotationDeg = (rotationRad * 180) / Math.PI

  const warnings = []
  if (Math.abs(scaleFromNS - scaleFromEW) / scaleMmPerPx > 0.06) {
    warnings.push(
      `Scale discrepancy: N/S=${scaleFromNS.toFixed(4)}mm/px, ` +
      `E/W=${scaleFromEW.toFixed(4)}mm/px. ` +
      `Photo may not be perfectly overhead.`
    )
  }

  return { north, south, east, west, centerX, centerY, scaleMmPerPx, rotationRad, rotationDeg, warnings }
}
