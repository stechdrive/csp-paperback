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

describe('revision border pixel behavior', () => {
  it('外周だけを乗算80%で着色し、中央画素を保持する', () => {
    const source = document.createElement('canvas')
    source.width = 300
    source.height = 240
    const context = source.getContext('2d')!
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, source.width, source.height)

    const result = createRevisionBorderCanvas(source, '#FF0000')

    expect(rgbaAt(result, 0, 0)).toEqual([255, 51, 51, 255])
    expect(rgbaAt(result, 69, 120)).toEqual([255, 51, 51, 255])
    expect(rgbaAt(result, 70, 120)).toEqual([255, 255, 255, 255])
    expect(rgbaAt(result, 150, 120)).toEqual([255, 255, 255, 255])
  })
})
