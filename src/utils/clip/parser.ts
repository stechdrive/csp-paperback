import type { SqlJsStatic } from 'sql.js'
import { ClipError, openDocument, type LayerView, type SessionOptions } from 'celcodec'
import { createCompositionRenderer, type CompositionRenderer, type RenderComposition, type CompositionRenderResult } from 'celcodec/render'
import type { CanvasFactory } from 'celcodec/canvas'
import type { ImageRegion } from 'celcodec'
import { CLIP_BLEND_MODES as blends } from './blend'
import { isMediaKind } from '../layer-display'
import { MAX_LAYER_COUNT, MAX_LAYER_DEPTH } from '../image-budget'
import { materialDiagnostics } from './material'
import { codecDiagnostic } from './celcodec'
import { projectTimeline } from './timeline'
import type { ClipDiagnostic, ClipDocument, ClipLayer } from './types'

export interface ClipSession {
  document: ClipDocument
  decode: (id: string, maxDecodedBytes?: number) => Promise<{ layer: ClipLayer; diagnostics: ClipDiagnostic[] }>
  render(composition: RenderComposition, region: ImageRegion): Promise<CompositionRenderResult>
  dispose(): void
}

/** Own a public celcodec session; only the application's presentation model is mutable. */
export async function openClipSession(bytes: Uint8Array, SQL: SqlJsStatic,
  options: Pick<SessionOptions, 'ownership' | 'signal'> & { canvas?: CanvasFactory } = {}): Promise<ClipSession> {
  // Normalize Buffer/foreign-realm views without copying; the session then
  // implements the requested copy/borrow ownership.
  const input = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const { canvas, ...sessionOptions } = options
  let renderer: CompositionRenderer | undefined
  const native = openDocument(SQL, input, {
    ...sessionOptions, maxRows: MAX_LAYER_COUNT, maxDepth: MAX_LAYER_DEPTH,
    // Document dimensions follow CSP. Pixel allocations have independent budgets.
  })
  try {
    const diagnostics: ClipDiagnostic[] = [], layersById = new Map<string, ClipLayer>()
    function project(nodes: readonly LayerView[]): ClipLayer[] {
      return nodes.filter(node => node.role === 'artwork').map(node => {
        const media = isMediaKind(node.kind)
        const properties = native.readLayerProperties(node.id)
        const blend = node.blendMode ?? 0
        if (!media && !blends[blend]) diagnostics.push({ scope: 'raster', part: 'blend',
          code: 'UNSUPPORTED_LAYER_BLEND', layerId: node.id,
          message: `「${node.name}」: 合成モード ${blend} は未対応です（通常で表示）` })
        if (!media) diagnostics.push(...properties.diagnostics.map(d => codecDiagnostic(d, node)))
        const layer: ClipLayer = {
          id: node.id, name: node.name, isFolder: node.folder, isAnimationFolder: node.animation,
          expanded: node.expanded ?? true, hidden: node.visible === false,
          opacity: (properties.keyframesEnabled ? properties.originalOpacity : undefined) ?? node.opacity ?? 1, blendMode: blends[blend] ?? 'normal',
          nativeBlendMode: blend, clipping: properties.clipping ?? false,
          kind: node.kind, paletteColor: node.labelColor, maskState: node.mask,
          effects: media ? undefined : properties.effects,
          children: project(node.children),
        }
        layersById.set(node.id, layer)
        return layer
      })
    }
    const layers = project(native.document.layers)
    const timelines = native.document.timelines.map(t => projectTimeline(native, t, layersById))
    const selected = native.document.timelines.find(t => t.id === native.document.defaultTimelineId)
    const document: ClipDocument = {
      width: native.document.canvas.width, height: native.document.canvas.height,
      dpi: native.document.canvas.dpi, layers, timelines, diagnostics,
      compatibility: native.document.compatibility,
      defaultTimelineId: selected?.nativeId ?? timelines[0]?.id ?? null,
    }
    return {
      document,
      async decode(id, maxDecodedBytes = 384 * 1024 * 1024) {
        const metadata = layersById.get(id)
        if (!metadata) throw new ClipError('MISSING_ROW', { layerId: id })
        const decoded = await native.decodeLayer(id, {
          source: 'original', budget: 'cropped', maxDecodedBytes: Math.min(maxDecodedBytes, 384 * 1024 * 1024),
        })
        // Folder/movie snapshots are never an alternative to the selected cels.
        if (decoded.layer.savedComposite) throw new Error('CLIPの保存合成画像は素材出力に使用できません')
        const layer: ClipLayer = { ...metadata, ...decoded.layer, children: [] }
        return { layer, diagnostics: materialDiagnostics(decoded.diagnostics, layer, document.compatibility) }
      },
      render(composition, region) {
        if (!canvas) throw new Error('CLIP描画用Canvasが設定されていません')
        renderer ??= createCompositionRenderer(native, { canvas, source: 'original', missingMaterials: 'omit',
          maxWorkingBytes: 384 * 1024 * 1024, maxCacheBytes: 64 * 1024 * 1024 })
        return renderer.render(composition, { region })
      },
      dispose() { renderer?.dispose(); native.dispose(); layersById.clear() },
    }
  } catch (error) { native.dispose(); throw error }
}

/** Eager callers own their returned pixels; the compressed session is always released. */
export async function parseClipDocument(bytes: Uint8Array, SQL: SqlJsStatic, includeRaster = true,
  options: Pick<SessionOptions, 'ownership' | 'signal'> = {}): Promise<ClipDocument> {
  const session = await openClipSession(bytes, SQL, options)
  try {
    const walk = async (layers: ClipLayer[]) => {
      for (const layer of layers) {
        const decoded = await session.decode(layer.id)
        Object.assign(layer, { ...decoded.layer, children: layer.children })
        session.document.diagnostics.push(...decoded.diagnostics)
        await walk(layer.children)
      }
    }
    if (includeRaster) await walk(session.document.layers)
    return session.document
  } finally { session.dispose() }
}
