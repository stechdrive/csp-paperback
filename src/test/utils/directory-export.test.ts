import { Blob as NodeBlob } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import { saveToDirectory } from '../../utils/directory-builder'
import { DirectoryExportSession, type ExportConflictAnswer, type ConfirmExportConflict } from '../../utils/directory-export-session'
import { DestinationExistsError, type DirectoryEntry, type ExportDirectory } from '../../platform/export-directory'
import { DEFAULT_OUTPUT_CONFIG } from '../../types'
import type { DirectoryExportMode, ExportEntry } from '../../types/output'
import { prepareOutputEntries } from '../../utils/output-builder'

vi.mock('../../utils/image-export', async original => ({ ...await original<typeof import('../../utils/image-export')>(),
  canvasToBlob: async (canvas: HTMLCanvasElement) => new NodeBlob([canvas.dataset.content ?? 'image']),
}))

class Disk implements ExportDirectory {
  id: string
  displayPath: string
  files = new Map<string, string>()
  directories = new Map<string, Disk>()
  writes: string[] = []
  constructor(path = 'exports') { this.id = this.displayPath = path }
  async list(): Promise<DirectoryEntry[]> {
    return [...[...this.files.keys()].map(name => ({ name, kind: 'file' as const })),
      ...[...this.directories.keys()].map(name => ({ name, kind: 'directory' as const }))]
  }
  async directory(name: string, create: boolean): Promise<Disk> {
    if (this.files.has(name)) throw new Error('File in place of directory')
    if (create) {
      if (this.directories.has(name)) throw new Error('Directory already exists')
      this.directories.set(name, new Disk(`${this.id}/${name}`))
    }
    const dir = this.directories.get(name)
    if (!dir) throw new Error('Directory missing')
    return dir
  }
  async write(name: string, input: Blob, overwrite: boolean): Promise<void> {
    if (this.directories.has(name)) throw new Error('Directory in place of file')
    if (!overwrite && this.files.has(name)) throw new DestinationExistsError()
    this.files.set(name, await input.text())
    this.writes.push(name)
  }
}
const config = { ...DEFAULT_OUTPUT_CONFIG, format: 'png' as const, structure: 'hierarchy' as const }
function entry(flatName: string, path = `A/${flatName}`, content = flatName): Extract<ExportEntry, { createCanvas: unknown }> {
  return { path, flatName, sourceLayerId: content, createCanvas: vi.fn(() => {
    const canvas = document.createElement('canvas'); canvas.dataset.content = content; return canvas
  }) }
}
function save(disk: Disk, entries: ExportEntry[], mode: DirectoryExportMode, session = new DirectoryExportSession()) {
  return saveToDirectory(disk, entries, config, 'cut.clip', 144, 144, undefined, { mode, session })
}

