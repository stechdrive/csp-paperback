import type { CspLayer, XdtsData, XdtsTrack } from '../types'

/**
 * PSD 読み込み時・表示状態リセット時に使うアプリ側の初期 visibility override。
 *
 * - PSD 上で非表示の _ 自動マークフォルダは、出力対象として扱うため初期表示ONにする
 * - XDTS で検出したアニメーションフォルダでは、タイムラインから到達できないセルを初期表示OFFにする
 */
export function buildDefaultVisibilityOverrides(
  layers: CspLayer[],
  xdts?: XdtsData | null,
): Map<string, boolean> {
  const overrides = new Map<string, boolean>()
  addAutoMarkedShowOverrides(layers, overrides)
  if (xdts) addXdtsUnusedCellHiddenOverrides(layers, xdts, overrides, true)
  return overrides
}

/**
 * 既存の visibilityOverrides に、XDTS 未使用セルの初期OFFだけを追加する。
 * overwrite=false の場合、ユーザーが既に触った目玉状態は尊重する。
 */
export function addXdtsUnusedCellHiddenOverrides(
  layers: CspLayer[],
  xdts: XdtsData,
  overrides: Map<string, boolean>,
  overwrite = false,
): Map<string, boolean> {
  const tracksByNo = new Map(xdts.tracks.map(track => [track.trackNo, track]))

  function walk(nodes: CspLayer[]): void {
    for (const layer of nodes) {
      if (layer.isAnimationFolder && layer.animationFolder?.detectedBy === 'xdts') {
        const trackNo = layer.animationFolder.trackNo
        const track = typeof trackNo === 'number' ? tracksByNo.get(trackNo) : undefined
        if (track) {
          const usedCellIds = collectTimelineReachableCellIds(layer, track)
          for (const child of layer.children) {
            if (usedCellIds.has(child.id)) continue
            if (overwrite || !overrides.has(child.id)) {
              overrides.set(child.id, true)
            }
          }
        }
        continue
      }
      if (layer.children.length > 0) walk(layer.children)
    }
  }

  walk(layers)
  return overrides
}

function addAutoMarkedShowOverrides(
  layers: CspLayer[],
  overrides: Map<string, boolean>,
): void {
  for (const layer of layers) {
    if (layer.autoMarked && layer.hidden) overrides.set(layer.id, false)
    if (layer.children.length > 0) addAutoMarkedShowOverrides(layer.children, overrides)
  }
}

function collectTimelineReachableCellIds(
  animFolder: CspLayer,
  track: XdtsTrack,
): Set<string> {
  const usedNames = new Set(track.cellNames)
  for (const frame of track.frames) {
    if (frame.cellName !== null) usedNames.add(frame.cellName)
  }

  const usedIds = new Set<string>()
  for (const cellName of usedNames) {
    const idx = findBottomFirstCellIndex(animFolder, cellName)
    if (idx >= 0) usedIds.add(animFolder.children[idx].id)
  }
  return usedIds
}

function findBottomFirstCellIndex(animFolder: CspLayer, cellName: string): number {
  for (let i = animFolder.children.length - 1; i >= 0; i--) {
    if (animFolder.children[i].originalName === cellName) return i
  }
  return -1
}
