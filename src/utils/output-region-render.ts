import { codecDiagnostic } from './clip/celcodec'
import { imageBytes, ImageResourceError } from './image-budget'
import { pixelCanvas } from '../engine/material-image'
import type { ClipDrawing } from '../engine/clip-composition'
import type { OutputFile } from './output-plan'
import type { ProjectSettings } from '../types'
import type { PreviewRegion } from '../engine/preview-region'
import { collectRenderMaterials } from '../engine/material-dependencies'
import { withPreparedMaterials, updateRenderedMaterialDiagnostics } from '../engine/material-cache'
import { outputSources, recordEvaluatedSources } from '../engine/render-sources'
import { hasVectorWarning, hasUnsupported3D } from '../engine/render-warning'
import { withCanvasResources, releaseCanvas } from '../engine/render-resources'
import { applyRevisionBorders } from './revision-border'
import { renderIssues } from './render-diagnostics'
import type { ClipDiagnostic } from './clip/types'
import type { RenderedOutput } from './output-render-queue'
import type { CompositionRenderResult } from 'celcodec/render'
import { ClipError } from 'celcodec'

const dependencies = new WeakMap<OutputFile, ReturnType<typeof collectRenderMaterials>>()
function materials(file: OutputFile) {
  let layers = dependencies.get(file)
  if (!layers) { layers = collectRenderMaterials(() => file.renderCanvas(new Map())); dependencies.set(file, layers) }
  return layers
}

function nativeResult(file: OutputFile, result: CompositionRenderResult, diagnostics: ClipDiagnostic[]) {
  const drawing = file.clipDrawing!, layers = [...drawing.placements.values()]
  const converted = result.diagnostics.filter(d => !['APPROXIMATE_COMPOSITING', 'APPROXIMATE_ADJUSTMENT'].includes(d.code)).map(d => codecDiagnostic(d))
  for (const node of result.nodes) if (node.visible && node.layerId) {
    const layer = drawing.placements.get(node.id)
    if (layer) updateRenderedMaterialDiagnostics(layer.agPsdRef, converted.filter(d => d.layerId === node.layerId))
  }
  if (result.status === 'unavailable') throw new Error(converted.map(d => d.message).join('\n') || 'CLIPを描画できませんでした')
  const sources = { all: new Set<string>(), content: new Set<string>() }
  for (const node of result.nodes) if (node.visible) {
    const layer = drawing.placements.get(node.id)
    if (layer) { sources.all.add(layer.id); if (drawing.content.has(layer.id)) sources.content.add(layer.id) }
  }
  const own = renderIssues(layers.filter(l => sources.all.has(l.id)), [...diagnostics, ...converted])
  const global = converted.filter(d => !d.layerId).map(d => ({ ...d, layerId: '', layerName: '' }))
  return { pixels: result.pixels, sources, vectorWarning: converted.some(d => d.materialKind === 'vector' && d.outcome !== undefined),
    unsupported3D: converted.some(d => d.code === 'UNSUPPORTED_3D'), diagnostics: [...own, ...global] }
}

/** Caller-owned straight RGBA, preserving low-alpha color during PNG encoding. */
export async function renderOutputPixels(file: OutputFile, region: PreviewRegion, diagnostics: ClipDiagnostic[] = []) {
  const result = nativeResult(file, await file.clipDrawing!.render(region), diagnostics)
  if (result.pixels.width !== region.width || result.pixels.height !== region.height || result.pixels.left !== region.left || result.pixels.top !== region.top)
    throw new Error('CLIPの描画範囲が要求と一致しません')
  return result
}

