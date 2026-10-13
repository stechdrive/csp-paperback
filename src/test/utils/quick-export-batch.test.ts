import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Psd } from 'ag-psd'
import { useAppStore } from '../../store'
import { resetTestStore } from '../helpers/store-reset'
import { runQuickExportBatch, type QuickExportBatchProgress } from '../../utils/quick-export'
import { readClipFile } from '../../utils/clip-io'
import { readPsdFile } from '../../utils/psd-io'
import { allowTauriLaunchFilePaths, loadableFilesFromPaths } from '../../platform/files'
import { saveEntriesToDirectoryPath } from '../../utils/directory-builder'
import { buildOutputEntriesFromState } from '../../utils/export-entries'
import type { ClipDocument } from '../../utils/clip/types'

vi.mock('../../utils/clip-io', () => ({ readClipFile: vi.fn() }))
vi.mock('../../utils/psd-io', () => ({ readPsdFile: vi.fn() }))
vi.mock('../../platform/files', () => ({ allowTauriLaunchFilePaths: vi.fn(), loadableFilesFromPaths: vi.fn() }))
vi.mock('../../utils/directory-builder', () => ({ saveEntriesToDirectoryPath: vi.fn() }))
vi.mock('../../utils/export-entries', () => ({ buildOutputEntriesFromState: vi.fn() }))
vi.mock('@tauri-apps/api/path', () => ({ dirname: async (path: string) => path.slice(0, path.lastIndexOf('/')) }))

const document = (): ClipDocument => ({ width: 2, height: 2, dpi: 144, defaultTimelineId: null, timelines: [], diagnostics: [], layers: [
  { id: 'art', name: 'art', isFolder: false, isAnimationFolder: false, expanded: false, hidden: false, opacity: 1,
    blendMode: 'normal', clipping: false, children: [], pixels: { width: 2, height: 2, left: 0, top: 0, rgba: new Uint8ClampedArray(16) } },
] })
const psd = (): Psd => ({ width: 2, height: 2, children: [{ name: 'art' }] })

beforeEach(() => {
  vi.resetAllMocks()
  resetTestStore()
  vi.mocked(readClipFile).mockImplementation(async () => document())
  vi.mocked(readPsdFile).mockImplementation(() => psd())
  vi.mocked(loadableFilesFromPaths).mockImplementation(async paths => paths.map(path => ({
    name: path.split('/').at(-1)!, sourceDirectory: path.slice(0, path.lastIndexOf('/')),
    arrayBuffer: async () => new ArrayBuffer(0), text: async () => '',
  })))
  vi.mocked(buildOutputEntriesFromState).mockImplementation(() => [{ path: 'art.png', flatName: 'art.png', sourceLayerId: 'art', canvas: documentCanvas() }])
  vi.mocked(saveEntriesToDirectoryPath).mockImplementation(async (_entries, _config, name, parent, _dx, _dy, progress) => {
    progress?.(1, 1)
    return `${parent}/${name.replace(/\.[^.]+$/, '')}`
  })
})
const documentCanvas = () => globalThis.document.createElement('canvas')

