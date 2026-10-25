import { writePsd, type Layer, type LayerMaskData, type Psd } from 'ag-psd'
import type { CspLayer, FlatLayer, VirtualSet } from '../types'
import { resolveVirtualSetLayers, virtualNodeIds, virtualSetTree } from './virtual-set-tree'
import { sanitizePathSegment } from './path-sanitize'
import { ImageBudget, imageBytes } from './image-budget'
import { layerMaterialDiagnostics, resolvedMaterialLayer, withPreparedMaterials } from '../engine/material-cache'
import { applyMaterialEffects, hasDrawableMaterialEffects } from '../engine/material-effects'
import { applyLayerMask, compositeGroup, createCanvas } from '../engine/compositor'
import { withCanvasResources } from '../engine/render-resources'
import { nativeBlendOverride } from './clip/blend'
import { rasterizeVirtualFolder } from './virtual-set-utils'

export const virtualSetPsdName = (name: string) => sanitizePathSegment(`${name.trim().replace(/\.psd$/i, '') || '仮想セル'}.psd`)

interface Options {
  width: number
  height: number
  dpiX?: number
  dpiY?: number
  cancelled?: () => boolean
}

/** PSD positions are integers. Bake only the subpixel offset, never layer opacity. */
function alignPixels(canvas: HTMLCanvasElement, left: number, top: number, background?: number) {
  const x = Math.floor(left), y = Math.floor(top)
  if (x === left && y === top) return { canvas, left, top }
  const aligned = createCanvas(Math.ceil(left + canvas.width) - x, Math.ceil(top + canvas.height) - y)
  const ctx = aligned.getContext('2d')!
  if (background !== undefined) { ctx.fillStyle = `rgb(${background},${background},${background})`; ctx.fillRect(0, 0, aligned.width, aligned.height) }
  ctx.drawImage(canvas, left - x, top - y)
  return { canvas: aligned, left: x, top: y }
}

function exportMask(layer: CspLayer): LayerMaskData | undefined {
  const mask = layer.agPsdRef.mask
  if (!mask?.canvas) return undefined
  const left = (mask.left ?? 0) + (mask.positionRelativeToLayer ? layer.left : 0)
  const top = (mask.top ?? 0) + (mask.positionRelativeToLayer ? layer.top : 0)
  const aligned = alignPixels(mask.canvas, left, top, mask.defaultColor ?? 0)
  return { ...mask, ...aligned, positionRelativeToLayer: false,
    right: aligned.left + aligned.canvas.width, bottom: aligned.top + aligned.canvas.height }
}

/** Preview only the exported PSD tree; animation folders are ordinary PSD folders. */
function previewLayers(layers: Layer[], width: number, height: number): FlatLayer[] {
  return layers.flatMap((layer, index) => {
    if (layer.hidden) return []
    if (layer.adjustment && !['invert', 'threshold'].includes(layer.adjustment.type)) return []
    const blendMode = layer.blendMode ?? 'normal', opacity = (layer.opacity ?? 1) * 100
    const children = layer.children && previewLayers(layer.children, width, height)
    if (children && blendMode === 'pass through' && opacity === 100 && !layer.clipping && (!layer.mask || layer.mask.disabled)) return children
    let canvas = children ? compositeGroup(children, width, height) : layer.canvas
    let top = children ? 0 : layer.top ?? 0, left = children ? 0 : layer.left ?? 0
    if (!canvas && layer.adjustment) {
      canvas = createCanvas(width, height)
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height)
    }
    if (!canvas) return []
    if (layer.mask?.canvas && !layer.mask.disabled) {
      canvas = applyLayerMask(canvas, top, left, layer.mask, width, height); top = 0; left = 0
    }
    return [{ canvas, top, left, blendMode, opacity, clipping: !!layer.clipping, sourceId: String(index),
      nativeBlendMode: nativeBlendOverride(0, blendMode),
      adjustment: layer.adjustment?.type === 'invert' ? { kind: 'invert' as const }
        : layer.adjustment?.type === 'threshold' ? { kind: 'threshold' as const, threshold: layer.adjustment.level ?? 128 } : undefined }]
  })
}

