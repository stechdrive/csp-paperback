import { check, Reader } from './binary'
import { readAttribute, readRaster } from './raster'
import { readTextObjects } from './text'
import { num, str, errorMessage, type ClipRow } from './records'
import type { ClipDiagnostic, ClipLayer, ClipPixels } from './types'
import type { MaterialEffects, MaterialQuad } from '../../types/rendering'
import { readGradient } from './gradient'
import { readAdjustment } from './adjustment'
import { cropPixels } from './pixels'

/** Decode only drawing effects; palette label colors are deliberately unrelated. */
export function readMaterialEffects(row: ClipRow): MaterialEffects | undefined {
  const bytes = row.LayerEffectInfo
  if (!(bytes instanceof Uint8Array) || !num(row, 'LayerEffectAttached')) return
  const needle = [0, 0, 0, 10, ...Array.from('EffectEdge').flatMap(c => [0, c.charCodeAt(0)])]
  const start = bytes.findIndex((_, i) => needle.every((b, j) => bytes[i + j] === b))
  if (start < 0) return
  const r = new Reader(bytes.subarray(start + needle.length))
  if (!r.u32()) return
  const radius = r.number('f64')
  check(radius >= 0 && radius <= 256, '境界の太さが範囲外です')
  return { edge: { radius, color: [r.u32() >>> 24, r.u32() >>> 24, r.u32() >>> 24] } }
}

/** ResizableImageInfo describes static artwork placement, not animation/camera transforms. */
export function readMaterialQuad(bytes: Uint8Array): MaterialQuad {
  const r = new Reader(bytes)
  check(r.u32() === 120, '画像素材の配置形式が不正です')
  r.take(116)
  const tl = [r.number('f64'), r.number('f64')], tr = [r.number('f64'), r.number('f64')]
  const bl = [r.number('f64'), r.number('f64')], br = [r.number('f64'), r.number('f64')]
  return [...tl, ...tr, ...br, ...bl] as MaterialQuad
}

export interface MaterialTables {
  mipmaps: Map<number, ClipRow>
  mipInfos: Map<number, ClipRow>
  offscreens: Map<number, ClipRow>
  thumbnails: ClipRow[]
  external: Map<string, Uint8Array>
}

export function materialOffscreen(t: MaterialTables, row: ClipRow, field: string): ClipRow | undefined {
  const mip = t.mipmaps.get(num(row, field)), info = mip && t.mipInfos.get(num(mip, 'BaseMipmapInfo'))
  return info && num(info, 'ThisScale', 100) === 100 ? t.offscreens.get(num(info, 'Offscreen')) : undefined
}

