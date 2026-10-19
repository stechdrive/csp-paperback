import { afterAll, beforeAll, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readFileSync } from 'node:fs'
import { applyMaterialEffects } from '../../engine/material-effects'
import { readMaterialEffects } from '../../utils/clip/material'

const effects = JSON.parse(readFileSync('testdata/clip-effects/effects.json', 'utf8')) as Record<string, string>
const read = (key: string) => readMaterialEffects({ LayerEffectAttached: 1, LayerEffectInfo: new Uint8Array(Buffer.from(effects[key], 'base64')) })!
const createElement = document.createElement.bind(document)
beforeAll(() => { document.createElement = ((tag: string) => tag === 'canvas' ? createCanvas(1, 1) : createElement(tag)) as typeof document.createElement })
afterAll(() => { document.createElement = createElement })
async function canvas(name: string) {
  const c = createCanvas(256, 256)
  c.getContext('2d').drawImage(await loadImage(`testdata/clip-effects/${name}.png`), 0, 0)
  return c as unknown as HTMLCanvasElement
}

it('distinguishes native watercolor from a normal outline and reads the checkbox-only A/B', () => {
  expect(read('watercolor')).toEqual({ watercolor: { range: 5, opacity: 50, darkness: 20, blur: 10 } })
  expect(read('edgeOn').edge).toEqual({ radius: 3, color: [255, 255, 255], reflectOpacity: true, antialias: true })
  expect(read('edgeOff').edge).toEqual({ radius: 3, color: [255, 255, 255], reflectOpacity: false, antialias: true })
})

it('omits an unsupported watercolor effect without adding a white outline or losing artwork', async () => {
  const base = await canvas('base')
  expect(applyMaterialEffects(base, 0, 0, read('watercolor'), 256, 256)).toBe(base)
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
  expect(alphaSum / (256 * 256)).toBeLessThan(4)
})
