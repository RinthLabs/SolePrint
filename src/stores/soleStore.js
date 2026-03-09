import { defineStore } from 'pinia'

export const useSoleStore = defineStore('sole', {
  state: () => ({
    uploadedImage: null,
    imageAdjustments: {
      rotate: 0,
      brightness: 100,
      contrast: 100,
      threshold: 128,
      blur: 5,        // default heavy blur to handle marker ink spread
      simplify: 3,    // RDP epsilon in mm — lower = more detail, higher = less
      smooth: 2,      // 0-10 UI scale, maps to Catmull-Rom tension 1-(n/10)
    },
    params: {
      thickness:    12,
      edgeRoundness: 4,
      heelLift:      5,
      rimHeight:     0,
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
      this.imageAdjustments = { rotate: 0, brightness: 100, contrast: 100, threshold: 128, blur: 5, simplify: 3, smooth: 2 }
      this.params = { thickness: 12, edgeRoundness: 4, heelLift: 5, rimHeight: 0 }
      this.previewReady = false
      this.exportReady = false
      this.detectedSvgPath = null
      this.detectedWidthMm = null
      this.detectedHeightMm = null
      this.scaleMmPerPx = null
    }
  }
})
