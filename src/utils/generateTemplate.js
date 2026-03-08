import { jsPDF } from 'jspdf'

export function downloadTemplate() {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const pageW = 215.9
  const pageH = 279.4

  // Fiducial marker positions (centers)
  const markers = [
    { x: 25, y: 35 },       // Top-left
    { x: 190.9, y: 35 },    // Top-right
    { x: 25, y: 244.4 },    // Bottom-left
    { x: 190.9, y: 244.4 }  // Bottom-right
  ]

  const outerSize = 20
  const innerSize = 10
  const dotSize = 2

  // Draw fiducial markers
  markers.forEach(m => {
    // Outer black square
    doc.setFillColor(0, 0, 0)
    doc.rect(m.x - outerSize / 2, m.y - outerSize / 2, outerSize, outerSize, 'F')
    // Inner white square
    doc.setFillColor(255, 255, 255)
    doc.rect(m.x - innerSize / 2, m.y - innerSize / 2, innerSize, innerSize, 'F')
    // Center dot
    doc.setFillColor(0, 0, 0)
    doc.rect(m.x - dotSize / 2, m.y - dotSize / 2, dotSize, dotSize, 'F')
  })

  // Trace zone: dashed border connecting inner corners of markers
  const traceLeft = markers[0].x + outerSize / 2
  const traceRight = markers[1].x - outerSize / 2
  const traceTop = markers[0].y + outerSize / 2
  const traceBottom = markers[2].y - outerSize / 2

  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.setLineDashPattern([3, 3], 0)
  doc.rect(traceLeft, traceTop, traceRight - traceLeft, traceBottom - traceTop, 'S')

  // 10mm grid over trace zone
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.1)
  doc.setLineDashPattern([], 0)

  for (let x = traceLeft; x <= traceRight; x += 10) {
    doc.line(x, traceTop, x, traceBottom)
  }
  for (let y = traceTop; y <= traceBottom; y += 10) {
    doc.line(traceLeft, y, traceRight, y)
  }

  // Horizontal ruler tick marks along top edge
  doc.setDrawColor(150, 150, 150)
  doc.setLineWidth(0.2)
  doc.setFontSize(5)
  doc.setTextColor(150, 150, 150)

  for (let x = traceLeft; x <= traceRight; x += 10) {
    doc.line(x, traceTop - 5, x, traceTop)
    const mm = Math.round(x - traceLeft)
    doc.text(String(mm), x + 0.5, traceTop - 6)
  }

  // Title: "SolePrint" centered at top
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(46, 204, 143) // #2ECC8F
  doc.text('SolePrint', pageW / 2, 18, { align: 'center' })

  // Scale warning
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(220, 50, 50)
  doc.text('Print at 100% scale \u2014 do not scale to fit', pageW / 2, 25, { align: 'center' })

  // Instructions box below trace zone
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 80)
  const instrY = traceBottom + 18
  const instrX = 25
  const instructions = [
    '1. Print this page at exactly 100% (no \u2018fit to page\u2019)',
    '2. Place shoe sole-down inside the dashed box',
    '3. Trace carefully around the shoe with a BLACK marker',
    '4. Trace the INSIDE edge of the marker line for best accuracy',
    '5. Photograph from directly above in good, even lighting',
    '6. Upload the photo to SolePrint \u2014 the scale markers will be detected automatically'
  ]
  instructions.forEach((line, i) => {
    doc.text(line, instrX, instrY + i * 4)
  })

  // Scale verification bar at bottom
  const barY = pageH - 18
  const barX = pageW / 2 - 25
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.4)
  doc.setLineDashPattern([], 0)
  doc.line(barX, barY, barX + 50, barY)
  // End ticks
  doc.line(barX, barY - 2, barX, barY + 2)
  doc.line(barX + 50, barY - 2, barX + 50, barY + 2)
  doc.setFontSize(6)
  doc.setTextColor(80, 80, 80)
  doc.text('50mm \u2014 if this doesn\u2019t measure 50mm, reprint at 100%', pageW / 2, barY + 5, { align: 'center' })

  // Website URL bottom right
  doc.setFontSize(7)
  doc.setTextColor(180, 180, 180)
  doc.text('soleprint.rinthlabs.com', pageW - 15, pageH - 8, { align: 'right' })

  doc.save('SolePrint-Template.pdf')
}
