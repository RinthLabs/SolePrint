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

  // ── 50mm scale verification bar (bottom center) ──────────
  const barY = pageH - 10
  const barX = cx - 25
  doc.setDrawColor(80, 80, 80)
  doc.setLineWidth(0.3)
  doc.line(barX, barY, barX + 50, barY)
  doc.line(barX,      barY - 1.8, barX,      barY + 1.8)
  doc.line(barX + 50, barY - 1.8, barX + 50, barY + 1.8)
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text('50 mm', cx, barY + 4, { align: 'center' })

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

  doc.save('SolePrint-Template.pdf')
}
