import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveZipStream } from '../../utils/zip-builder'

vi.mock('../../platform/runtime', async importOriginal => ({
  ...await importOriginal<typeof import('../../platform/runtime')>(), isDesktopRuntime: () => true,
}))
afterEach(() => vi.unstubAllGlobals())

// Exercise the installed Tauri JS library, substituting only its native IPC.
// An open without truncate behaves like a real existing file: its tail remains.
function nativeFile(fail = false) {
  let bytes = new Uint8Array(100).fill(99), position = 0, closed = false
  vi.stubGlobal('__TAURI_INTERNALS__', { invoke: async (command: string, args: { options?: { truncate?: boolean }; data?: Uint8Array }) => {
    if (command === 'plugin:dialog|save') return '/chosen/output.zip'
    if (command === 'plugin:fs|open') {
      if (args.options?.truncate) bytes = new Uint8Array()
      position = 0; closed = false
      return 1
    }
    if (command === 'plugin:fs|write') {
      if (fail) throw new Error('disk full')
      const count = Math.min(2, args.data!.length) // short writes must not lose data
      const next = new Uint8Array(Math.max(bytes.length, position + count))
      next.set(bytes); next.set(args.data!.subarray(0, count), position)
      bytes = next; position += count
      return count
    }
    if (command === 'plugin:resources|close') { closed = true; return }
    throw new Error(`Unexpected IPC: ${command}`)
  } })
  return { bytes: () => [...bytes], closed: () => closed }
}

describe('native ZIP stream saving', () => {
  it('replaces a longer existing file completely and handles partial writes', async () => {
    const file = nativeFile()
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3, 4])); controller.enqueue(new Uint8Array([5, 6, 7])); controller.close()
    } })
    await saveZipStream(stream, 'output.zip')
    expect(file.bytes()).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(file.closed()).toBe(true)
    expect(stream.locked).toBe(false)
  })

  it('cancels the producer and closes the native handle on a write failure', async () => {
    const file = nativeFile(true), cancel = vi.fn()
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array([1, 2, 3])) }, cancel })
    await expect(saveZipStream(stream, 'output.zip')).rejects.toThrow('disk full')
    expect(cancel).toHaveBeenCalledOnce()
    expect(file.closed()).toBe(true)
    expect(stream.locked).toBe(false)
  })
})
