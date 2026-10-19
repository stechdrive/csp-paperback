import { afterAll, beforeAll, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readFileSync } from 'node:fs'
import { applyMaterialEffects } from '../../engine/material-effects'
import { readMaterialEffects } from '../../utils/clip/material'
import type { MaterialEffects } from '../../types/rendering'
import { applyWatercolor } from '../../engine/watercolor-effect'

const effects = JSON.parse(readFileSync('testdata/clip-effects/effects.json', 'utf8')) as Record<string, string>
const options = JSON.parse(readFileSync('testdata/clip-effects/options.json', 'utf8')) as Record<string, string>
const kernels = JSON.parse(readFileSync('testdata/clip-effects/kernels.json', 'utf8')) as (MaterialEffects & { file: string })[]
const read = (key: string) => readMaterialEffects({ LayerEffectAttached: 1, LayerEffectInfo: new Uint8Array(Buffer.from(effects[key], 'base64')) })!
const createElement = document.createElement.bind(document)
beforeAll(() => { document.createElement = ((tag: string) => tag === 'canvas' ? createCanvas(1, 1) : createElement(tag)) as typeof document.createElement })
afterAll(() => { document.createElement = createElement })
async function canvas(name: string) {
  const image = await loadImage(`testdata/clip-effects/${name}.png`)
  const c = createCanvas(image.width, image.height)
  c.getContext('2d').drawImage(image, 0, 0)
  return c as unknown as HTMLCanvasElement
}

it('distinguishes native watercolor from a normal outline and reads the checkbox-only A/B', () => {
  expect(read('watercolor')).toEqual({ watercolor: { range: 5, opacity: 50, darkness: 20, blur: 10 } })
  expect(read('edgeOn').edge).toEqual({ radius: 3, color: [255, 255, 255], reflectOpacity: true, antialias: true })
  expect(read('edgeOff').edge).toEqual({ radius: 3, color: [255, 255, 255], reflectOpacity: false, antialias: true })
})

it('keeps unsupported watercolor styles and tone from changing source pixels', async () => {
  const base = await canvas('base')
  expect(applyMaterialEffects(base, 0, 0, { watercolor: { ...read('watercolor').watercolor!, style: 1 } }, 256, 256)).toBe(base)
  expect(applyMaterialEffects(base, 0, 0, { tone: true }, 256, 256)).toBe(base)
})

it('reads the native AA checkbox independently of opacity, and only enabled tone', () => {
  const row = (b: Uint8Array) => ({ LayerEffectAttached: 1, LayerEffectInfo: new Uint8Array(b) })
  const aa = readMaterialEffects(row(Buffer.from(options.antialiasOff, 'base64')))!
  expect(aa.edge).toMatchObject({ reflectOpacity: false, antialias: false })
  expect(readMaterialEffects(row(Buffer.from(options.waterVivid, 'base64')))?.watercolor).toMatchObject({ range: 5, style: 1 })
  const tone = Buffer.from(options.tone, 'base64')
  expect(readMaterialEffects(row(tone))).toEqual({ tone: true })
  tone.writeUInt32BE(0, tone.indexOf(Buffer.from('EffectTone', 'utf16le').swap16()) + 20)
  expect(readMaterialEffects(row(tone))).toBeUndefined()
})

function difference(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  let alphaMax = 0, alphaOverOne = 0, rgbMax = 0, sum = 0, foreground = 0
  for (let i = 0; i < a.length; i += 4) {
    const aa = a[i + 3] / 255, ba = b[i + 3] / 255, delta = Math.abs(a[i + 3] - b[i + 3])
    alphaMax = Math.max(alphaMax, delta)
    if (delta > 1) alphaOverOne++
    if (aa || ba) foreground++
    for (const background of [0, 255]) for (let c = 0; c < 3; c++) {
      const d = Math.abs(Math.round(a[i + c] * aa + background * (1 - aa)) - Math.round(b[i + c] * ba + background * (1 - ba)))
      sum += d; rgbMax = Math.max(rgbMax, d)
    }
  }
  return { alphaMax, alphaOverOne, rgbMax, rgbMean: sum / (foreground * 6 || 1) }
}

