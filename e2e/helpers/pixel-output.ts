import { initializeCanvas, writePsdBuffer } from 'ag-psd'
import { createCanvas } from '@napi-rs/canvas'

/** A sparse production-sized sheet with exact one-pixel detail across native-window boundaries. */
export function pixelOutput(width = 4096, height = 2048, alpha = 255) {
  initializeCanvas(createCanvas)
  const canvas = createCanvas(256, 256), ctx = canvas.getContext('2d')
  const image = ctx.createImageData(256, 256)
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const i = (y * 256 + x) * 4, value = (x + y) % 2 ? 255 : 0
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value
    image.data[i + 3] = alpha
  }
  ctx.putImageData(image, 0, 0)
  return { name: 'pixel-detail.psd', mimeType: 'application/octet-stream', buffer: writePsdBuffer({ width, height,
    children: [{ name: '_pixels', opened: false, children: [
      { name: 'pixels', canvas, left: width / 2 - 128, top: height / 2 - 128 },
    ] }] }) }
}
