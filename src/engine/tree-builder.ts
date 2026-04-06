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
  animFolderContext: boolean, // アニメーションフォルダ内かどうか（_プレフィックス無視判定用）
  archivePatterns: string[]
): CspLayer {
  const id = crypto.randomUUID()
  const originalName = layer.name ?? ''
  // _プレフィックスを除去した表示名
  const name = originalName.startsWith('_') ? originalName.slice(1) : originalName
  const blendMode: BlendMode = (layer.blendMode ?? 'normal') as BlendMode
  // ag-psdのopacityは0〜1（psdReader.jsで / 0xff済み）、UIは0〜100に変換
  const opacity = Math.round((layer.opacity ?? 1) * 100)
  const hidden = layer.hidden ?? false
  const clipping = layer.clipping ?? false
  const folder = isFolder(layer)
  const animFolder = isAnimationFolder(layer)

  // _プレフィックス自動マーク（アニメーションフォルダ内・アーカイブパターン一致は除外）
  const isArchive = archivePatterns.some(p => originalName.startsWith(p))
  const autoMarked = !animFolderContext && originalName.startsWith('_') && folder && !isArchive

  const top = layer.top ?? 0
  const left = layer.left ?? 0
  const width = (layer.right ?? 0) - left
  const height = (layer.bottom ?? 0) - top

  // 子レイヤーの変換
  // ag-psdはボトムファースト順で返すので逆順にしてPhotoshop UI順（トップファースト）に統一する
  // アニメーションフォルダ内では_プレフィックスを自動マークしない
  const nextContext = animFolderContext || animFolder
  const children: CspLayer[] = (layer.children ?? []).slice().reverse().map(child =>
    convertLayer(child, id, depth + 1, nextContext, archivePatterns)
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
    opacity,
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
    expanded: layer.sectionDivider?.type === 1, // OpenFolder(1)=展開, ClosedFolder(2)=折りたたみ
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
 * XDTS 検出によるアニメーションフォルダフラグをリセットする（手動指定は保持）
 */
export function clearXdtsAnimFolders(layers: CspLayer[]): void {
  for (const layer of layers) {
    if (layer.isAnimationFolder && layer.animationFolder?.detectedBy === 'xdts') {
      layer.isAnimationFolder = false
      layer.animationFolder = null
    }
    if (layer.children.length > 0) clearXdtsAnimFolders(layer.children)
  }
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
  xdts?: XdtsData,
  archivePatterns: string[] = []
): CspLayer[] {
  // ag-psdはボトムファースト順で返すので逆順にしてPhotoshop UI順（トップファースト）に統一する
  const children = (psd.children ?? []).slice().reverse()
  const tree = children.map(layer => convertLayer(layer, null, 0, false, archivePatterns))

  if (xdts) {
    detectAnimationFoldersByXdts(tree, xdts)
  }

  // クリスタが自動生成する「用紙」レイヤー（最下層）を自動的に非表示に設定する。
  // 白背景として合成されてしまうため、PNG透過出力時に意図しない結果を防ぐ。
  const bottom = tree[tree.length - 1]
  if (bottom && !bottom.isFolder && bottom.originalName === '用紙') {
    bottom.uiHidden = true
  }

  return tree
}
