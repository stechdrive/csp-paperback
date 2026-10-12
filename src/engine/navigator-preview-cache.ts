import type { CspLayer } from '../types'
import { flattenToCanvas } from './flatten'

interface CachedFrame {
  selectedCells: Map<string, number>
  canvas: HTMLCanvasElement
}

/**
 * The two navigator views share native-resolution pixels. Keep a few recent
 * selections for back-and-forth seeking, bounded by their RGBA pixel storage.
 * A single oversized frame is retained so the second view never recomposites it.
 * Layer trees and imported source canvases are immutable for the cache lifetime.
 */
export class NavigatorPreviewCache {
  private tree: CspLayer[] | null = null
  private width = 0
  private height = 0
  private frames: CachedFrame[] = []
  private readonly maxBytes: number
  private readonly maxFrames: number

  constructor(maxBytes = 64 * 1024 * 1024, maxFrames = 4) {
    this.maxBytes = maxBytes
    this.maxFrames = maxFrames
  }

  clear(): void {
    this.tree = null
    this.frames = []
  }

  get(tree: CspLayer[], width: number, height: number, selectedCells: Map<string, number>): HTMLCanvasElement {
    if (tree !== this.tree || width !== this.width || height !== this.height) {
      this.frames = []
      this.tree = tree
      this.width = width
      this.height = height
    }

    const index = this.frames.findIndex(frame => (
      frame.selectedCells.size === selectedCells.size &&
      [...frame.selectedCells].every(([id, cell]) => selectedCells.get(id) === cell)
    ))
    if (index >= 0) {
      const [frame] = this.frames.splice(index, 1)
      this.frames.push(frame)
      return frame.canvas
    }

    const canvas = flattenToCanvas(tree, width, height, 'white', selectedCells)
    const capacity = Math.max(1, Math.min(this.maxFrames, Math.floor(this.maxBytes / (width * height * 4))))
    this.frames.push({ selectedCells: new Map(selectedCells), canvas })
    while (this.frames.length > capacity) this.frames.shift()
    return canvas
  }
}
