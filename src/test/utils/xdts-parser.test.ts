import { describe, it, expect } from 'vitest'
import { parseXdts } from '../../utils/xdts-parser'

const makeXdts = (tracks: { name: string }[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><xdtsData><timeSheetData>${tracks.map(t => `<track name="${t.name}"/>`).join('')}</timeSheetData></xdtsData>`

describe('parseXdts', () => {
  it('trackリストを解析する', () => {
    const xml = makeXdts([{ name: 'A' }, { name: 'B' }, { name: 'CAM' }])
    const result = parseXdts(xml)
    expect(result.tracks).toHaveLength(3)
    expect(result.tracks[0].name).toBe('A')
    expect(result.tracks[1].name).toBe('B')
  })

  it('CAMトラックをisCam=trueとして解析する', () => {
    const xml = makeXdts([{ name: 'A' }, { name: 'CAM' }])
    const result = parseXdts(xml)
    const cam = result.tracks.find(t => t.name === 'CAM')
    expect(cam?.isCam).toBe(true)
  })

  it('非CAMトラックはisCam=falseになる', () => {
    const xml = makeXdts([{ name: 'A' }])
    const result = parseXdts(xml)
    expect(result.tracks[0].isCam).toBe(false)
  })

  it('CAMの大文字小文字を区別しない', () => {
    const xml = makeXdts([{ name: 'cam' }, { name: 'Cam' }, { name: 'CAM' }])
    const result = parseXdts(xml)
    expect(result.tracks.every(t => t.isCam)).toBe(true)
  })

  it('trackが0件のxdtsは空配列を返す', () => {
    const xml = `<?xml version="1.0"?><xdtsData></xdtsData>`
    const result = parseXdts(xml)
    expect(result.tracks).toHaveLength(0)
  })

  it('不正なXMLはエラーを投げる', () => {
    expect(() => parseXdts('<invalid xml')).toThrow()
  })
})
