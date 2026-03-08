import { jsPDF } from 'jspdf'

export function downloadTemplate() {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const pageW = 215.9
  const pageH = 279.4
  const cx = pageW / 2   // 107.95
  const cy = pageH / 2   // 139.7

  // --- Crosshair dimensions ---
  const armLong = 20    // N and S arms extend 20mm from center
  const armShort = 10   // E and W arms extend 10mm from center
  const armWidth = 6    // arm thickness in mm
  const tipSize = 10    // tip squares are 10×10mm

  // --- Title ---
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(46, 204, 143)
  doc.text('SolePrint', pageW / 2, 18, { align: 'center' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(220, 50, 50)
  doc.text('Print at 100% scale \u2014 do not scale to fit', pageW / 2, 26, { align: 'center' })

  // --- Crosshair arms (light gray background) ---
  doc.setFillColor(210, 210, 210)
  // Vertical arm (N/S): full 40mm tall, 6mm wide
  doc.rect(cx - armWidth / 2, cy - armLong, armWidth, armLong * 2, 'F')
  // Horizontal arm (E/W): full 20mm wide, 6mm tall
  doc.rect(cx - armShort, cy - armWidth / 2, armShort * 2, armWidth, 'F')

  // --- Tip squares (solid black, 10×10mm) ---
  doc.setFillColor(0, 0, 0)
  // N tip: center at (cx, cy - armLong)
  doc.rect(cx - tipSize / 2, cy - armLong - tipSize / 2, tipSize, tipSize, 'F')
  // S tip: center at (cx, cy + armLong)
  doc.rect(cx - tipSize / 2, cy + armLong - tipSize / 2, tipSize, tipSize, 'F')
  // W tip: center at (cx - armShort, cy)
  doc.rect(cx - armShort - tipSize / 2, cy - tipSize / 2, tipSize, tipSize, 'F')
  // E tip: center at (cx + armShort, cy)
  doc.rect(cx + armShort - tipSize / 2, cy - tipSize / 2, tipSize, tipSize, 'F')

  // --- Center dot ---
  doc.setFillColor(0, 0, 0)
  doc.circle(cx, cy, 1.5, 'F')

  // --- Dashed oval placement guide (90×130mm, roughly shoe-sized) ---
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.setLineDashPattern([3, 3], 0)
  doc.ellipse(cx, cy, 45, 65, 'S')  // rx=45 (90mm wide), ry=65 (130mm tall)
  doc.setLineDashPattern([], 0)

  // Oval label
  doc.setFontSize(6)
  doc.setTextColor(160, 160, 160)
  doc.text('Center shoe over the + mark', cx, cy - 67, { align: 'center' })

  // --- Fiducial dimension annotations (light gray, small text) ---
  doc.setFontSize(5.5)
  doc.setTextColor(160, 160, 160)
  // Annotate N/S arm distance
  doc.text('40mm', cx + armWidth / 2 + 2, cy, { align: 'left' })
  // Annotate E/W arm distance
  doc.text('20mm', cx, cy + armWidth / 2 + 4, { align: 'center' })

  // --- Instructions ---
  const instrStartY = cy + 65 + 14  // just below the oval
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(60, 60, 60)
  doc.text('How to use this template:', pageW / 2, instrStartY, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  const steps = [
    '1.  Place shoe sole-down, centered over the + crosshair',
    '2.  Trace carefully around the shoe with a BLACK marker',
    '3.  Lift the shoe straight up off the paper',
    '4.  Photograph from directly above in good, even lighting',
    '5.  Upload the photo \u2014 scale is detected automatically from the crosshair',
  ]
  steps.forEach((line, i) => {
    doc.text(line, pageW / 2, instrStartY + 6 + i * 5.5, { align: 'center' })
  })

  // Tip note
  doc.setFontSize(6.5)
  doc.setTextColor(130, 130, 130)
  doc.text('Tip: use a thick black marker and trace the INSIDE edge of the line for best accuracy.',
    pageW / 2, instrStartY + 6 + steps.length * 5.5 + 4, { align: 'center' })

  // --- 50mm scale verification bar ---
  const barY = pageH - 14
  const barX = cx - 25
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.5)
  doc.line(barX, barY, barX + 50, barY)
  doc.line(barX, barY - 2.5, barX, barY + 2.5)
  doc.line(barX + 50, barY - 2.5, barX + 50, barY + 2.5)
  doc.setFontSize(6)
  doc.setTextColor(80, 80, 80)
  doc.text('50 mm \u2014 if this measures differently, reprint at exactly 100%', cx, barY + 5, { align: 'center' })

  // --- Website URL ---
  doc.setFontSize(7)
  doc.setTextColor(190, 190, 190)
  doc.text('soleprint.rinthlabs.com', pageW - 12, pageH - 4, { align: 'right' })

  doc.save('SolePrint-Template.pdf')
}
