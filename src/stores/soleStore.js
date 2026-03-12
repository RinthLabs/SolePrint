import { defineStore } from 'pinia'

export const useSoleStore = defineStore('sole', {
  state: () => ({
    uploadedImage: null,
    imageAdjustments: {
      blackPoint: 0,   // levels black point (0-254)
      whitePoint: 220, // levels white point (1-255) — default clips bright paper to 220
      threshold: 128,
      blur: 5,         // default heavy blur to handle marker ink spread
      detail: 64,      // 0=blocky, 100=max detail; converts to RDP epsilon = 8 - (detail/100)*7.8
      smooth: 2,       // 0-10 UI scale, maps to Catmull-Rom tension 1-(n/10)
    },
    params: {
      thickness:    12,
      edgeRoundness: 4,
      heelLift:      5,
      rimHeight:     0,
      rimWidth:      4,
    },
    previewReady: false,
    exportReady: false,
    detectedSvgPath: null,
    detectedWidthMm: null,
    detectedHeightMm: null,
    scaleMmPerPx: null
  }),
  actions: {
    setImage(base64) {
      this.uploadedImage = base64
    },
    updateAdjustments(adjustments) {
      this.imageAdjustments = { ...this.imageAdjustments, ...adjustments }
    },
    updateParams(params) {
      this.params = { ...this.params, ...params }
    },
    setPreviewReady(val) {
      this.previewReady = val
    },
    setDetectedOutline({ svgPath, widthMm, heightMm, scaleMmPerPx }) {
      this.detectedSvgPath = svgPath
      this.detectedWidthMm = widthMm
      this.detectedHeightMm = heightMm
      this.scaleMmPerPx = scaleMmPerPx
    },
    reset() {
      this.uploadedImage = null
      this.imageAdjustments = { blackPoint: 0, whitePoint: 220, threshold: 128, blur: 5, detail: 64, smooth: 2 }
      this.params = { thickness: 12, edgeRoundness: 4, heelLift: 5, rimHeight: 0, rimWidth: 4 }
      this.previewReady = false
      this.exportReady = false
      this.detectedSvgPath = null
      this.detectedWidthMm = null
      this.detectedHeightMm = null
      this.scaleMmPerPx = null
    }
  }
})
