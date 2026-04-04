import { describe, it, expect } from 'vitest'
import { formatToExtension, replaceExtension, canvasToDataUrl } from '../../utils/image-export'
import { makeCanvas } from '../helpers/psd-factory'

describe('formatToExtension', () => {
  it('jpgは.jpgを返す', () => {
    expect(formatToExtension('jpg')).toBe('.jpg')
  })

  it('pngは.pngを返す', () => {
    expect(formatToExtension('png')).toBe('.png')
  })
})

describe('replaceExtension', () => {
  it('既存の拡張子をjpgに置換する', () => {
    expect(replaceExtension('A0001.jpg', 'jpg')).toBe('A0001.jpg')
    expect(replaceExtension('A0001.png', 'jpg')).toBe('A0001.jpg')
  })

  it('既存の拡張子をpngに置換する', () => {
    expect(replaceExtension('A0001.jpg', 'png')).toBe('A0001.png')
  })

  it('拡張子なしのファイル名にも対応する', () => {
    expect(replaceExtension('A0001', 'jpg')).toBe('A0001.jpg')
  })

  it('パスを含むファイル名でも正しく動作する', () => {
    expect(replaceExtension('A/A0001.jpg', 'png')).toBe('A/A0001.png')
  })
})

describe('canvasToDataUrl', () => {
  it('JPGのData URLを返す', () => {
    const canvas = makeCanvas(10, 10)
    const url = canvasToDataUrl(canvas, 'jpg')
    expect(url).toMatch(/^data:image\/jpeg/)
  })

  it('PNGのData URLを返す', () => {
    const canvas = makeCanvas(10, 10)
    const url = canvasToDataUrl(canvas, 'png')
    expect(url).toMatch(/^data:image\/png/)
  })
})
