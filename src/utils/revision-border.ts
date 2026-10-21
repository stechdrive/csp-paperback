import type { OutputEntry, ProcessFolderEntry } from '../types'
import { createCanvas } from '../engine/compositor'
import { copyRenderWarnings } from '../engine/render-warning'
import { resolveProcessBorderColor } from './process-color'
import type { PixelBounds } from '../engine/render-resources'

export const REVISION_BORDER_WIDTH = 70
export const REVISION_BORDER_TOP_WIDTH = 30
export const REVISION_BORDER_OPACITY = 0.8

/**
 * 合成済み画像の内側外周へ、上30px・左右下70px・乗算80%の矩形フチを重ねる。
 * 上辺はタップ穴画像にかかりにくい幅に抑える。
 * 幅140px以下または高さ100px以下では重複塗りを避けて全面を1回だけ塗る。
 */
export function createRevisionBorderCanvas(
  source: HTMLCanvasElement,
  color: string,
  region?: PixelBounds,
): HTMLCanvasElement {
  const output = createCanvas(source.width, source.height)
  const ctx = output.getContext('2d')!
  ctx.drawImage(source, 0, 0)
  copyRenderWarnings(output, source)

  if (source.width === 0 || source.height === 0) return output

  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.globalAlpha = REVISION_BORDER_OPACITY
  ctx.fillStyle = color
  const width = region?.width ?? source.width, height = region?.height ?? source.height
  ctx.translate(-(region?.left ?? 0), -(region?.top ?? 0))

  if (
    width <= REVISION_BORDER_WIDTH * 2
    || height <= REVISION_BORDER_TOP_WIDTH + REVISION_BORDER_WIDTH
  ) {
    ctx.fillRect(0, 0, width, height)
  } else {
    const middleHeight = height - REVISION_BORDER_TOP_WIDTH - REVISION_BORDER_WIDTH
    ctx.fillRect(0, 0, width, REVISION_BORDER_TOP_WIDTH)
    ctx.fillRect(
      0,
      height - REVISION_BORDER_WIDTH,
      width,
      REVISION_BORDER_WIDTH,
    )
    ctx.fillRect(0, REVISION_BORDER_TOP_WIDTH, REVISION_BORDER_WIDTH, middleHeight)
    ctx.fillRect(
      width - REVISION_BORDER_WIDTH,
      REVISION_BORDER_TOP_WIDTH,
      REVISION_BORDER_WIDTH,
      middleHeight,
    )
  }
  ctx.restore()
  return output
}

/** 工程サフィックスを持つエントリだけに、対応色の確認フチを付ける。 */
export function applyRevisionBorders(
  entries: OutputEntry[],
  processTable: ProcessFolderEntry[],
  enabled: boolean,
  region?: PixelBounds,
): OutputEntry[] {
  if (!enabled) return entries

  const colors = new Map(
    processTable.map(entry => [entry.suffix, resolveProcessBorderColor(entry)]),
  )

  return entries.map(entry => {
    const suffix = [...(entry.processSuffixes ?? [])]
      .reverse()
      .find(candidate => colors.has(candidate))
    if (!suffix) return entry

    return {
      ...entry,
      canvas: createRevisionBorderCanvas(entry.canvas, colors.get(suffix)!, region),
    }
  })
}
