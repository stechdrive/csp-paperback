import { initializeCanvas, writePsdBuffer } from 'ag-psd'
import { createCanvas } from '@napi-rs/canvas'

export function manyOutputs(count = 1200, folder = 'A', width = 64, height = 48) {
  initializeCanvas(createCanvas)
  const children = Array.from({ length: count }, (_, i) => {
    const canvas = createCanvas(width, height), context = canvas.getContext('2d')
    context.fillStyle = `hsl(${i * 17},65%,50%)`; context.fillRect(3, 4, 54, 36)
    context.fillStyle = '#111'; context.font = '12px sans-serif'; context.fillText(String(i + 1), 8, 25)
    return { name: String(i + 1), canvas }
  })
  const psd = writePsdBuffer({ width, height, children: [{ name: folder, opened: false, blendMode: 'pass through', children }] })
  const xdts = Buffer.from('exchangeDigitalTimeSheet Save Data\n' + JSON.stringify({ version: 5, timeTables: [{
    name: 'many', duration: count, frameRate: 24, timeTableHeaders: [{ fieldId: 0, names: [folder] }],
    fields: [{ fieldId: 0, tracks: [{ trackNo: 0, frames: children.map((_, i) => ({ frame: i, data: [{ id: 0, values: [String(i + 1)] }] })) }] }],
  }] }))
  return [{ name: 'many.psd', mimeType: 'application/octet-stream', buffer: psd }, { name: 'many.xdts', mimeType: 'application/octet-stream', buffer: xdts }]
}
