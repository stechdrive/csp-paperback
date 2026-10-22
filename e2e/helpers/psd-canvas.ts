import { createCanvas } from '@napi-rs/canvas'

/** ag-psd uses the Canvas 2D subset; the fixture writer needs no DOM operations. */
export function createPsdCanvas(width: number, height: number): HTMLCanvasElement {
  return createCanvas(width, height) as unknown as HTMLCanvasElement
}
