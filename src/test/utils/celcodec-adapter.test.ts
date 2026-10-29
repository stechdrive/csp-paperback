import { describe, expect, it } from 'vitest'
import { ClipError } from 'celcodec'
import { codecCall, codecFunction, codecMessage } from '../../utils/clip/celcodec'
import { ImageResourceError } from '../../utils/image-budget'

describe('celcodec diagnostic boundary', () => {
  it('keeps transient image resource failures retryable for synchronous and asynchronous decoders', async () => {
    const limit = new ClipError('LIMIT_IMAGE_PIXELS')
    expect(() => codecCall(() => { throw limit })).toThrow(ImageResourceError)
    await expect(codecCall(() => Promise.reject(limit))).rejects.toBeInstanceOf(ImageResourceError)
    await expect(codecCall(() => Promise.reject(new ClipError('LIMIT_CANVAS_BYTES')))).rejects.toThrow('処理量が上限を超えました')
  })

  it('localizes malformed data while preserving the original diagnostic as its cause', () => {
    const original = new ClipError('INVALID_CONTAINER_HEADER')
    let thrown: unknown
    try { codecCall(() => { throw original }) } catch (error) { thrown = error }
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown).not.toBeInstanceOf(ImageResourceError)
    expect(thrown).toMatchObject({ message: 'CLIP: コンテナーのヘッダーが不正です。', cause: original })
  })

  it('preserves programming errors, cancellation and successful return values through the adapter', async () => {
    const error = new TypeError('consumer failure')
    expect(() => codecCall(() => { throw error })).toThrow(error)
    const abort = new DOMException('cancelled', 'AbortError')
    await expect(codecCall(() => Promise.reject(abort))).rejects.toBe(abort)
    const wrap = codecFunction((left: number, right: number) => ({ left, right }))
    expect(wrap(3, 7)).toEqual({ left: 3, right: 7 })
    const value = { id: 'art' }
    expect(await codecCall(() => Promise.resolve(value))).toBe(value)
  })

  it('gives actionable fallback wording for new diagnostic codes and unsupported adjustment kinds', () => {
    expect(codecMessage('UNSUPPORTED_ADJUSTMENT', { kind: 999 })).toContain('色調補正 999')
    expect(codecMessage('UNSUPPORTED_CANVAS_UNIT')).toContain('未対応のCLIP形式')
    expect(codecMessage('APPROXIMATE_PLACEMENT')).toContain('近似描画')
    expect(codecMessage('INVALID_COLUMN_NAME')).toContain('CLIPデータが不正')
  })
})
