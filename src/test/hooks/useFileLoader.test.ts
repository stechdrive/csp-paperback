import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFileLoader } from '../../hooks/useFileLoader'
import { useAppStore } from '../../store'
import { readClipFile } from '../../utils/clip-io'
import { readPsdFile } from '../../utils/psd-io'
import { resetTestStore } from '../helpers/store-reset'
import type { ClipDocument } from '../../utils/clip/types'
import type { LoadableFile } from '../../platform/files'

vi.mock('../../utils/clip-io', () => ({ readClipFile: vi.fn() }))
vi.mock('../../utils/psd-io', () => ({ readPsdFile: vi.fn() }))

const clip: ClipDocument = {
  width: 2, height: 2, dpi: 144, layers: [{
    id: 'native-A', name: 'A', isFolder: true, isAnimationFolder: true, expanded: true,
    hidden: false, opacity: 1, blendMode: 'normal', clipping: false, children: [],
  }],
  timelines: [{ id: 1, bindings: { 'native-A': 7 }, diagnostics: [], data: {
    tracks: [{ name: 'A', trackNo: 7, cellNames: [], frames: [{ frameIndex: 0, cellName: null }] }],
    version: 10, header: { cut: '', scene: '' }, timeTableName: 'timeline', duration: 24, fps: 24,
  } }], defaultTimelineId: 1, diagnostics: [],
}
const file = (name: string): LoadableFile => ({ name, arrayBuffer: async () => new ArrayBuffer(0), text: async () => '{"timeTables":[{"duration":24,"timeTableHeaders":[],"fields":[]}]}' })

beforeEach(() => {
  resetTestStore()
  vi.mocked(readClipFile).mockReset().mockResolvedValue(clip)
  vi.mocked(readPsdFile).mockReset().mockImplementation(() => ({ width: 2, height: 2, children: [{ name: 'A', children: [] }] }))
})
afterEach(cleanup)

describe('CLIP input combinations', () => {
  it.each([['cut.clip', 'cut.psd'], ['cut.psd', 'cut.clip']])('pairs files independent of input order: %s %s', async (a, b) => {
    const { result } = renderHook(useFileLoader)
    await act(async () => result.current.loadFiles([file(a), file(b)]))
    expect(result.current.error).toBeNull()
    expect(useAppStore.getState().clipFileName).toBe('cut.clip')
    expect(useAppStore.getState().psdFileName).toBe('cut.psd')
    expect(readClipFile).toHaveBeenCalledWith(expect.any(ArrayBuffer), false)
  })

  it('serializes a PSD dropped while the CLIP is still decoding', async () => {
    let finish!: (doc: ClipDocument) => void
    vi.mocked(readClipFile).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const { result } = renderHook(useFileLoader)
    let first!: Promise<void>, second!: Promise<void>
    await act(async () => {
      first = result.current.loadFiles([file('cut.clip')])
      second = result.current.loadFiles([file('cut.psd')])
    })
    expect(result.current.isLoading).toBe(true)
    expect(readPsdFile).not.toHaveBeenCalled()
    await act(async () => { finish(clip); await Promise.all([first, second]) })
    expect(result.current.error).toBeNull()
    expect(useAppStore.getState().psdFileName).toBe('cut.psd')
    expect(useAppStore.getState().layerTree[0].id).toBe('clip:native-A')
  })

  it('retains the current project on CLIP decode/pair failures, then recovers on another import', async () => {
    const { result } = renderHook(useFileLoader)
    await act(async () => result.current.loadFiles([file('cut.clip')]))
    const before = useAppStore.getState().layerTree
    vi.mocked(readClipFile).mockRejectedValueOnce(new Error('broken clip'))
    await act(async () => result.current.loadFiles([file('bad.clip'), file('bad.psd')]))
    expect(result.current.error).toBe('broken clip')
    expect(useAppStore.getState().layerTree).toBe(before)
    vi.mocked(readPsdFile).mockReturnValueOnce({ width: 99, height: 99 })
    await act(async () => result.current.loadFiles([file('wrong.psd')]))
    expect(result.current.error).toContain('一致しません')
    expect(useAppStore.getState().layerTree).toBe(before)
    await act(async () => result.current.loadFiles([file('cut.psd')]))
    expect(result.current.error).toBeNull()
    expect(useAppStore.getState().clipFileName).toBe('cut.clip')
  })

  it('uses CLIP in a three-file drop and switches explicitly back to PSD+XDTS', async () => {
    const { result } = renderHook(useFileLoader)
    await act(async () => result.current.loadFiles([file('cut.clip'), file('cut.psd'), file('cut.xdts')]))
    expect(useAppStore.getState().xdtsFileName).toBeNull()
    expect(result.current.notification).toBeNull()
    const timeline = useAppStore.getState().timelineData
    await act(async () => result.current.loadFiles([file('cut.xdts')]))
    expect(result.current.error).toBeNull()
    expect(useAppStore.getState().timelineData).toBe(timeline)
    await act(async () => result.current.loadFiles([file('cut.psd'), file('cut.xdts')]))
    expect(result.current.error).toBeNull()
    expect(useAppStore.getState().clipDocument).toBeNull()
    expect(useAppStore.getState().psdFileName).toBe('cut.psd')
    expect(useAppStore.getState().xdtsFileName).toBe('cut.xdts')
  })

  it('attaches matching CLIP after PSD and rejects multiple CLIP choices', async () => {
    const { result } = renderHook(useFileLoader)
    await act(async () => result.current.loadFiles([file('cut.psd')]))
    await act(async () => result.current.loadFiles([file('cut.clip')]))
    expect(result.current.error).toBeNull()
    expect(useAppStore.getState().psdFileName).toBe('cut.psd')
    expect(readClipFile).toHaveBeenCalledWith(expect.any(ArrayBuffer), false)
    await act(async () => result.current.loadFiles([file('one.clip'), file('two.clip')]))
    expect(result.current.error).toContain('1ファイルずつ')
    expect(useAppStore.getState().clipFileName).toBe('cut.clip')
  })
})
