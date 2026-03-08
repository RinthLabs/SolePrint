/**
 * Process an uploaded image of a shoe tracing on a SolePrint template.
 * Detects fiducial markers, computes scale, extracts shoe contour, returns SVG path.
 */

export async function processImage(imageElement, options = {}) {
  const width = imageElement.naturalWidth || imageElement.width
  const height = imageElement.naturalHeight || imageElement.height

  // Step 1 — Grayscale
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(imageElement, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  const gray = new Uint8Array(width * height)

  for (let i = 0; i < gray.length; i++) {
    const r = imageData.data[i * 4]
    const g = imageData.data[i * 4 + 1]
    const b = imageData.data[i * 4 + 2]
    gray[i] = Math.round(r * 0.299 + g * 0.587 + b * 0.114)
  }

  // Step 2 — Detect fiducial markers
  const threshold = options.threshold || 80
  const binary = new Uint8Array(width * height)
  for (let i = 0; i < gray.length; i++) {
    binary[i] = gray[i] < threshold ? 1 : 0
  }

  const labels = new Int32Array(width * height)
  let nextLabel = 1
  const components = []

  // Connected component labeling (two-pass)
  const parent = [0]
  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  function union(a, b) {
    a = find(a)
    b = find(b)
    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b)
  }

  // First pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (binary[idx] === 0) continue

      const neighbors = []
      if (x > 0 && labels[idx - 1] > 0) neighbors.push(labels[idx - 1])
      if (y > 0 && labels[idx - width] > 0) neighbors.push(labels[idx - width])
      if (x > 0 && y > 0 && labels[idx - width - 1] > 0) neighbors.push(labels[idx - width - 1])
      if (x < width - 1 && y > 0 && labels[idx - width + 1] > 0) neighbors.push(labels[idx - width + 1])

      if (neighbors.length === 0) {
        labels[idx] = nextLabel
        parent.push(nextLabel)
        nextLabel++
      } else {
        const minLabel = Math.min(...neighbors)
        labels[idx] = minLabel
        for (const n of neighbors) union(n, minLabel)
      }
    }
  }

  // Second pass — resolve labels and compute stats
  const compMap = new Map()
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (labels[idx] === 0) continue
      const root = find(labels[idx])
      labels[idx] = root
      if (!compMap.has(root)) {
        compMap.set(root, { area: 0, minX: x, minY: y, maxX: x, maxY: y })
      }
      const c = compMap.get(root)
      c.area++
      if (x < c.minX) c.minX = x
      if (x > c.maxX) c.maxX = x
      if (y < c.minY) c.minY = y
      if (y > c.maxY) c.maxY = y
    }
  }

  // Filter fiducial candidates
  const candidates = []
  for (const [label, c] of compMap) {
    const bw = c.maxX - c.minX + 1
    const bh = c.maxY - c.minY + 1
    const bboxArea = bw * bh
    const solidity = c.area / bboxArea
    const aspect = bw / bh

    if (c.area < 500 || c.area > 50000) continue
    if (solidity < 0.8) continue
    if (aspect < 0.7 || aspect > 1.3) continue

    // Check for white inner region (hollow center)
    const cx = Math.floor(c.minX + bw * 0.3)
    const cy = Math.floor(c.minY + bh * 0.3)
    const cw = Math.floor(bw * 0.4)
    const ch = Math.floor(bh * 0.4)
    let whiteCount = 0
    let totalCenter = 0
    for (let yy = cy; yy < cy + ch && yy < height; yy++) {
      for (let xx = cx; xx < cx + cw && xx < width; xx++) {
        totalCenter++
        if (binary[yy * width + xx] === 0) whiteCount++
      }
    }
    if (totalCenter > 0 && whiteCount / totalCenter > 0.5) {
      candidates.push({
        label,
        x: (c.minX + c.maxX) / 2,
        y: (c.minY + c.maxY) / 2,
        width: bw,
        height: bh,
        minX: c.minX,
        minY: c.minY,
        maxX: c.maxX,
        maxY: c.maxY
      })
    }
  }

  if (candidates.length < 4) {
    return { error: 'Could not detect all 4 fiducial markers. Ensure the full template is visible.' }
  }

  // Sort: top-left, top-right, bottom-left, bottom-right
  candidates.sort((a, b) => (a.y * width + a.x) - (b.y * width + b.x))
  // Take top-2 and bottom-2
  const sorted = candidates.slice(0, candidates.length)
  sorted.sort((a, b) => a.y - b.y)
  const topTwo = sorted.slice(0, Math.ceil(sorted.length / 2)).sort((a, b) => a.x - b.x)
  const botTwo = sorted.slice(Math.ceil(sorted.length / 2)).sort((a, b) => a.x - b.x)
  const detectedMarkers = [topTwo[0], topTwo[topTwo.length - 1], botTwo[0], botTwo[botTwo.length - 1]]

  // Step 3 — Compute scale
  const knownHorizMm = 165.9 // 190.9 - 25
  const knownVertMm = 209.4  // 244.4 - 35
  const pixDistHoriz = Math.sqrt(
    (detectedMarkers[1].x - detectedMarkers[0].x) ** 2 +
    (detectedMarkers[1].y - detectedMarkers[0].y) ** 2
  )
  const pixDistVert = Math.sqrt(
    (detectedMarkers[2].x - detectedMarkers[0].x) ** 2 +
    (detectedMarkers[2].y - detectedMarkers[0].y) ** 2
  )
  const scaleH = knownHorizMm / pixDistHoriz
  const scaleV = knownVertMm / pixDistVert
  const scaleMmPerPx = (scaleH + scaleV) / 2

  if (Math.abs(scaleH - scaleV) / scaleH > 0.05) {
    console.warn('Scale discrepancy > 5% between horizontal and vertical measurements')
  }

  // Step 4 — Perspective correction (affine transform)
  const templateCorners = [
    { x: 25, y: 35 }, { x: 190.9, y: 35 },
    { x: 25, y: 244.4 }, { x: 190.9, y: 244.4 }
  ]
  const pxPerMm = 3.78 // 96 dpi
  const rectW = Math.round(215.9 * pxPerMm)
  const rectH = Math.round(279.4 * pxPerMm)

  const rectCanvas = document.createElement('canvas')
  rectCanvas.width = rectW
  rectCanvas.height = rectH
  const rctx = rectCanvas.getContext('2d')

  // Compute perspective transform using bilinear interpolation
  const srcPts = detectedMarkers.map(m => ({ x: m.x, y: m.y }))
  const dstPts = templateCorners.map(c => ({ x: c.x * pxPerMm, y: c.y * pxPerMm }))

  // For each pixel in destination, find source using bilinear mapping
  const srcImgData = ctx.getImageData(0, 0, width, height)
  const dstImgData = rctx.createImageData(rectW, rectH)

  for (let dy = 0; dy < rectH; dy++) {
    for (let dx = 0; dx < rectW; dx++) {
      // Normalized coordinates in dst quad
      const u = dx / rectW
      const v = dy / rectH

      // Bilinear interpolation from dst to src
      const sx = (1 - u) * (1 - v) * srcPts[0].x + u * (1 - v) * srcPts[1].x +
                 (1 - u) * v * srcPts[2].x + u * v * srcPts[3].x
      const sy = (1 - u) * (1 - v) * srcPts[0].y + u * (1 - v) * srcPts[1].y +
                 (1 - u) * v * srcPts[2].y + u * v * srcPts[3].y

      const ix = Math.round(sx)
      const iy = Math.round(sy)
      if (ix >= 0 && ix < width && iy >= 0 && iy < height) {
        const si = (iy * width + ix) * 4
        const di = (dy * rectW + dx) * 4
        dstImgData.data[di] = srcImgData.data[si]
        dstImgData.data[di + 1] = srcImgData.data[si + 1]
        dstImgData.data[di + 2] = srcImgData.data[si + 2]
        dstImgData.data[di + 3] = 255
      }
    }
  }
  rctx.putImageData(dstImgData, 0, 0)

  // Step 5 — Isolate shoe outline on rectified canvas
  const rectImgData = rctx.getImageData(0, 0, rectW, rectH)
  const rectGray = new Uint8Array(rectW * rectH)
  for (let i = 0; i < rectGray.length; i++) {
    const r = rectImgData.data[i * 4]
    const g = rectImgData.data[i * 4 + 1]
    const b = rectImgData.data[i * 4 + 2]
    rectGray[i] = Math.round(r * 0.299 + g * 0.587 + b * 0.114)
  }

  // Gaussian blur 3x3
  const blurred = new Uint8Array(rectW * rectH)
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1]
  const ksum = 16
  for (let y = 1; y < rectH - 1; y++) {
    for (let x = 1; x < rectW - 1; x++) {
      let sum = 0
      let ki = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum += rectGray[(y + ky) * rectW + (x + kx)] * kernel[ki++]
        }
      }
      blurred[y * rectW + x] = Math.round(sum / ksum)
    }
  }

  // Threshold + invert
  const binRect = new Uint8Array(rectW * rectH)
  const threshVal = options.rectThreshold || 100
  for (let i = 0; i < binRect.length; i++) {
    binRect[i] = blurred[i] < threshVal ? 1 : 0
  }

  // Mask out fiducial markers (fill with white/0)
  const markerRects = templateCorners.map(c => ({
    x: Math.floor((c.x - 12) * pxPerMm),
    y: Math.floor((c.y - 12) * pxPerMm),
    w: Math.ceil(24 * pxPerMm),
    h: Math.ceil(24 * pxPerMm)
  }))
  for (const mr of markerRects) {
    for (let y = Math.max(0, mr.y); y < Math.min(rectH, mr.y + mr.h); y++) {
      for (let x = Math.max(0, mr.x); x < Math.min(rectW, mr.x + mr.w); x++) {
        binRect[y * rectW + x] = 0
      }
    }
  }

  // Morphological dilate then erode (3x3)
  function dilate(src, w, h) {
    const dst = new Uint8Array(w * h)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let val = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            if (src[(y + ky) * w + (x + kx)]) { val = 1; break }
          }
          if (val) break
        }
        dst[y * w + x] = val
      }
    }
    return dst
  }
  function erode(src, w, h) {
    const dst = new Uint8Array(w * h)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let val = 1
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            if (!src[(y + ky) * w + (x + kx)]) { val = 0; break }
          }
          if (!val) break
        }
        dst[y * w + x] = val
      }
    }
    return dst
  }

  let morphed = dilate(binRect, rectW, rectH)
  morphed = erode(morphed, rectW, rectH)

  // Step 6 — Moore neighborhood contour tracing
  function mooreTrace(bin, w, h) {
    // Find topmost-leftmost black pixel
    let startX = -1, startY = -1
    outer: for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (bin[y * w + x]) {
          startX = x
          startY = y
          break outer
        }
      }
    }
    if (startX === -1) return []

    const contour = [{ x: startX, y: startY }]
    const dirs = [
      { dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 1 },
      { dx: -1, dy: 0 }, { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 }
    ]

    let cx = startX, cy = startY
    let dir = 7 // start searching from top-right
    const maxIter = w * h
    let iter = 0

    while (iter < maxIter) {
      iter++
      let found = false
      const startDir = (dir + 5) % 8 // backtrack

      for (let i = 0; i < 8; i++) {
        const d = (startDir + i) % 8
        const nx = cx + dirs[d].dx
        const ny = cy + dirs[d].dy

        if (nx >= 0 && nx < w && ny >= 0 && ny < h && bin[ny * w + nx]) {
          if (nx === startX && ny === startY && contour.length > 2) {
            return contour
          }
          contour.push({ x: nx, y: ny })
          cx = nx
          cy = ny
          dir = d
          found = true
          break
        }
      }
      if (!found) break
    }
    return contour
  }

  // Find all contours by finding separate starting points
  const visited = new Uint8Array(rectW * rectH)
  const contours = []
  const morphedCopy = new Uint8Array(morphed)

  // Just trace the main contour - find the largest connected region first
  const contour = mooreTrace(morphedCopy, rectW, rectH)
  contours.push(contour)

  // If we need more contours, mask out the found one and try again
  if (contour.length > 0) {
    // Flood-fill to find all pixels of this region
    const regionBin = new Uint8Array(rectW * rectH)
    for (const p of contour) {
      regionBin[p.y * rectW + p.x] = 1
    }

    // Try finding another contour
    const remaining = new Uint8Array(morphedCopy)
    for (const p of contour) {
      remaining[p.y * rectW + p.x] = 0
    }
    const contour2 = mooreTrace(remaining, rectW, rectH)
    if (contour2.length > contour.length) {
      contours.push(contour2)
    }
  }

  // Pick largest contour
  let bestContour = contours[0]
  for (const c of contours) {
    if (c.length > bestContour.length) bestContour = c
  }

  if (!bestContour || bestContour.length < 10) {
    return { error: 'Could not detect shoe outline. Ensure the tracing is dark and visible.' }
  }

  // Step 7 — Simplify contour (Ramer-Douglas-Peucker)
  function rdp(points, epsilon) {
    if (points.length <= 2) return points

    let maxDist = 0
    let maxIdx = 0
    const first = points[0]
    const last = points[points.length - 1]

    for (let i = 1; i < points.length - 1; i++) {
      const d = pointLineDistance(points[i], first, last)
      if (d > maxDist) {
        maxDist = d
        maxIdx = i
      }
    }

    if (maxDist > epsilon) {
      const left = rdp(points.slice(0, maxIdx + 1), epsilon)
      const right = rdp(points.slice(maxIdx), epsilon)
      return left.slice(0, -1).concat(right)
    }
    return [first, last]
  }

  function pointLineDistance(p, a, b) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2)
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
    const projX = a.x + t * dx
    const projY = a.y + t * dy
    return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2)
  }

  const simplified = rdp(bestContour, 2.0)

  // Convert to mm
  const mmPoints = simplified.map(p => ({
    x: p.x / pxPerMm,
    y: p.y / pxPerMm
  }))

  // Compute centroid
  let cx2 = 0, cy2 = 0
  for (const p of mmPoints) {
    cx2 += p.x
    cy2 += p.y
  }
  cx2 /= mmPoints.length
  cy2 /= mmPoints.length

  // Center the points
  const centered = mmPoints.map(p => ({ x: p.x - cx2, y: p.y - cy2 }))

  // Catmull-Rom to cubic bezier conversion
  function catmullRomToBezier(points, tension = 0.5) {
    if (points.length < 3) {
      return 'M ' + points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ') + ' Z'
    }

    const alpha = 1 - tension
    let path = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`

    for (let i = 0; i < points.length; i++) {
      const p0 = points[(i - 1 + points.length) % points.length]
      const p1 = points[i]
      const p2 = points[(i + 1) % points.length]
      const p3 = points[(i + 2) % points.length]

      const cp1x = p1.x + (p2.x - p0.x) * alpha / 6
      const cp1y = p1.y + (p2.y - p0.y) * alpha / 6
      const cp2x = p2.x - (p3.x - p1.x) * alpha / 6
      const cp2y = p2.y - (p3.y - p1.y) * alpha / 6

      path += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
    }

    path += ' Z'
    return path
  }

  const svgPath = catmullRomToBezier(centered, 0.5)

  // Compute bounding box in mm
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of centered) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const widthMm = maxX - minX
  const heightMm = maxY - minY

  // Step 8 — Debug canvas
  const debugCanvas = document.createElement('canvas')
  debugCanvas.width = width
  debugCanvas.height = height
  const dctx = debugCanvas.getContext('2d')
  dctx.drawImage(imageElement, 0, 0, width, height)

  // Draw detected markers with green circles
  dctx.strokeStyle = '#2ECC8F'
  dctx.lineWidth = 3
  for (const m of detectedMarkers) {
    dctx.beginPath()
    dctx.arc(m.x, m.y, Math.max(m.width, m.height) / 2, 0, Math.PI * 2)
    dctx.stroke()
  }

  // Draw contour in red (map back from rectified to original roughly)
  dctx.strokeStyle = 'red'
  dctx.lineWidth = 2
  dctx.beginPath()
  for (let i = 0; i < bestContour.length; i++) {
    const p = bestContour[i]
    // Map from rectified px back to original image coords (approximate)
    const u = p.x / rectW
    const v = p.y / rectH
    const ox = (1 - u) * (1 - v) * detectedMarkers[0].x + u * (1 - v) * detectedMarkers[1].x +
               (1 - u) * v * detectedMarkers[2].x + u * v * detectedMarkers[3].x
    const oy = (1 - u) * (1 - v) * detectedMarkers[0].y + u * (1 - v) * detectedMarkers[1].y +
               (1 - u) * v * detectedMarkers[2].y + u * v * detectedMarkers[3].y
    if (i === 0) dctx.moveTo(ox, oy)
    else dctx.lineTo(ox, oy)
  }
  dctx.closePath()
  dctx.stroke()

  return {
    svgPath,
    scaleMmPerPx,
    detectedMarkers: detectedMarkers.map(m => ({ x: m.x, y: m.y, width: m.width, height: m.height })),
    widthMm: Math.round(widthMm * 10) / 10,
    heightMm: Math.round(heightMm * 10) / 10,
    debugCanvas
  }
}
