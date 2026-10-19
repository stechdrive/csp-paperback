import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../store'
import { loadProjectFiles } from '../../utils/project-loader'
import { resetTestStore } from '../helpers/store-reset'

afterEach(resetTestStore)

describe('input preflight preserves the existing project', () => {
  it('rejects a large browser File before reading it', async () => {
    const arrayBuffer = vi.fn(), text = vi.fn()
    await expect(loadProjectFiles([{ name: 'huge.psd', size: 1024 ** 3 + 1, arrayBuffer, text }])).rejects.toThrow('1 GiB')
    expect(arrayBuffer).not.toHaveBeenCalled()
  })

  it('does not reset a project on invalid PSD dimensions or settings', async () => {
    useAppStore.setState({ psdFileName: 'current.psd', rawPsd: { width: 1, height: 1 }, docWidth: 1 })
    const state = useAppStore.getState(), bytes = new ArrayBuffer(26), header = new DataView(bytes)
    header.setUint32(14, 30000); header.setUint32(18, 30000)
    const file = { name: 'bad.psd', arrayBuffer: async () => bytes, text: async () => '' }
    await expect(loadProjectFiles([file])).rejects.toThrow('64メガピクセル')
    expect(useAppStore.getState()).toBe(state)
    await expect(loadProjectFiles([{ ...file, name: 'bad.json', text: async () => '{"autoMarkFolderNames":[42]}' }])).rejects.toThrow('autoMarkFolderNames')
    expect(useAppStore.getState()).toBe(state)
  })
})