describe('batch export with the real loader and project store', () => {
  it('exports mixed paired/unpaired projects serially and releases their state', async () => {
    let finish!: () => void
    const gate = new Promise<void>(resolve => { finish = resolve })
    vi.mocked(saveEntriesToDirectoryPath).mockImplementationOnce(async () => { await gate; return 'C:/cuts/a' })
    const progress: QuickExportBatchProgress[] = []
    const pending = runQuickExportBatch(['C:/cuts/a.clip', 'C:/cuts/a.psd', 'C:/cuts/b.clip'], p => progress.push(p))
    await vi.waitFor(() => expect(saveEntriesToDirectoryPath).toHaveBeenCalledTimes(1))
    expect(readClipFile).toHaveBeenCalledTimes(1)
    finish()
    const result = await pending
    expect(result).toMatchObject({ successCount: 2, failureCount: 0, entryCount: 2 })
    expect(result.jobs.map(job => job.sourcePath)).toEqual(['C:/cuts/a.clip', 'C:/cuts/b.clip'])
    expect(vi.mocked(readClipFile).mock.calls.map(call => call[1])).toEqual([false, true])
    expect(allowTauriLaunchFilePaths).toHaveBeenCalledOnce()
    expect(progress.at(-1)?.progress).toBe(1)
    expect(progress.every((p, i) => i === 0 || p.progress >= progress[i - 1].progress)).toBe(true)
    expect(progress.at(-1)?.results).toHaveLength(2)
    expect(useAppStore.getState()).toMatchObject({ rawPsd: null, clipDocument: null, layerTree: [] })
  })

  it('cannot reuse a previous PSD for a standalone CLIP with the same name elsewhere', async () => {
    await runQuickExportBatch(['C:/one/cut.clip', 'C:/one/cut.psd', 'C:/two/cut.clip'], vi.fn())
    expect(vi.mocked(readClipFile).mock.calls.map(call => call[1])).toEqual([false, true])
    expect(vi.mocked(buildOutputEntriesFromState).mock.calls.map(([state]) => state.psdFileName)).toEqual(['cut.psd', null])
  })

  it('rejects structural mismatches before saving and continues after corrupt input and orphan files', async () => {
    vi.mocked(readPsdFile).mockReturnValueOnce({ width: 2, height: 2, children: [{ name: 'wrong' }] })
    vi.mocked(readClipFile).mockResolvedValueOnce(document()).mockRejectedValueOnce(new Error('broken CLIP'))
    const result = await runQuickExportBatch(['C:/cuts/wrong.clip', 'C:/cuts/wrong.psd', 'C:/cuts/broken.clip', 'C:/cuts/orphan.psd', 'C:/cuts/ok.clip'], vi.fn())
    expect(result).toMatchObject({ successCount: 1, failureCount: 3, entryCount: 1 })
    expect(result.jobs[0]).toMatchObject({ status: 'error', error: expect.stringContaining('構造・順序が一致しません') })
    expect(result.jobs[1]).toMatchObject({ status: 'error', error: 'broken CLIP' })
    expect(result.jobs[2]).toMatchObject({ status: 'error', error: expect.stringContaining('同じフォルダ・同名のCLIP') })
    expect(saveEntriesToDirectoryPath).toHaveBeenCalledTimes(1)
    expect(vi.mocked(saveEntriesToDirectoryPath).mock.calls[0][2]).toBe('ok.clip')
  })

  it('restores saved preferences after each job, including shared-cut auto detection', async () => {
    const multiple = document()
    multiple.timelines = [1, 2].map(id => ({ id, bindings: {}, diagnostics: [], data: { version: 10, header: { cut: '', scene: '' }, timeTableName: '', duration: 1, fps: 24, tracks: [] } }))
    const original = structuredClone(useAppStore.getState().projectSettings)
    const output = { ...useAppStore.getState().savedOutputConfig, format: 'png' as const }
    useAppStore.setState({ savedOutputConfig: output })
    vi.mocked(readClipFile).mockResolvedValueOnce(multiple)
    await runQuickExportBatch(['C:/cuts/multi.clip', 'C:/cuts/single.clip'], vi.fn())
    expect(vi.mocked(buildOutputEntriesFromState).mock.calls.map(([s]) => s.projectSettings.sharedCutMode)).toEqual([true, false])
    expect(vi.mocked(saveEntriesToDirectoryPath).mock.calls.every(([, config]) => config.format === 'png')).toBe(true)
    expect(useAppStore.getState().projectSettings).toEqual(original)
    expect(useAppStore.getState().savedOutputConfig).toEqual(output)
    expect(JSON.parse(localStorage.getItem('csp-paperback:settings')!).state.projectSettings).toEqual(original)
  })

  it('records diagnostics per project, retaining timeline warnings but clearing PSD-replaced raster warnings', async () => {
    const doc = document()
    doc.diagnostics = [{ scope: 'raster', message: '描画は近似です' }, { scope: 'timeline', message: '未対応の時間伸縮' }]
    vi.mocked(readClipFile).mockImplementation(async () => structuredClone(doc))
    const result = await runQuickExportBatch(['C:/cuts/a.clip', 'C:/cuts/b.clip', 'C:/cuts/b.psd'], vi.fn())
    expect(result.jobs[0].warnings).toEqual(['描画は近似です', '未対応の時間伸縮'])
    expect(result.jobs[1].warnings).toEqual(['未対応の時間伸縮'])
  })

  it('continues after a save failure and reports empty exports without saving stale images', async () => {
    vi.mocked(saveEntriesToDirectoryPath).mockRejectedValueOnce(new Error('disk full'))
    vi.mocked(buildOutputEntriesFromState).mockReturnValueOnce([{ path: 'x.png', flatName: 'x.png', sourceLayerId: 'art', canvas: documentCanvas() }]).mockReturnValueOnce([])
    const result = await runQuickExportBatch(['C:/a.clip', 'C:/empty.clip', 'C:/ok.clip'], vi.fn())
    expect(result).toMatchObject({ successCount: 1, failureCount: 2 })
    expect(result.jobs[0]).toMatchObject({ status: 'error', error: 'disk full' })
    expect(result.jobs[1]).toMatchObject({ status: 'error', error: '出力対象がありません' })
    expect(saveEntriesToDirectoryPath).toHaveBeenCalledTimes(2)
  })

  it('reports an entirely invalid batch without asking for filesystem access', async () => {
    const result = await runQuickExportBatch(['C:/a.psd', 'C:/b.psd'], vi.fn())
    expect(result).toMatchObject({ successCount: 0, failureCount: 2 })
    expect(allowTauriLaunchFilePaths).not.toHaveBeenCalled()
    await expect(runQuickExportBatch([], vi.fn())).rejects.toThrow('見つかりません')
  })
})
