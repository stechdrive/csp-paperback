import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { savePsdFile } from '../../platform/psd-save'

const mocks = vi.hoisted(() => ({ native: false, save: vi.fn(), invoke: vi.fn(), download: vi.fn() }))
vi.mock('../../platform/runtime', () => ({ isDesktopRuntime: () => mocks.native, createAbortError: () => new DOMException('cancel', 'AbortError') }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: mocks.save }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('../../utils/zip-builder', () => ({ downloadBlob: mocks.download }))

beforeEach(() => { vi.resetAllMocks(); mocks.native = false })
afterEach(() => { delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker })
const setPicker = (picker: unknown) => Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: picker })

describe('PSD save transaction', () => {
  it('opens the browser picker before generating pixels and commits only a complete file', async () => {
    const order: string[] = [], bytes = new ArrayBuffer(4)
    const write = vi.fn<(data: Blob) => Promise<void>>(async () => { order.push('write') }), close = vi.fn(async () => { order.push('close') })
    const picker = vi.fn(async () => { order.push('picker'); return { createWritable: async () => ({ write, close }) } })
    setPicker(picker)
    await savePsdFile('原図.psd', async () => { order.push('encode'); return bytes })
    expect(order).toEqual(['picker', 'encode', 'write', 'close'])
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: '原図.psd' }))
    expect(write.mock.calls[0][0]).toBeInstanceOf(Blob)
  })

  it('does not render or fall back to downloading when the picker is cancelled', async () => {
    setPicker(vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError')))
    const create = vi.fn()
    await expect(savePsdFile('原図.psd', create)).rejects.toMatchObject({ name: 'AbortError' })
    expect(create).not.toHaveBeenCalled(); expect(mocks.download).not.toHaveBeenCalled()
  })

  it('does not open a write stream if encoding fails, and aborts a failed write', async () => {
    const writable = { write: vi.fn().mockRejectedValue(new Error('disk')), close: vi.fn(), abort: vi.fn().mockResolvedValue(undefined) }
    const createWritable = vi.fn().mockResolvedValue(writable)
    setPicker(vi.fn().mockResolvedValue({ createWritable }))
    await expect(savePsdFile('原図.psd', async () => { throw new Error('encode') })).rejects.toThrow('encode')
    expect(createWritable).not.toHaveBeenCalled()
    await expect(savePsdFile('原図.psd', async () => new ArrayBuffer(4))).rejects.toThrow('disk')
    expect(writable.abort).toHaveBeenCalledOnce(); expect(writable.close).not.toHaveBeenCalled()
  })

  it('downloads a PSD when the browser has no save picker', async () => {
    setPicker(undefined)
    await savePsdFile('原図.psd', async () => new ArrayBuffer(4))
    expect(mocks.download).toHaveBeenCalledWith(expect.objectContaining({ type: 'image/vnd.adobe.photoshop' }), '原図.psd')
  })

  it('uses the native atomic writer only for the selected PSD path', async () => {
    mocks.native = true; mocks.save.mockResolvedValue('C:/art/原図.psd')
    await savePsdFile('原図.psd', async () => new Uint8Array([56, 66, 80, 83]).buffer)
    expect(mocks.invoke).toHaveBeenCalledWith('write_export_file', new Uint8Array([56, 66, 80, 83]), {
      headers: { path: encodeURIComponent('C:/art/原図.psd'), overwrite: 'true' },
    })
  })

  it('keeps native cancellation and invalid destinations free of writes', async () => {
    mocks.native = true; mocks.save.mockResolvedValueOnce(null).mockResolvedValueOnce('C:/art/原図.clip')
    const create = vi.fn()
    await expect(savePsdFile('原図.psd', create)).rejects.toMatchObject({ name: 'AbortError' })
    await expect(savePsdFile('原図.psd', create)).rejects.toThrow('.psd')
    expect(create).not.toHaveBeenCalled(); expect(mocks.invoke).not.toHaveBeenCalled()
  })
})
