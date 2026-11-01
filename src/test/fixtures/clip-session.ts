import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createDocument, type EditOperation } from 'celcodec'
import type { SqlJsStatic } from 'sql.js'

const require = createRequire(import.meta.url)
export const sessionIds = {
  folder: '11111111111111111111111111111111',
  cel: '22222222222222222222222222222222',
  timeline: '33333333333333333333333333333333',
}

/** Synthetic artwork authored through the installed package's public API. */
export async function sessionFixture(SQL: SqlJsStatic, extra: EditOperation[] = [], includePaper = true): Promise<Uint8Array> {
  const seed = new Uint8Array(readFileSync(require.resolve('celcodec/blank.clip')))
  const session = await createDocument(SQL, seed, {
    width: 64, height: 64, dpi: 72, basisWidth: 32, basisHeight: 32, offsetX: 0, offsetY: 0,
  })
  try {
    const plan = await session.planEdits([
      ...(!includePaper ? session.document.layers.filter(l => l.kind === 'paper')
        .map(l => ({ type: 'removeLayer' as const, layerId: l.id })) : []),
      { type: 'addLayer', id: sessionIds.folder, parentId: null, kind: 'animation', name: 'A' },
      { type: 'addLayer', id: sessionIds.cel, parentId: sessionIds.folder, kind: 'raster', name: '1',
        pixels: { width: 1, height: 1, data: new Uint8Array([255, 0, 0, 255]), channels: 4 }, left: 3, top: 5 },
      { type: 'setLayerAttributes', layerId: sessionIds.folder, attributes: { opacity: 0.5 } },
      { type: 'createTimeline', id: sessionIds.timeline, name: 'fractional', fps: 24, startFrame: 1, endFrame: 23 },
      { type: 'setCelKeys', timelineId: sessionIds.timeline, layerId: sessionIds.folder,
        keys: [{ frame: -1, value: '1' }, { frame: 3, value: null }, { frame: 5, value: '1' }] },
      ...extra,
    ], { seed })
    if (!plan.allowed) throw new Error(JSON.stringify(plan.diagnostics))
    return (await session.save(plan)).bytes
  } finally { session.dispose() }
}
