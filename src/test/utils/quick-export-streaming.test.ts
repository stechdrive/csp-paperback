import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Blob as NodeBlob } from 'node:buffer'
import { useAppStore } from '../../store'
import { resetTestStore } from '../helpers/store-reset'
import { makeAnimationFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { buildLayerTree } from '../../engine/tree-builder'
import * as exportEntries from '../../utils/export-entries'
import { runQuickExportBatch } from '../../utils/quick-export'
import { writeFile } from '@tauri-apps/plugin-fs'
import { loadProjectFiles } from '../../utils/project-loader'
import { canvasToBlob } from '../../utils/image-export'

vi.mock('../../platform/runtime', () => ({ isDesktopRuntime: () => true }))
vi.mock('../../platform/files', () => ({ allowTauriLaunchFilePaths: vi.fn(), loadableFilesFromPaths: vi.fn(async () => []) }))
vi.mock('../../utils/project-loader', () => ({ loadProjectFiles: vi.fn() }))
vi.mock('@tauri-apps/api/path', () => ({ dirname: async () => 'C:/test', join: async (...parts: string[]) => parts.join('/') }))
vi.mock('@tauri-apps/plugin-fs', () => ({ exists: async () => false, mkdir: vi.fn(), writeFile: vi.fn(async () => {}) }))
vi.mock('../../utils/image-export', async importOriginal => ({
  ...await importOriginal<typeof import('../../utils/image-export')>(),
  canvasToBlob: vi.fn(async () => new NodeBlob(['encoded'])),
}))

beforeEach(() => {
  vi.clearAllMocks(); resetTestStore()
  vi.mocked(loadProjectFiles).mockImplementation(async () => {
    const tree = buildLayerTree(makePsd({ children: [makeAnimationFolder('A',
      Array.from({ length: 40 }, (_, i) => makeLayer({ name: String(i + 1) })))], width: 1920, height: 1080 }))
    tree[0].isAnimationFolder = true; tree[0].animationFolder = { detectedBy: 'manual', trackName: 'A' }
    useAppStore.setState({ layerTree: tree, docWidth: 1920, docHeight: 1080, psdFileName: 'cut.psd' })
    return { warnings: [] } as never
  })
})
afterEach(() => { vi.restoreAllMocks(); resetTestStore() })

describe('quick export uses the real lazy plan and directory writer', () => {
  it('waits for each native file write, releases pixels, and reports each phase', async () => {
    const actualPlan = exportEntries.planExportEntriesFromState, canvases: HTMLCanvasElement[] = []
    vi.spyOn(exportEntries, 'planExportEntriesFromState').mockImplementation((...args) => actualPlan(...args).map(entry => {
      if (!('createCanvas' in entry)) throw new Error('eager export entry')
      return { ...entry, createCanvas: async () => { const canvas = await entry.createCanvas(); canvases.push(canvas); return canvas } }
    }))
    let finish!: () => void
    const gate = new Promise<void>(resolve => { finish = resolve })
    vi.mocked(writeFile).mockImplementationOnce(async () => { await gate })
    const progress: string[] = []
    const pending = runQuickExportBatch(['C:/test/cut.psd', 'C:/test/cut.xdts'], p => progress.push(p.message))
    await vi.waitFor(() => expect(writeFile).toHaveBeenCalledTimes(1))
    expect(canvases).toHaveLength(1)
    expect(canvases[0].width * canvases[0].height).toBe(1)
    expect(canvasToBlob).toHaveBeenCalledTimes(1)
    finish()
    expect(await pending).toMatchObject({ successCount: 1, failureCount: 0, entryCount: 40 })
    expect(writeFile).toHaveBeenCalledTimes(40)
    expect(new Set(vi.mocked(writeFile).mock.calls.map(call => call[0])).size).toBe(40)
    expect(canvases.every(c => c.width * c.height === 1)).toBe(true)
    expect(progress.some(m => m.includes('合成中 1/40'))).toBe(true)
    expect(progress.some(m => m.includes('画像変換中 1/40'))).toBe(true)
    expect(progress.some(m => m.includes('保存中 40/40'))).toBe(true)
    expect(useAppStore.getState().layerTree).toEqual([])
  })

  it('stops rendering an unsuccessful document and continues with the next document', async () => {
    const actualPlan = exportEntries.planExportEntriesFromState, released = vi.fn()
    vi.spyOn(exportEntries, 'planExportEntriesFromState').mockImplementation((...args) => actualPlan(...args).map(entry => {
      if (!('createCanvas' in entry)) throw new Error('eager export entry')
      return { ...entry, releaseRenderCache: () => { entry.releaseRenderCache?.(); released() } }
    }))
    vi.mocked(writeFile).mockRejectedValueOnce(new Error('disk full'))
    const result = await runQuickExportBatch(['C:/test/a.clip', 'C:/test/b.clip'], vi.fn())
    expect(result).toMatchObject({ successCount: 1, failureCount: 1, entryCount: 40 })
    expect(result.jobs[0]).toMatchObject({ status: 'error', error: 'disk full' })
    expect(canvasToBlob).toHaveBeenCalledTimes(41)
    expect(released).toHaveBeenCalledTimes(80)
    expect(useAppStore.getState().layerTree).toEqual([])
  })
})
