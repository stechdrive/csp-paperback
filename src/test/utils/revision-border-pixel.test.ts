import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createCanvas as createNapiCanvas } from '@napi-rs/canvas'
import { createRevisionBorderCanvas } from '../../utils/revision-border'

let createElementSpy: ReturnType<typeof vi.spyOn>

beforeAll(() => {
  const originalCreateElement = document.createElement.bind(document)
  createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
    if (tagName.toLowerCase() === 'canvas') {
      return createNapiCanvas(1, 1) as unknown as HTMLCanvasElement
    }
    return originalCreateElement(tagName, options)
  })
})

afterAll(() => {
  createElementSpy.mockRestore()
})

function rgbaAt(canvas: HTMLCanvasElement, x: number, y: number): [number, number, number, number] {
  const data = canvas.getContext('2d')!.getImageData(x, y, 1, 1).data
  return [data[0], data[1], data[2], data[3]]
}

function whiteCanvas(width = 300, height = 240): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  context.fillStyle = '#FFFFFF'
  context.fillRect(0, 0, width, height)
  return canvas
}

describe('revision border pixel behavior', () => {
  it('上30px・左右下70pxだけを乗算80%で着色し、角を二重に塗らない', () => {
    const source = whiteCanvas()
    const result = createRevisionBorderCanvas(source, '#FF0000')

    for (const [x, y] of [
      [0, 0], [299, 0], [0, 239], [299, 239],
      [150, 29], [69, 30], [230, 30], [69, 120], [230, 120], [150, 170],
    ]) {
      expect(rgbaAt(result, x, y), `border at ${x},${y}`).toEqual([255, 51, 51, 255])
    }
    for (const [x, y] of [[150, 30], [150, 69], [70, 30], [229, 30], [70, 120], [229, 120], [150, 169]]) {
      expect(rgbaAt(result, x, y), `interior at ${x},${y}`).toEqual([255, 255, 255, 255])
    }
    expect(rgbaAt(source, 0, 0)).toEqual([255, 255, 255, 255])
  })

  it('上辺から40pxのタップ穴相当の画像を元の画素のまま保持する', () => {
    const source = whiteCanvas()
    const context = source.getContext('2d')!
    context.fillStyle = '#808080'
    context.fillRect(120, 40, 60, 20)
    context.fillStyle = '#202020'
    context.fillRect(125, 45, 50, 10)
    const original = context.getImageData(110, 30, 80, 40).data

    const result = createRevisionBorderCanvas(source, '#FF0000')

    expect(result.getContext('2d')!.getImageData(110, 30, 80, 40).data).toEqual(original)
  })

  it.each([[120, 300], [140, 300], [300, 90], [300, 100]])(
    '%i×%iでは重なるフチを1回だけ塗る', (width, height) => {
      const result = createRevisionBorderCanvas(whiteCanvas(width, height), '#FF0000')
      for (const [x, y] of [[0, 0], [width - 1, height - 1], [Math.floor(width / 2), Math.floor(height / 2)]]) {
        expect(rgbaAt(result, x, y)).toEqual([255, 51, 51, 255])
      }
    },
  )

  it.each([[300, 101], [300, 120], [141, 240]])(
    '%i×%iではフチの間に残る領域を塗らない', (width, height) => {
      const result = createRevisionBorderCanvas(whiteCanvas(width, height), '#FF0000')
      expect(rgbaAt(result, 70, 29)).toEqual([255, 51, 51, 255])
      expect(rgbaAt(result, 69, 30)).toEqual([255, 51, 51, 255])
      expect(rgbaAt(result, 70, 30)).toEqual([255, 255, 255, 255])
      expect(rgbaAt(result, 70, height - 71)).toEqual([255, 255, 255, 255])
      expect(rgbaAt(result, 70, height - 70)).toEqual([255, 51, 51, 255])
    },
  )
})
