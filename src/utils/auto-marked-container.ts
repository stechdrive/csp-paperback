import type { CspLayer } from '../types'
import { isMediaLayer } from './layer-display'

function isVisible(layer: CspLayer): boolean {
  return !isMediaLayer(layer) && !layer.hidden && !layer.uiHidden
}

function isDirectOutputUnit(layer: CspLayer): boolean {
  return layer.isAnimationFolder || layer.autoMarked || layer.singleMark
}

// Inspect structure, not pixels or visibility: a transparent/hidden artwork
// layer still represents an intentional output. Descend through empty folders.
function hasArtworkLayer(layer: CspLayer): boolean {
  return !isMediaLayer(layer) && (!layer.isFolder || layer.children.some(hasArtworkLayer))
}

/**
 * 自動単独出力フォルダのうち、配下が空またはフォルダだけのものと、
 * 直下に出力単位しか持たない整理用コンテナは統合画像を作らない。
 *
 * autoMarked 自体は合成コンテキスト除外などにも使うため消さず、
 * 出力対象・プレビュー対象からだけ外す。
 */
export function isAutoMarkedContainerOutputSuppressed(layer: CspLayer, includeHidden = false): boolean {
  if (!layer.isFolder) return false
  if (!layer.autoMarked || layer.singleMark || layer.isAnimationFolder) return false
  if (!hasArtworkLayer(layer)) return true
  if (!includeHidden && !isVisible(layer)) return false

  const visibleChildren = includeHidden ? layer.children : layer.children.filter(isVisible)
  // Hiding every independent child must not turn its organizer into a new output.
  // Ordinary artwork still keeps the parent's existing context-only output.
  const children = visibleChildren.length > 0
    ? visibleChildren
    : layer.children.filter(child => !isMediaLayer(child))
  return children.every(isDirectOutputUnit)
}

export function isAutoMarkedOutputTarget(layer: CspLayer): boolean {
  return !isMediaLayer(layer) && layer.autoMarked &&
    !layer.singleMark &&
    !layer.isAnimationFolder &&
    !isAutoMarkedContainerOutputSuppressed(layer)
}