/** Source canvases stay pinned through encoding, including hidden layers and masks. */
export async function createVirtualSetPsd(source: CspLayer[], vs: VirtualSet, options: Options): Promise<{ buffer: ArrayBuffer; warnings: string[] }> {
  const { width, height } = options
  imageBytes(width, height)
  if (width < 1 || height < 1 || width > 30000 || height > 30000) throw new Error('PSDのキャンバスは縦横30,000ピクセルまでです')
  const roots = resolveVirtualSetLayers(source, vs), all: CspLayer[] = []
  const visit = (layers: CspLayer[]) => layers.forEach(layer => { all.push(layer); visit(layer.children) })
  visit(roots)
  if (!all.length) throw new Error('PSDに書き出すレイヤーを追加してください')
  if (all.length !== virtualNodeIds(virtualSetTree(vs, source)).size) throw new Error('参照先の素材が見つかりません。仮想セルのレイヤーを確認してください')
  if (all.reduce((count, layer) => count + (layer.isFolder ? 2 : 1), 0) > 32767) throw new Error('PSDのレイヤー数の上限を超えています。仮想セルを分けて書き出してください')
  return withPreparedMaterials(all, () => withCanvasResources(() => {
    const warnings = new Set<string>(), budget = new ImageBudget()
    // The writer retains channel buffers as well as a full document composite.
    budget.reserve(width, height, 16)
    const members = new Map(vs.members.map(member => [member.layerId, member]))
    const inspect = (input: CspLayer, baked = false) => {
      const layer = resolvedMaterialLayer(input)
      if (!layer.isFolder && (layer.materialMissing || layer.unsupported3D || layer.vectorRendering === 'unavailable' ||
        (!layer.agPsdRef.canvas && !layer.adjustment && !layer.agPsdRef.adjustment && layer.width > 0 && layer.height > 0))) {
        throw new Error(`「${layer.originalName}」の描画画像を取得できません。互換情報付きCLIPまたは同じ保存状態のPSDを読み込んでください`)
      }
      if (baked && layer.agPsdRef.adjustment && !['invert', 'threshold'].includes(layer.agPsdRef.adjustment.type)) {
        throw new Error(`「${layer.originalName}」の色調補正を含むフォルダは、効果をラスタライズできません`)
      }
      for (const diagnostic of layerMaterialDiagnostics(layer)) {
        if (diagnostic.outcome === 'approximate' || diagnostic.outcome === 'missing-effect') warnings.add(diagnostic.message)
      }
      if (layer.vectorRendering === 'approximate') warnings.add('一部のベクターレイヤーには近似描画を使用しています。')
      if (layer.materialEffects?.tone) warnings.add('CLIPのトーン効果はPSDに引き継ぎません。')
      if (layer.materialEffects?.watercolor) warnings.add(layer.materialEffects.watercolor.style
        ? 'この種類の水彩境界はPSDに引き継ぎません。' : '水彩境界には近似描画を使用しています。')
      if (layer.agPsdRef.effects) warnings.add('PSD素材のレイヤースタイルは描画画像に含まれる範囲で使用し、編集可能な効果としては引き継ぎません。')
    }
    const inspectBakedChildren = (children: CspLayer[]) => children.forEach(child => {
      if (!(vs.visibilityOverrides[child.id] ?? (!child.hidden && !child.uiHidden))) return
      inspect(child, true)
      inspectBakedChildren(child.children)
    })
    const convert = (input: CspLayer): Layer => {
      const layer = resolvedMaterialLayer(input), member = members.get(layer.id), override = vs.layerOverrides?.[layer.id]
      inspect(layer)
      const blendMode = override?.blendMode ?? member?.blendMode ?? layer.blendMode
      const opacity = override?.opacity ?? member?.opacity ?? layer.opacity
      const result: Layer = { name: layer.originalName, blendMode: blendMode as Layer['blendMode'], opacity: opacity / 100,
        hidden: !(vs.visibilityOverrides[layer.id] ?? (!layer.hidden && !layer.uiHidden)), clipping: layer.clipping,
        mask: exportMask(layer) }
      if (result.mask?.canvas) budget.reserve(result.mask.canvas.width, result.mask.canvas.height, 8)
      if (layer.isFolder) {
        if (hasDrawableMaterialEffects(layer.materialEffects)) {
          inspectBakedChildren(layer.children)
          budget.reserve(width, height, 12)
          result.canvas = rasterizeVirtualFolder(layer, width, height, vs.members, vs.visibilityOverrides, vs.layerOverrides ?? {})
          result.left = 0; result.top = 0
          // A pixel layer has no pass-through semantics. Effects already isolate this folder.
          if (result.blendMode === 'pass through') result.blendMode = 'normal'
          warnings.add(`「${layer.originalName}」のフォルダ効果を焼き込み、1枚の画像レイヤーに変換しました。`)
        } else {
          result.children = [...layer.children].reverse().map(convert)
          result.opened = true
        }
      } else {
        const adjustment = layer.adjustment
        result.adjustment = adjustment?.kind === 'invert' ? { type: 'invert' }
          : adjustment?.kind === 'threshold' ? { type: 'threshold', level: adjustment.threshold } : layer.agPsdRef.adjustment
        if (result.adjustment && !['invert', 'threshold'].includes(result.adjustment.type)) warnings.add('一部の色調補正はPSDの設定として保持しますが、PSDに埋め込む合成プレビューには反映できません。')
        if (!result.adjustment && layer.agPsdRef.canvas) {
          const canvas = applyMaterialEffects(layer.agPsdRef.canvas, layer.left, layer.top, layer.materialEffects, width, height)
          const fullSize = canvas !== layer.agPsdRef.canvas
          Object.assign(result, alignPixels(canvas, fullSize ? 0 : layer.left, fullSize ? 0 : layer.top))
          budget.reserve(result.canvas!.width, result.canvas!.height, 12)
        }
      }
      if ((layer.nativeBlendMode === 10 || layer.nativeBlendMode === 12) && !override?.blendMode && !member?.blendMode) warnings.add('CLIP固有の発光合成は、PSDの覆い焼き／加算に置き換わります。')
      return result
    }
    const children = [...roots].reverse().map(convert)
    const psd: Psd = { width, height, children, canvas: compositeGroup(previewLayers(children, width, height), width, height) }
    if (options.dpiX && options.dpiY) psd.imageResources = { resolutionInfo: {
      horizontalResolution: options.dpiX, verticalResolution: options.dpiY,
      horizontalResolutionUnit: 'PPI', verticalResolutionUnit: 'PPI', widthUnit: 'Inches', heightUnit: 'Inches',
    } }
    return { buffer: writePsd(psd, { noBackground: true, trimImageData: true }), warnings: [...warnings] }
  }, () => []), options.cancelled)
}
