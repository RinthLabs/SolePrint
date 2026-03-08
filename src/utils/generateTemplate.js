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

  // ── True crosshair lines ──────────────────────────────────
  // Two thin perpendicular lines, dark gray
  doc.setDrawColor(40, 40, 40)
  doc.setLineWidth(0.25)

  // Vertical arm (N/S): center gap of 2mm so the center circle breathes
  doc.line(cx, cy - armLong, cx, cy - 2.5)  // N arm
  doc.line(cx, cy + 2.5,     cx, cy + armLong)  // S arm

  // Horizontal arm (E/W): same center gap
  doc.line(cx - armShort, cy, cx - 2.5, cy)  // W arm
  doc.line(cx + 2.5,      cy, cx + armShort, cy)  // E arm

  // ── Tip markers (solid black squares, 8×8mm) ─────────────
  // These are what the detection algorithm finds
  const tipSize = 8
  doc.setFillColor(0, 0, 0)
  // N — centered at (cx, cy - armLong)
  doc.rect(cx - tipSize / 2, cy - armLong - tipSize / 2, tipSize, tipSize, 'F')
  // S — centered at (cx, cy + armLong)
  doc.rect(cx - tipSize / 2, cy + armLong - tipSize / 2, tipSize, tipSize, 'F')
  // W — centered at (cx - armShort, cy)
  doc.rect(cx - armShort - tipSize / 2, cy - tipSize / 2, tipSize, tipSize, 'F')
  // E — centered at (cx + armShort, cy)
  doc.rect(cx + armShort - tipSize / 2, cy - tipSize / 2, tipSize, tipSize, 'F')

  // ── Center circle (open, thin) ────────────────────────────
  doc.setDrawColor(40, 40, 40)
  doc.setLineWidth(0.25)
  doc.circle(cx, cy, 2, 'S')

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

  // ── Minimal instructions — bottom left, light gray ────────
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  const lines = [
    'Print at 100% — do not scale to fit',
    'Center shoe on +, trace outline, lift shoe',
    'Photograph from above and upload to soleprint.rinthlabs.com',
  ]
  const instX = 12
  const instY = pageH - 22
  lines.forEach((line, i) => {
    doc.text(line, instX, instY + i * 4.5)
  })

  // ── Website URL — very small, bottom right below scale bars ─
  doc.setFontSize(5)
  doc.setTextColor(190, 190, 190)
  doc.text('soleprint.rinthlabs.com', rightEdge, pageH - 4, { align: 'right' })

  doc.save('SolePrint-Template.pdf')
}
