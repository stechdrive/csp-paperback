import type { Psd, Layer } from 'ag-psd'
import type { CspLayer, BlendMode, XdtsData } from '../types'

/**
 * ag-psdのレイヤーがフォルダかどうか判定
 * sectionDivider.type: 1 = OpenFolder, 2 = ClosedFolder
 */
function isFolder(layer: Layer): boolean {
  return (
    layer.sectionDivider?.type === 1 ||
    layer.sectionDivider?.type === 2 ||
    (layer.children !== undefined && layer.children.length >= 0)
  )
}

/**
 * ag-psdのレイヤーがアニメーションフォルダかどうかの初期判定
 * ツリー構築時点ではfalse（xdts照合か手動指定でdetectAnimationFoldersByXdtsが設定する）
 */
function isAnimationFolder(_layer: Layer): boolean {
  return false
}

/**
 * 調整レイヤーを含むかどうか判定
 */
function hasAdjustment(layer: Layer): boolean {
  return layer.adjustment !== undefined
}

/**
 * ag-psd Layerを再帰的にCspLayerに変換する
 */
function convertLayer(
  layer: Layer,
  parentId: string | null,
  depth: number,
  animFolderContext: boolean // アニメーションフォルダ内かどうか（_プレフィックス無視判定用）
): CspLayer {
  const id = crypto.randomUUID()
  const originalName = layer.name ?? ''
  // _プレフィックスを除去した表示名
  const name = originalName.startsWith('_') ? originalName.slice(1) : originalName
  const blendMode: BlendMode = (layer.blendMode ?? 'normal') as BlendMode
  const hidden = layer.hidden ?? false
  const clipping = layer.clipping ?? false
  const folder = isFolder(layer)
  const animFolder = isAnimationFolder(layer)

  // _プレフィックス自動マーク（アニメーションフォルダ内は無視）
  const autoMarked = !animFolderContext && originalName.startsWith('_') && folder

  const top = layer.top ?? 0
  const left = layer.left ?? 0
  const width = (layer.right ?? 0) - left
  const height = (layer.bottom ?? 0) - top

  // 子レイヤーの変換
  // ag-psdはボトムファースト順で返すので逆順にしてPhotoshop UI順（トップファースト）に統一する
  // アニメーションフォルダ内では_プレフィックスを自動マークしない
  const nextContext = animFolderContext || animFolder
  const children: CspLayer[] = (layer.children ?? []).slice().reverse().map(child =>
    convertLayer(child, id, depth + 1, nextContext)
  )

  return {
    id,
    name,
    originalName,
    agPsdRef: layer,
    children,
    parentId,
    depth,
    blendMode,
    hidden,
    clipping,
    isFolder: folder,
    isAnimationFolder: animFolder,
    top,
    left,
    width,
    height,
    animationFolder: null, // detectAnimationFoldersで後から設定
    singleMark: false,
    autoMarked,
    virtualSetMembership: [],
    uiHidden: false,
    expanded: depth < 2, // 初期状態は浅い階層のみ展開
    hasAdjustmentLayer: hasAdjustment(layer),
  }
}

/**
 * xdtsのtrack名（CAM除外）でアニメーションフォルダを特定し設定する
 */
export function detectAnimationFoldersByXdts(
  tree: CspLayer[],
  xdts: XdtsData
): void {
  // パーサーでfieldId=0（CELL）のみ抽出済みなので追加フィルタ不要
  const trackNames = new Set(
    xdts.tracks.map(t => t.name.toLowerCase())
  )

  function walk(layers: CspLayer[]): void {
    for (const layer of layers) {
      if (layer.isFolder && trackNames.has(layer.originalName.toLowerCase())) {
        layer.isAnimationFolder = true
        layer.animationFolder = {
          detectedBy: 'xdts',
          trackName: layer.originalName,
        }
      }
      if (layer.children.length > 0) {
        walk(layer.children)
      }
    }
  }

  walk(tree)
}

/**
 * レイヤーがアニメーションフォルダの子孫を持つかどうかを再帰的に判定
 */
export function hasAnimationFolderDescendant(layer: CspLayer): boolean {
  if (layer.isAnimationFolder) return true
  return layer.children.some(hasAnimationFolderDescendant)
}

/**
 * PSD全体でアニメーションフォルダの祖先IDのセットを返す
 */
export function collectAnimFolderAncestorIds(tree: CspLayer[]): Set<string> {
  const ancestorIds = new Set<string>()

  function walk(layers: CspLayer[], ancestorPath: string[]): void {
    for (const layer of layers) {
      if (layer.isAnimationFolder) {
        // この祖先パスに含まれる全IDを追加（自身は除く）
        for (const id of ancestorPath) {
          ancestorIds.add(id)
        }
      }
      if (layer.children.length > 0) {
        walk(layer.children, [...ancestorPath, layer.id])
      }
    }
  }

  walk(tree, [])
  return ancestorIds
}

/**
 * PSDオブジェクトからCspLayerツリーを構築する
 */
export function buildLayerTree(
  psd: Psd,
  xdts?: XdtsData
): CspLayer[] {
  // ag-psdはボトムファースト順で返すので逆順にしてPhotoshop UI順（トップファースト）に統一する
  const children = (psd.children ?? []).slice().reverse()
  const tree = children.map(layer => convertLayer(layer, null, 0, false))

  if (xdts) {
    detectAnimationFoldersByXdts(tree, xdts)
  }

  return tree
}
