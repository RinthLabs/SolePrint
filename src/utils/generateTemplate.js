import { jsPDF } from 'jspdf'

export function downloadTemplate() {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const pageW = 215.9
  const pageH = 279.4
  const cx = pageW / 2   // 107.95
  const cy = pageH / 2   // 139.7

  // Crosshair arm lengths (from center to tip marker center)
  const armLong = 20   // N and S
  const armShort = 10  // E and W

  // ── Tip markers (solid black squares, 8×8mm) ─────────────
  // Four isolated squares — the only things the detection algorithm needs.
  // No connecting lines (they caused CCL to merge all 4 into one blob).
  const tipSize = 8
  doc.setFillColor(0, 0, 0)

  // Rotate fiducial so the printable "working area" is larger (diagonal footprint).
  // Requested by Ben: 37.7°
  const theta = (37.7 * Math.PI) / 180
  const ct = Math.cos(theta)
  const st = Math.sin(theta)

  const drawTip = (dx, dy) => {
    const rx = dx * ct - dy * st
    const ry = dx * st + dy * ct
    doc.rect(cx + rx - tipSize / 2, cy + ry - tipSize / 2, tipSize, tipSize, 'F')
  }

  // N/S/E/W (relative to unrotated axes)
  drawTip(0, -armLong)
  drawTip(0, armLong)
  drawTip(-armShort, 0)
  drawTip(armShort, 0)

  // ── Light gray center guide (not detectable — well above threshold) ──
  // Visual-only cue so users know where to center their shoe.
  doc.setDrawColor(210, 210, 210)
  doc.setLineWidth(0.2)
  doc.circle(cx, cy, 3, 'S')

  // ── Scale reference bars — bottom right ──────────────────
  // Two bars: 100mm (metric) and 4 inches (imperial = 101.6mm)
  // Right-aligned to a common right edge so the page looks balanced.
  const rightEdge = pageW - 12        // 203.9mm
  const metricLen = 100               // mm
  const imperialLen = 4 * 25.4        // 101.6mm
  const tickH = 2.2                   // tick height in mm
  const barGap = 6.5                  // vertical gap between the two bars

  const metricY = pageH - 14
  const imperialY = metricY - barGap

  const metricX = rightEdge - metricLen   // left end of metric bar
  const imperialX = rightEdge - imperialLen  // left end of imperial bar

  doc.setDrawColor(110, 110, 110)
  doc.setLineWidth(0.3)
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(110, 110, 110)

  // Metric bar
  doc.line(metricX, metricY, rightEdge, metricY)
  doc.line(metricX, metricY - tickH, metricX, metricY + tickH)
  doc.line(rightEdge, metricY - tickH, rightEdge, metricY + tickH)
  // Mid-tick at 50mm
  doc.setLineWidth(0.15)
  doc.line(metricX + 50, metricY - tickH * 0.6, metricX + 50, metricY + tickH * 0.6)
  doc.setLineWidth(0.3)
  doc.text('100 mm', metricX - 1, metricY + 0.5, { align: 'right' })

  // Imperial bar
  doc.line(imperialX, imperialY, rightEdge, imperialY)
  doc.line(imperialX, imperialY - tickH, imperialX, imperialY + tickH)
  doc.line(rightEdge, imperialY - tickH, rightEdge, imperialY + tickH)
  // Mid-tick at 2"
  doc.setLineWidth(0.15)
  doc.line(imperialX + 50.8, imperialY - tickH * 0.6, imperialX + 50.8, imperialY + tickH * 0.6)
  doc.setLineWidth(0.3)
  doc.text('4 in', imperialX - 1, imperialY + 0.5, { align: 'right' })

  // Tiny header above both bars
  doc.setFontSize(5)
  doc.setTextColor(155, 155, 155)
  doc.text('Verify print scale:', rightEdge, imperialY - barGap * 0.55, { align: 'right' })

  // ── Minimal instructions — next to the scale bars (bottom right) ─────
  // Keep everything a user needs to verify print scale in one place.
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(175, 175, 175)
  const lines = [
    'Print at 100% — do not scale to fit',
    'Center shoe on marker, trace, lift shoe',
    'Scan + upload at soleprint.rinthlabs.com',
  ]

  // Right-aligned, stacked above the scale bars.
  const instX = rightEdge
  const instY = imperialY - 16
  lines.forEach((line, i) => {
    doc.text(line, instX, instY + i * 4.5, { align: 'right' })
  })

  // ── Website URL — very small, bottom right below scale bars ─
  doc.setFontSize(5)
  doc.setTextColor(190, 190, 190)
  doc.text('soleprint.rinthlabs.com', rightEdge, pageH - 4, { align: 'right' })

  doc.save('SolePrint-Template.pdf')
}