/** Native windows and downsampled windows use the same compositor as export. */
async function renderNativeRegion(file: OutputFile, region: PreviewRegion, scale: number,
  table: ProjectSettings['processTable'], border: boolean, diagnostics: ClipDiagnostic[] = [], cancelled = () => false): Promise<RenderedOutput> {
  const preview = file.preview!
  if (file.clipDrawing) {
    if (cancelled()) throw new Error('描画要求が変更されたため中止しました')
    const result = await file.clipDrawing.render(region)
    if (cancelled()) throw new Error('描画要求が変更されたため中止しました')
    const { pixels, ...metadata } = nativeResult(file, result, diagnostics)
    const raw = pixelCanvas(pixels)
    try {
      const painted = applyRevisionBorders([{ ...file, canvas: raw }], table, border,
        { left: region.left, top: region.top, width: preview.width, height: preview.height })[0].canvas
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(region.width * scale)); canvas.height = Math.max(1, Math.round(region.height * scale))
      const ctx = canvas.getContext('2d')!; ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(painted, 0, 0, canvas.width, canvas.height)
      if (painted !== raw) releaseCanvas(painted)
      recordEvaluatedSources(canvas, metadata.sources)
      return { canvas, ...metadata,
        nativeWidth: region.width, nativeHeight: region.height }
    } finally { releaseCanvas(raw) }
  }
  const layers = materials(file)
  return withPreparedMaterials(layers, () => withCanvasResources(() => {
    const raw = preview.render(region), sources = outputSources(raw)
    try {
      const painted = applyRevisionBorders([{ ...file, canvas: raw }], table, border,
        { left: region.left, top: region.top, width: preview.width, height: preview.height })[0].canvas
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(region.width * scale)); canvas.height = Math.max(1, Math.round(region.height * scale))
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = scale < 1; ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(painted, 0, 0, canvas.width, canvas.height)
      return { canvas, sources, vectorWarning: hasVectorWarning(raw), unsupported3D: hasUnsupported3D(raw),
        nativeWidth: region.width, nativeHeight: region.height,
        diagnostics: renderIssues(layers.filter(layer => sources.all.has(layer.id)), diagnostics) }
    } finally { releaseCanvas(raw) }
  }, () => []), cancelled)
}

