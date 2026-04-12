import type { CspLayer } from '../types'

function isVisibleCell(layer: CspLayer): boolean {
  return !layer.hidden && !layer.uiHidden
}

/**
 * XDTS のセル名をアニメーションフォルダ内の children index（全 children 基準）へ解決する。
 *
 * 同名セルが複数ある場合も、CSP/XDTS と同じく全 children 基準のボトム優先で返す。
 * hidden/uiHidden であっても、タイムライン上そのセルが打たれていれば index は保持する。
 */
export function findTimelineCellChildIndex(folder: CspLayer, cellName: string): number {
  for (let i = folder.children.length - 1; i >= 0; i--) {
    const child = folder.children[i]
    if (child.originalName === cellName) return i
  }
  return -1
}

export interface ResolvedAnimCellSelection {
  cell: CspLayer
  childIndex: number
  visibleChildren: CspLayer[]
  visibleIndex: number
}

/**
 * selectedCells の children index を、実際にプレビュー/ナビゲーターで表示すべきセルへ解決する。
 *
 * - 未選択(undefined): 既存どおり先頭 visible を使う
 * - explicit hidden index: 別セルへ丸めず null を返す
 * - 範囲外 index: stale state とみなし先頭 visible にフォールバックする
 */
export function resolveSelectedAnimCell(
  folder: CspLayer,
  rawCellIndex: number | undefined,
): ResolvedAnimCellSelection | null {
  const visibleChildren = folder.children.filter(isVisibleCell)
  if (visibleChildren.length === 0) return null

  if (rawCellIndex === undefined) {
    return {
      cell: visibleChildren[0],
      childIndex: folder.children.findIndex(child => child.id === visibleChildren[0].id),
      visibleChildren,
      visibleIndex: 0,
    }
  }

  if (rawCellIndex < 0) return null

  const targetCell = folder.children[rawCellIndex]
  if (!targetCell) {
    return {
      cell: visibleChildren[0],
      childIndex: folder.children.findIndex(child => child.id === visibleChildren[0].id),
      visibleChildren,
      visibleIndex: 0,
    }
  }

  if (isVisibleCell(targetCell)) {
    return {
      cell: targetCell,
      childIndex: rawCellIndex,
      visibleChildren,
      visibleIndex: visibleChildren.findIndex(child => child.id === targetCell.id),
    }
  }

  return null
}
