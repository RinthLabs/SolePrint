import { defineStore } from 'pinia'

export const useSoleStore = defineStore('sole', {
  state: () => ({
    uploadedImage: null,
    imageAdjustments: {
      rotate: 0,
      brightness: 100,
      contrast: 100,
      threshold: 128
    },
    params: {
      thickness: 12,
      edgeRoundness: 4,
      treadDepth: 3,
      heelLift: 5
    },
    previewReady: false,
    exportReady: false
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
    reset() {
      this.uploadedImage = null
      this.imageAdjustments = { rotate: 0, brightness: 100, contrast: 100, threshold: 128 }
      this.params = { thickness: 12, edgeRoundness: 4, treadDepth: 3, heelLift: 5 }
      this.previewReady = false
      this.exportReady = false
    }
  }
})