describe('directory export collision and overwrite contract', () => {
  it('waits once before any write, then replaces matching images and preserves unrelated files', async () => {
    const disk = new Disk(); disk.files.set('a.png', 'old'); disk.files.set('unrelated.txt', 'keep')
    let answer!: (answer: ExportConflictAnswer) => void
    const confirm = vi.fn(() => new Promise<ExportConflictAnswer>(resolve => { answer = resolve }))
    const entries = [entry('a.png'), entry('b.png')]
    const pending = save(disk, entries, 'direct-flat', new DirectoryExportSession(confirm))
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledOnce())
    expect(confirm).toHaveBeenCalledWith({ directory: 'exports', mode: 'direct-flat', overwriteCount: 1, newCount: 1, allowApplyToRemaining: false })
    expect(disk.writes).toEqual([])
    expect(entries[0].createCanvas).not.toHaveBeenCalled()
    answer({ action: 'overwrite' }); await pending
    expect([...disk.files]).toEqual([['a.png', 'a.png'], ['unrelated.txt', 'keep'], ['b.png', 'b.png']])
    expect(disk.directories.size).toBe(0)
  })

  it.each(['direct-flat', 'subfolder'] as const)('%s: cancel creates no files or directories and does not render', async mode => {
    const disk = new Disk(), root = mode === 'direct-flat' ? disk : await disk.directory('cut', true)
    root.files.set('a.png', 'old')
    const image = entry('a.png', 'a.png')
    await expect(save(disk, [image, entry('b.png', 'new/b.png')], mode, new DirectoryExportSession(async () => ({ action: 'cancel' }))))
      .rejects.toMatchObject({ name: 'AbortError' })
    expect(root.files.get('a.png')).toBe('old'); expect(root.writes).toEqual([]); expect(root.directories.size).toBe(0)
    expect('createCanvas' in image && image.createCanvas).not.toHaveBeenCalled()
  })

  it('reuses an existing output folder for overwrite and keeps the configured hierarchy', async () => {
    const disk = new Disk(), root = await disk.directory('cut', true), a = await root.directory('A', true)
    a.files.set('1.png', 'old'); root.files.set('notes.txt', 'keep')
    const confirm = vi.fn(async () => ({ action: 'overwrite' as const }))
    expect(await save(disk, [entry('A_1.png', 'A/1.png')], 'subfolder', new DirectoryExportSession(confirm))).toBe('exports/cut')
    expect(a.files.get('1.png')).toBe('A_1.png'); expect(root.files.get('notes.txt')).toBe('keep')
    expect(disk.directories.size).toBe(1)
  })

  it('keeps the correct parent and overwrite permission when an unavailable canvas is skipped', async () => {
    const disk = new Disk(), root = await disk.directory('cut', true), target = await root.directory('B', true)
    target.files.set('b.png', 'old')
    const absent = { path: 'A/a.png', flatName: 'a.png', canvas: document.createElement('canvas'), sourceLayerId: 'absent' }
    await save(new Disk(), [absent], 'direct-flat')
    expect(absent.canvas).toBeNull()
    await save(disk, [absent, entry('b.png', 'B/b.png')], 'subfolder', new DirectoryExportSession(async () => ({ action: 'overwrite' })))
    expect(target.files.get('b.png')).toBe('b.png')
    expect(root.directories.has('A')).toBe(false)
    expect(root.files.size).toBe(0)
  })

  it('rename creates a whole new root, skipping both files and folders with that name', async () => {
    const disk = new Disk(), old = await disk.directory('cut', true)
    old.files.set('a.png', 'old'); disk.files.set('cut_2', 'keep'); await disk.directory('cut_3', true)
    expect(await save(disk, [entry('a.png', 'a.png'), entry('b.png', 'B/b.png')], 'subfolder')).toBe('exports/cut_4')
    expect(old.files.get('a.png')).toBe('old')
    expect(disk.directories.get('cut_4')!.files.get('a.png')).toBe('a.png')
    expect(disk.directories.get('cut_4')!.directories.get('B')!.files.get('b.png')).toBe('b.png')
  })

  it('direct rename skips existing names, directories and names already used by this export', async () => {
    const disk = new Disk(); disk.files.set('a.png', 'old'); disk.files.set('a_2.png', 'old2'); await disk.directory('a_3.png', true)
    await save(disk, [entry('a.png'), entry('a.png')], 'direct-flat')
    expect(disk.files.get('a.png')).toBe('old'); expect(disk.files.get('a_2.png')).toBe('old2')
    expect(disk.writes).toEqual(['a_4.png', 'a_2_2.png'])
  })

  it('sanitizes flat filenames as single segments, reserved names, controls and post-sanitize collisions', async () => {
    const disk = new Disk()
    await save(disk, ['../撮影/指示.png', 'COM¹.png', 'LPT².png', 'A?.png', 'A*.png', 'a\u0000.png', ' a .png'].map(name => entry(name)), 'direct-flat')
    expect(disk.directories.size).toBe(0)
    expect(disk.writes).toEqual(['_撮影_指示.png', '_COM¹.png', '_LPT².png', 'A_.png', 'A__2.png', 'a.png', 'a .png'])
  })

  it('matches existing case and Unicode-equivalent spelling without creating duplicates', async () => {
    const disk = new Disk(); disk.files.set('A.PNG', 'old'); disk.files.set('か\u3099.png', 'old kana')
    await save(disk, [entry('a.png'), entry('が.png')], 'direct-flat', new DirectoryExportSession(async () => ({ action: 'overwrite' })))
    expect(disk.writes).toEqual(['A.PNG', 'か\u3099.png']); expect(disk.files.size).toBe(2)
  })

  it('does not guess an overwrite target when two existing names normalize to the same key', async () => {
    const disk = new Disk(); disk.files.set('a.png', 'one'); disk.files.set('A.PNG', 'two')
    const confirm = vi.fn(async () => ({ action: 'overwrite' as const }))
    await save(disk, [entry('a.png')], 'direct-flat', new DirectoryExportSession(confirm))
    expect(confirm).not.toHaveBeenCalled(); expect(disk.writes).toEqual(['a_2.png'])
    expect(disk.files.get('a.png')).toBe('one'); expect(disk.files.get('A.PNG')).toBe('two')
  })

  it('keeps suffixes and extensions within the byte budget for long Japanese names', async () => {
    const disk = new Disk(), name = 'あ'.repeat(100) + '.png'
    await save(disk, [entry(name), entry(name)], 'direct-flat')
    await save(disk, [entry(name)], 'direct-flat')
    expect(new Set(disk.writes).size).toBe(3)
    expect(disk.writes.every(name => new TextEncoder().encode(name).length <= 255 && name.endsWith('.png'))).toBe(true)
  })

  it('protects a same-named file and bounds the suffixed output folder name', async () => {
    const disk = new Disk(), base = 'あ'.repeat(85); disk.files.set(base, 'keep')
    await saveToDirectory(disk, [entry('a.png', 'a.png')], config, `${base}.clip`)
    const name = [...disk.directories.keys()][0]
    expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(255); expect(name.endsWith('_2')).toBe(true)
    expect(disk.files.get(base)).toBe('keep')
  })

  it('protects file/directory conflicts in both orders inside a hierarchical export', async () => {
    for (const paths of [['A', 'A/b.png'], ['A/b.png', 'A']]) {
      const disk = new Disk()
      // The .png extension makes the first file conflict with the second path's parent.
      await save(disk, paths.map(path => entry(path, path.replace('A/', 'A.png/'))), 'subfolder')
      const root = disk.directories.get('cut')!
      expect(root.files.size).toBe(1); expect(root.directories.size).toBe(1)
      expect([...root.directories.values()][0].files.size).toBe(1)
    }
  })

  it('retains complete-plan collision names for a selected subset, even when prepared in hierarchy mode', async () => {
    const disk = new Disk(), all = [entry('same.png', 'A/same.png'), entry('same.png', 'B/same.png')]
    const prepared = prepareOutputEntries(all, config)
    await save(disk, [{ ...all[1], prepared: prepared[1] }], 'direct-flat')
    expect(disk.writes).toEqual(['same_2.png'])
  })

  it('never overwrites an earlier cut in the same batch, including on a repeated batch', async () => {
    const disk = new Disk(); disk.files.set('a.png', 'old first'); disk.files.set('a_2.png', 'old second')
    const confirm = vi.fn<ConfirmExportConflict>(async () => ({ action: 'overwrite' as const, applyToRemaining: true }))
    const session = new DirectoryExportSession(confirm, true)
    await save(disk, [entry('a.png', undefined, 'first')], 'direct-flat', session)
    await save(disk, [entry('a.png', undefined, 'second')], 'direct-flat', session)
    expect(disk.files.get('a.png')).toBe('first'); expect(disk.files.get('a_2.png')).toBe('second')
    expect(confirm).toHaveBeenCalledOnce(); expect(confirm.mock.calls[0][0]).toMatchObject({ allowApplyToRemaining: true })
    const next = vi.fn(async () => ({ action: 'cancel' as const }))
    await expect(save(disk, [entry('a.png')], 'direct-flat', new DirectoryExportSession(next))).rejects.toMatchObject({ name: 'AbortError' })
    expect(next).toHaveBeenCalledOnce()
  })

  it('chooses separate roots for two same-named cuts in one batch', async () => {
    const disk = new Disk(), session = new DirectoryExportSession(async () => ({ action: 'overwrite', applyToRemaining: true }), true)
    await save(disk, [entry('a.png', 'a.png', 'first')], 'subfolder', session)
    await save(disk, [entry('a.png', 'a.png', 'second')], 'subfolder', session)
    expect(disk.directories.get('cut')!.files.get('a.png')).toBe('first')
    expect(disk.directories.get('cut_2')!.files.get('a.png')).toBe('second')
  })

  it('reallocates an unexpectedly occupied destination without overwriting or stealing another planned name', async () => {
    const disk = new Disk(), write = disk.write.bind(disk)
    vi.spyOn(disk, 'write').mockImplementationOnce(async name => { disk.files.set(name, 'external'); throw new DestinationExistsError() }).mockImplementation(write)
    await save(disk, [entry('a.png'), entry('a_2.png')], 'direct-flat')
    expect(disk.files.get('a.png')).toBe('external'); expect(disk.writes).toEqual(['a_3.png', 'a_2.png'])
  })

  it('does not treat a disk failure as a collision or continue rendering the document', async () => {
    const disk = new Disk(); disk.files.set('a.png', 'old')
    vi.spyOn(disk, 'write').mockRejectedValue(new Error('disk full'))
    const next = entry('b.png'), release = vi.fn()
    await expect(save(disk, [{ ...entry('a.png'), releaseRenderCache: release }, next], 'direct-flat', new DirectoryExportSession(async () => ({ action: 'overwrite' })))).rejects.toThrow('disk full')
    expect(disk.write).toHaveBeenCalledOnce(); expect(disk.files.get('a.png')).toBe('old')
    expect('createCanvas' in next && next.createCanvas).not.toHaveBeenCalled(); expect(release).toHaveBeenCalled()
  })
})
