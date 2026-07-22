import type { OutputEntry, ProcessFolderEntry } from '../types'
import { createCanvas } from '../engine/compositor'
import { resolveProcessBorderColor } from './process-color'

export const REVISION_BORDER_WIDTH = 70
export const REVISION_BORDER_OPACITY = 0.8

/**
 * 合成済み画像の内側外周へ、70px・乗算・不透明度80%の矩形フチを重ねる。
 * 画像が140px以下の辺を持つ場合は重複塗りを避けるため全面を1回だけ塗る。
 */
export function createRevisionBorderCanvas(
  source: HTMLCanvasElement,
  color: string,
): HTMLCanvasElement {
  const output = createCanvas(source.width, source.height)
  const ctx = output.getContext('2d')!
  ctx.drawImage(source, 0, 0)

  if (source.width === 0 || source.height === 0) return output

  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.globalAlpha = REVISION_BORDER_OPACITY
  ctx.fillStyle = color

  if (
    source.width <= REVISION_BORDER_WIDTH * 2
    || source.height <= REVISION_BORDER_WIDTH * 2
  ) {
    ctx.fillRect(0, 0, source.width, source.height)
  } else {
    const middleHeight = source.height - REVISION_BORDER_WIDTH * 2
    ctx.fillRect(0, 0, source.width, REVISION_BORDER_WIDTH)
    ctx.fillRect(
      0,
      source.height - REVISION_BORDER_WIDTH,
      source.width,
      REVISION_BORDER_WIDTH,
    )
    ctx.fillRect(0, REVISION_BORDER_WIDTH, REVISION_BORDER_WIDTH, middleHeight)
    ctx.fillRect(
      source.width - REVISION_BORDER_WIDTH,
      REVISION_BORDER_WIDTH,
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
      canvas: createRevisionBorderCanvas(entry.canvas, colors.get(suffix)!),
    }
  })
}