/** Downsampled windows are assembled in bounded native chunks, including very distant overviews. */
export async function renderOutputRegion(file: OutputFile, region: PreviewRegion, scale: number,
  table: ProjectSettings['processTable'], border: boolean, diagnostics: ClipDiagnostic[] = [], cancelled = () => false): Promise<RenderedOutput> {
  try { imageBytes(Math.max(1, Math.round(region.width * scale)), Math.max(1, Math.round(region.height * scale))) }
  catch (error) { throw new ImageResourceError(error instanceof Error ? error.message : '出力画像の容量が上限を超えました') }
  if (file.clipDrawing && !border && scale < 1) {
    const sampleScale = Math.max(1 / 256, 2 ** -Math.max(0, Math.floor(Math.log2(1 / scale))))
    if (sampleScale < 1) {
      const left = Math.floor(region.left * sampleScale), top = Math.floor(region.top * sampleScale)
      const request = { left, top, width: Math.ceil((region.left + region.width) * sampleScale) - left,
        height: Math.ceil((region.top + region.height) * sampleScale) - top }
      if (cancelled()) throw new Error('描画要求が変更されたため中止しました')
      let previewResult: CompositionRenderResult | undefined
      try { previewResult = await file.clipDrawing.render(request, sampleScale) }
      catch (error) {
        // Older CLIPs may have no usable Mipmap. Their native fallback can exceed
        // the preview budget, while bounded original tiles still fit.
        if (!(error instanceof ImageResourceError) && !(error instanceof ClipError && error.diagnostic.kind === 'resource-limit')) throw error
      }
      if (cancelled()) throw new Error('描画要求が変更されたため中止しました')
      if (previewResult && previewResult.status !== 'unavailable') {
        const { pixels, ...metadata } = nativeResult(file, previewResult, diagnostics), raw = pixelCanvas(pixels)
        try {
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(region.width * scale)); canvas.height = Math.max(1, Math.round(region.height * scale))
          const context = canvas.getContext('2d')!; context.imageSmoothingQuality = 'high'
          context.drawImage(raw, region.left * sampleScale - left, region.top * sampleScale - top,
            region.width * sampleScale, region.height * sampleScale, 0, 0, canvas.width, canvas.height)
          recordEvaluatedSources(canvas, metadata.sources)
          return { canvas, ...metadata, nativeWidth: region.width, nativeHeight: region.height }
        } finally { releaseCanvas(raw) }
      }
    }
  }
  if (region.width <= 1024 && region.height <= 1024) return renderNativeRegion(file, region, scale, table, border, diagnostics, cancelled)
  const { width, height } = region
  // Power-of-two sampling keeps chunk boundaries on integer destination pixels.
  // A tiny overview still uses a small intermediate, then shrinks once as a whole.
  const workingScale = Math.max(1 / 256, 2 ** -Math.max(0, Math.floor(Math.log2(1 / scale))))
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.ceil(width * workingScale)); canvas.height = Math.max(1, Math.ceil(height * workingScale))
  const ctx = canvas.getContext('2d')!, sources = { all: new Set<string>(), content: new Set<string>() }
  let vectorWarning = false, unsupported3D = false
  const issues = new Map<string, NonNullable<RenderedOutput['diagnostics']>[number]>()
  try {
    const step = 768
    for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
      if (cancelled()) throw new Error('描画要求が変更されたため中止しました')
      const part = { left: region.left + x, top: region.top + y, width: Math.min(step, width - x), height: Math.min(step, height - y) }
      const image = await renderNativeRegion(file, part, 1, table, border, diagnostics, cancelled)
      try {
        // Fill the final sample completely; a fractional destination edge would
        // mix transparency into the document's last row/column a second time.
        const w = x + part.width === width ? canvas.width - x * workingScale : part.width * workingScale
        const h = y + part.height === height ? canvas.height - y * workingScale : part.height * workingScale
        ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image.canvas, x * workingScale, y * workingScale, w, h)
        image.sources.all.forEach(id => sources.all.add(id)); image.sources.content.forEach(id => sources.content.add(id))
        vectorWarning ||= image.vectorWarning; unsupported3D ||= image.unsupported3D
        image.diagnostics?.forEach(issue => issues.set(JSON.stringify(issue), issue))
      } finally { releaseCanvas(image.canvas) }
      // Give gestures/cancellation a chance between native windows, including cached materials.
      await new Promise<void>(resolve => setTimeout(resolve, 0))
    }
    if (workingScale === scale && canvas.width === Math.round(width * scale) && canvas.height === Math.round(height * scale)) {
      recordEvaluatedSources(canvas, sources)
      return { canvas, sources, vectorWarning, unsupported3D, diagnostics: [...issues.values()], nativeWidth: width, nativeHeight: height }
    }
    const result = document.createElement('canvas')
    result.width = Math.max(1, Math.round(width * scale)); result.height = Math.max(1, Math.round(height * scale))
    const output = result.getContext('2d')!; output.imageSmoothingQuality = 'high'
    output.drawImage(canvas, 0, 0, result.width, result.height)
    releaseCanvas(canvas)
    recordEvaluatedSources(result, sources)
    return { canvas: result, sources, vectorWarning, unsupported3D, diagnostics: [...issues.values()], nativeWidth: width, nativeHeight: height }
  } catch (error) { releaseCanvas(canvas); throw error }
}

export async function renderOutputOverview(file: OutputFile, edge: number, table: ProjectSettings['processTable'],
  border: boolean, diagnostics: ClipDiagnostic[], cancelled: () => boolean): Promise<RenderedOutput> {
  const { width, height } = file.preview!, scale = Math.min(1, Math.max(1, edge) / Math.max(width, height))
  if (edge === 0) return { ...await renderNativeRegion(file, { left: 0, top: 0, width: 1, height: 1 }, 1, table, border, diagnostics, cancelled),
    nativeWidth: width, nativeHeight: height }
  return renderOutputRegion(file, { left: 0, top: 0, width, height }, scale, table, border, diagnostics, cancelled)
}

export async function renderClipOverview(drawing: ClipDrawing, edge: number, cancelled: () => boolean): Promise<HTMLCanvasElement> {
  const file: OutputFile = { outputId: 'preview', gateId: 'preview', path: '', flatName: '', sourceLayerId: '',
    relativePath: '', segments: [], fileName: '', names: { path: '', flatName: '' }, renderKey: '',
    clipDrawing: drawing, preview: { width: drawing.width, height: drawing.height, render() { throw new Error('Native preview') } },
    renderCanvas() { throw new Error('Native preview') } }
  return (await renderOutputOverview(file, edge, [], false, [], cancelled)).canvas
}
