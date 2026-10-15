import type { CspLayer, TimelineData, TimelineTrack } from '../types'
import { isAutomaticOutputSuppressed } from './output-target'

/**
 * PSD 読み込み時・表示状態リセット時に使うアプリ側の初期 visibility override。
 *
 * ここで返す Map の boolean は「visible」ではなく「uiHidden」の意味。
 * - true  = UI上で非表示
 * - false = UI上で表示
 * 仮想セットの visibilityOverrides（visible=true/false）とは意味が逆なので注意。
 *
 * - 設定がONなら、個別書き出し対象の非表示フォルダ本体を初期表示ONにする
 * - XDTS で検出したアニメーションフォルダでは、タイムラインから到達できないセルを初期表示OFFにする
 */
export function buildDefaultVisibilityOverrides(
  layers: CspLayer[],
  xdts?: TimelineData | null,
  sharedCutMode = false,
  showIndividualFoldersOnLoad = true,
): Map<string, boolean> {
  const overrides = new Map<string, boolean>()
  if (showIndividualFoldersOnLoad) addAutoMarkedShowOverrides(layers, overrides)
  if (xdts) {
    if (sharedCutMode) {
      addXdtsAnimationFolderShowOverrides(layers, overrides)
    } else {
      addXdtsUnusedCellHiddenOverrides(layers, xdts, overrides, true)
    }
  }
  return overrides
}

/**
 * 既存の visibilityOverrides に、XDTS 未使用セルの初期OFFだけを追加する。
 * overwrite=false の場合、ユーザーが既に触った目玉状態は尊重する。
 */
export function addXdtsUnusedCellHiddenOverrides(
  layers: CspLayer[],
  xdts: TimelineData,
  overrides: Map<string, boolean>,
  overwrite = false,
): Map<string, boolean> {
  const tracksByNo = new Map(xdts.tracks.map(track => [track.trackNo, track]))

  function walk(nodes: CspLayer[]): void {
    for (const layer of nodes) {
      if (layer.isAnimationFolder && (layer.animationFolder?.detectedBy === 'xdts' || layer.animationFolder?.detectedBy === 'clip')) {
        const trackNo = layer.animationFolder.trackNo
        const track = typeof trackNo === 'number' ? tracksByNo.get(trackNo) : undefined
        if (track) {
          const usedCellIds = collectTimelineReachableCellIds(layer, track)
          for (const child of layer.children) {
            if (usedCellIds.has(child.id)) continue
            if (overwrite || !overrides.has(child.id)) {
              // visibilityOverrides は uiHidden の意味なので true = 非表示。
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
    // visibilityOverrides は uiHidden の意味なので false = 表示。
    if (layer.autoMarked && layer.hidden) overrides.set(layer.id, false)
    if (layer.children.length > 0) addAutoMarkedShowOverrides(layer.children, overrides)
  }
}

/**
 * 兼用カット用: XDTS と対応したアニメーションフォルダ自体だけを初期表示ONにする。
 * 配下セルの表示状態は PSD の状態を尊重し、XDTS のキー有無では変更しない。
 */
export function addXdtsAnimationFolderShowOverrides(
  layers: CspLayer[],
  overrides: Map<string, boolean>,
): Map<string, boolean> {
  for (const layer of layers) {
    if (isAutomaticOutputSuppressed(layer)) continue
    if (layer.isAnimationFolder && (layer.animationFolder?.detectedBy === 'xdts' || layer.animationFolder?.detectedBy === 'clip')) {
      if (layer.hidden) overrides.set(layer.id, false)
      continue
    }
    if (layer.children.length > 0) addXdtsAnimationFolderShowOverrides(layer.children, overrides)
  }
  return overrides
}

function collectTimelineReachableCellIds(
  animFolder: CspLayer,
  track: TimelineTrack,
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

/** Recompute timeline defaults without discarding deliberate eye-button choices. */
export function retainManualVisibility(defaults: Map<string, boolean>, previous: Map<string, boolean>, manualIds: Set<string>): Map<string, boolean> {
  for (const id of manualIds) if (previous.has(id)) defaults.set(id, previous.get(id)!)
  return defaults
}
