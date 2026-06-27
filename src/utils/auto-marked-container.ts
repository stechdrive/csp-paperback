import type { CspLayer } from '../types'

function isVisible(layer: CspLayer): boolean {
  return !layer.hidden && !layer.uiHidden
}

function isDirectOutputUnit(layer: CspLayer): boolean {
  if (!isVisible(layer)) return false
  return layer.isAnimationFolder || layer.autoMarked || layer.singleMark
}

/**
 * `_` 自動マークされた親フォルダのうち、直下に出力単位しか持たないものは
 * 統合画像ではなく整理用コンテナとして扱う。
 *
 * autoMarked 自体は合成コンテキスト除外などにも使うため消さず、
 * 出力対象・プレビュー対象からだけ外す。
 */
export function isAutoMarkedContainerOutputSuppressed(layer: CspLayer): boolean {
  if (!layer.isFolder) return false
  if (!layer.autoMarked || layer.singleMark || layer.isAnimationFolder) return false
  if (!isVisible(layer)) return false

  const visibleChildren = layer.children.filter(isVisible)
  if (visibleChildren.length === 0) return false

  return visibleChildren.every(isDirectOutputUnit)
}

export function isAutoMarkedOutputTarget(layer: CspLayer): boolean {
  return layer.autoMarked &&
    !layer.singleMark &&
    !layer.isAnimationFolder &&
    !isAutoMarkedContainerOutputSuppressed(layer)
}
