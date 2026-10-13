import { describe, expect, it } from 'vitest'
import { resolveQuickExportJobs } from '../../utils/quick-export-plan'

describe('quick export batch input pairing', () => {
  it('pairs shuffled files by directory and stem, with standalone CLIPs mixed in', () => {
    expect(resolveQuickExportJobs(['C:/cut/b.psd', 'C:/cut/a.clip', 'C:/cut/b.clip', 'C:/cut/c.clip'])).toEqual([
      { sourcePath: 'C:/cut/b.clip', pair: { clipPath: 'C:/cut/b.clip', psdPath: 'C:/cut/b.psd' } },
      { sourcePath: 'C:/cut/a.clip', pair: { clipPath: 'C:/cut/a.clip' } },
      { sourcePath: 'C:/cut/c.clip', pair: { clipPath: 'C:/cut/c.clip' } },
    ])
  })
  it('never pairs identical stems in different directories', () => {
    const jobs = resolveQuickExportJobs(['C:/one/cut.clip', 'C:/two/cut.clip', 'C:/two/cut.psd', 'C:/three/cut.psd'])
    expect(jobs[0].pair).toEqual({ clipPath: 'C:/one/cut.clip' })
    expect(jobs[1].pair).toEqual({ clipPath: 'C:/two/cut.clip', psdPath: 'C:/two/cut.psd' })
    expect(jobs[2].error).toContain('同じフォルダ・同名のCLIP')
  })
  it('handles Japanese names, spaces, multiple dots, Windows separators and casing', () => {
    const jobs = resolveQuickExportJobs(['C:\\カット 01\\cut.v2.CLIP', 'c:/カット 01/CUT.v2.psd', 'C:/カット 02/solo.clip'])
    expect(jobs[0].pair).toEqual({ clipPath: 'C:\\カット 01\\cut.v2.CLIP', psdPath: 'c:/カット 01/CUT.v2.psd' })
    expect(jobs).toHaveLength(2)
  })
  it('preserves POSIX filename case so distinct files cannot be accidentally paired', () => {
    const jobs = resolveQuickExportJobs(['/cuts/A.clip', '/cuts/a.clip', '/cuts/a.psd'])
    expect(jobs[0].pair).toEqual({ clipPath: '/cuts/A.clip' })
    expect(jobs[1].pair).toEqual({ clipPath: '/cuts/a.clip', psdPath: '/cuts/a.psd' })
  })
  it('reports ambiguous Windows inputs without choosing the first PSD', () => {
    const jobs = resolveQuickExportJobs(['C:/cut/a.clip', 'C:/cut/a.psd', 'C:/cut/A.PSD', 'C:/cut/b.clip'])
    expect(jobs[0].pair).toBeUndefined()
    expect(jobs[0].error).toContain('重複')
    expect(jobs[1].pair?.clipPath).toBe('C:/cut/b.clip')
  })
  it('does not export identical repeated paths twice, and ignores unrelated arguments', () => {
    expect(resolveQuickExportJobs(['--flag', 'C:/a.clip', 'C:/a.clip'])).toEqual([
      { sourcePath: 'C:/a.clip', pair: { clipPath: 'C:/a.clip' } },
    ])
    expect(resolveQuickExportJobs(['--flag', 'note.txt'])).toEqual([])
  })
  it('retains the explicitly selected single-project input contracts', () => {
    expect(resolveQuickExportJobs(['a.clip', 'renamed.psd', 'legacy.xdts'])[0].pair).toEqual({ clipPath: 'a.clip', psdPath: 'renamed.psd' })
    expect(resolveQuickExportJobs(['a.psd', 'timing.xdts'])[0].pair).toEqual({ psdPath: 'a.psd', xdtsPath: 'timing.xdts' })
  })
  it('reports orphan PSD/XDTS files, including legacy-only multiple inputs', () => {
    expect(resolveQuickExportJobs(['orphan.psd'])[0].error).toContain('PSDとXDTS')
    const jobs = resolveQuickExportJobs(['a.psd', 'a.xdts', 'b.psd', 'b.xdts'])
    expect(jobs).toHaveLength(2)
    expect(jobs.every(job => job.error)).toBe(true)
  })
  it('uses native timing when each CLIP has an accompanying XDTS', () => {
    const jobs = resolveQuickExportJobs(['a.clip', 'a.xdts', 'b.clip', 'b.xdts'])
    expect(jobs.map(job => job.pair)).toEqual([{ clipPath: 'a.clip' }, { clipPath: 'b.clip' }])
  })
})