/** Each layer can fall back independently; one failed image cannot cancel the document. */
export function createMaterialDecoder(t: MaterialTables, width: number, height: number, dpi: number, diagnostics: ClipDiagnostic[]) {
  let decodedBytes = 0
  const referenced = new Set([...t.mipInfos.values()].map(r => num(r, 'Offscreen')))
  for (const row of t.thumbnails) referenced.add(num(row, 'ThumbnailOffscreen'))
  const objects = new Map<number, ClipRow[]>()
  for (const off of t.offscreens.values()) if (!referenced.has(num(off, 'MainId')) && t.external.has(str(off.BlockData))) {
    const id = num(off, 'LayerId')
    objects.set(id, [...(objects.get(id) ?? []), off])
  }
  async function pixels(off: ClipRow | undefined, mask = false, keepExtent = false): Promise<ClipPixels | undefined> {
    if (!(off?.Attribute instanceof Uint8Array)) return
    const a = readAttribute(off.Attribute), body = t.external.get(str(off.BlockData))
    if (!body && !a.hasColor) return
    check(decodedBytes + a.width * a.height * 4 <= 512 * 1024 * 1024, '画像展開の合計が512 MiBを超えました')
    const decoded = await readRaster(a, body, mask)
    if (!decoded) return
    const retained = keepExtent ? decoded : cropPixels(decoded, mask)
    decodedBytes += retained.rgba.length
    return retained
  }
  return async (layer: ClipLayer, row: ClipRow) => {
    const failures: string[] = []
    const report = (message: string) => diagnostics.push({ scope: 'raster', layerId: layer.id, message: `「${layer.name}」: ${message}` })
    try {
      layer.effects = readMaterialEffects(row)
      if (layer.effects?.edge?.radius) report('境界線を近似描画します（輪郭の丸めはクリスタと差が生じます）')
    } catch (e) { report(errorMessage(e)) }
    if (row.FilterLayerInfo instanceof Uint8Array) {
      try {
        check(!num(row, 'LayerComposite'), '通常以外の合成モードの色調補正には未対応です')
        layer.adjustment = readAdjustment(row.FilterLayerInfo)
        layer.materialSource = 'adjustment'
      } catch (e) { report(errorMessage(e)) }
    } else if (!layer.isFolder) {
      // Original animation material takes precedence over a render of the current shooting frame.
      const candidates = [
        ['TimeLineOriginalMipmap', 'timeline-original'], ['LayerRenderMipmap', 'render'], ['ResizableOriginalMipmap', 'image-original'],
      ] as const
      for (const [field, source] of candidates) {
        try {
          const decoded = await pixels(materialOffscreen(t, row, field), false, source === 'image-original')
          if (!decoded) continue
          if (source === 'render' && layer.kind === 'image-material' && !decoded.rgba.some((value, i) => i % 4 === 3 && value > 0)) continue
          decoded.left += num(row, 'LayerOffsetX') + (source === 'render' ? num(row, 'LayerRenderOffscrOffsetX') : 0)
          decoded.top += num(row, 'LayerOffsetY') + (source === 'render' ? num(row, 'LayerRenderOffscrOffsetY') : 0)
          if (source === 'image-original' && row.ResizableImageInfo instanceof Uint8Array) {
            try { layer.placement = readMaterialQuad(row.ResizableImageInfo) }
            catch (e) { report(`${errorMessage(e)}。元画像の位置で描画します`) }
          }
          layer.pixels = decoded; layer.materialSource = source
          break
        } catch (e) { failures.push(errorMessage(e)) }
      }
      if (!layer.pixels && (row.TextLayerString != null || row.TextLayerStringArray != null)) {
        try {
          const texts = readTextObjects(row, dpi, report), caches = objects.get(num(row, 'MainId')) ?? []
          const fragments: ClipPixels[] = [], unresolved = []
          const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i])
          for (const text of texts) {
            const matching = caches.filter(off => {
              if (!(off.Attribute instanceof Uint8Array)) return false
              try {
                const a = readAttribute(off.Attribute)
                return a.width === text.width && a.height >= text.height
              } catch { return false }
            })
            const off = matching[0]
            const unique = off && matching.every(other => same(off.Attribute as Uint8Array, other.Attribute as Uint8Array) && same(t.external.get(str(off.BlockData))!, t.external.get(str(other.BlockData))!))
            let image: ClipPixels | undefined
            try { image = unique ? await pixels(off) : undefined } catch { /* Render this text object from metadata. */ }
            if (image) { image.left += text.left; image.top += text.top; fragments.push(image) }
            else unresolved.push(text)
          }
          if (fragments.length === 1) layer.pixels = fragments[0]
          else if (fragments.length) layer.fragments = fragments
          if (unresolved.length) { layer.text = unresolved; report('文字情報から描画します（フォント・組版は環境によって差が生じます）') }
          layer.materialSource = unresolved.length ? 'text' : fragments.length ? 'object-cache' : undefined
        } catch (e) { failures.push(errorMessage(e)) }
      }
      if (!layer.pixels && !layer.fragments?.length && !layer.text?.length && row.GradationFillInfo instanceof Uint8Array) {
        try {
          check(decodedBytes + width * height * 4 <= 512 * 1024 * 1024, '画像展開の合計が512 MiBを超えました')
          layer.pixels = readGradient(row.GradationFillInfo, width, height, num(row, 'LayerOffsetX'), num(row, 'LayerOffsetY'), report)
          decodedBytes += layer.pixels.rgba.length
          layer.materialSource = 'gradient'
        } catch (e) { failures.push(errorMessage(e)) }
      }
      if (!layer.pixels && !layer.fragments?.length && !layer.text?.length && num(row, 'DrawColorEnable')) {
        check(decodedBytes + width * height * 4 <= 512 * 1024 * 1024, '画像展開の合計が512 MiBを超えました')
        const rgba = new Uint8ClampedArray(width * height * 4)
        const rgb = ['Red', 'Green', 'Blue'].map(c => num(row, `DrawColorMain${c}`) >>> 24)
        decodedBytes += rgba.length
        for (let i = 0; i < rgba.length; i += 4) rgba.set([...rgb, 255], i)
        layer.pixels = { width, height, left: 0, top: 0, rgba }; layer.materialSource = 'fill'
      }
      if (!layer.pixels && !layer.fragments?.length && !layer.text?.length && (failures.length || !(num(row, 'LayerType') & 1))) report(failures[0] ?? '素材画像を復元できません。ほかの素材は引き続き書き出せます')
    }
    if (num(row, 'LayerType') & 2) {
      try {
        const mask = await pixels(materialOffscreen(t, row, 'LayerLayerMaskMipmap'), true)
        check(mask, 'マスク画像を復元できません')
        mask.left += num(row, 'LayerOffsetX') + num(row, 'LayerMaskOffsetX') + num(row, 'LayerMaskOffscrOffsetX')
        mask.top += num(row, 'LayerOffsetY') + num(row, 'LayerMaskOffsetY') + num(row, 'LayerMaskOffscrOffsetY')
        mask.disabled = !(num(row, 'LayerVisibility') & 2); layer.mask = mask
      } catch (e) { report(errorMessage(e)) }
    }
  }
}