it.each(kernels.filter(k => k.edge))('matches native border kernels: $file', async fixture => {
  const base = await canvas('kernels-base'), native = await canvas(fixture.file.replace('.png', ''))
  const result = applyMaterialEffects(base, 0, 0, fixture, 128, 128)
  const pixels = (c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, 128, 128).data
  const diff = difference(pixels(result), pixels(native))
  if (fixture.edge!.antialias) {
    expect(diff.alphaMax).toBeLessThanOrEqual(1)
    expect(diff.rgbMax).toBeLessThanOrEqual(3)
  } else {
    // A few pixels at the hard alpha threshold depend on CSP's higher precision.
    expect(diff.alphaOverOne).toBeLessThanOrEqual(8)
    expect(diff.rgbMean).toBeLessThan(0.8)
  }
})

it.each(kernels.filter(k => k.watercolor && k.watercolor.range))('improves normal watercolor against the native export: $file', async fixture => {
  const base = await canvas('kernels-base'), native = await canvas(fixture.file.replace('.png', ''))
  const result = applyMaterialEffects(base, 0, 0, fixture, 128, 128)
  const pixels = (c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, 128, 128).data
  const diff = difference(pixels(result), pixels(native)), omitted = difference(pixels(base), pixels(native))
  // Both black and white backgrounds, with transparent margins excluded.
  expect(diff.rgbMean).toBeLessThan(omitted.rgbMean * 0.65)
  expect(diff.rgbMean).toBeLessThan(5)
})

it('keeps the watercolor blur continuous across processing tile boundaries', () => {
  const w = 541, h = 81, original = new Uint8ClampedArray(w * h * 4)
  for (let y = 22; y < 57; y++) for (let x = 241; x < 269; x++) original.set([80, 120, 180, 127], (y * w + x) * 4)
  const result = original.slice(), effect = { range: 10, opacity: 50, darkness: 20, blur: 10 }
  applyWatercolor(result, w, h, effect)
  // Shift the same paint away from the tile boundary, then shift the output back.
  const shifted = new Uint8ClampedArray(original.length)
  for (let y = 0; y < h; y++) shifted.set(original.subarray(y * w * 4, (y * w + w - 80) * 4), (y * w + 80) * 4)
  applyWatercolor(shifted, w, h, effect)
  for (let y = 0; y < h; y++) expect(result.subarray((y * w + 220) * 4, (y * w + 290) * 4))
    .toEqual(shifted.subarray((y * w + 300) * 4, (y * w + 370) * 4))
})

it.each([true, false])('preserves native translucent interiors with reflect opacity = %s', async enabled => {
  const actual = applyMaterialEffects(await canvas('base'), 0, 0, read(enabled ? 'edgeOn' : 'edgeOff'), 256, 256)
  const native = await canvas(enabled ? 'edge-on' : 'edge-off')
  const a = actual.getContext('2d')!.getImageData(0, 0, 256, 256).data
  const b = native.getContext('2d')!.getImageData(0, 0, 256, 256).data
  // Flat semitransparent paint must keep its native alpha, not become opaque.
  const at = (100 * 256 + 184) * 4
  expect(a[at + 3]).toBe(b[at + 3])
  expect(a[at + 3]).toBe(enabled ? 122 : 255)
  let alphaSum = 0, whiteMax = 0
  for (let i = 0; i < a.length; i += 4) {
    alphaSum += Math.abs(a[i + 3] - b[i + 3])
    for (let k = 0; k < 3; k++) whiteMax = Math.max(whiteMax, Math.abs(
      Math.round(a[i + k] * a[i + 3] / 255 + 255 - a[i + 3]) - Math.round(b[i + k] * b[i + 3] / 255 + 255 - b[i + 3])))
  }
  expect(whiteMax).toBeLessThanOrEqual(2)
  expect(alphaSum / (256 * 256)).toBeLessThan(0.1)
})
