import type { Psd, Layer } from 'ag-psd'
import type { CspLayer, BlendMode, XdtsData } from '../types'
import type { ProcessFolderEntry } from '../types/project'
import { assignTracksToFolders, type AssignResult } from './anim-folder-assignment'

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
function isAnimationFolder(): boolean {
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
  const animFolder = isAnimationFolder()

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
 * XDTS の track 情報でアニメーションフォルダを特定し設定する。
 *
 * 旧実装は「名前マッチしたフォルダを全部 anim folder 化」だったが、
 * 同名トラック問題・アーカイブ配下の誤検出等を解決するため、
 * assignTracksToFolders による 2 段階優先度 + ボトム優先 + trim 正規化の
 * 対応付けアルゴリズムに置き換えた。
 *
 * 割当されたフォルダだけに isAnimationFolder=true を立てる。
 * 余剰候補(名前は合うが XDTS の席が足りない)は通常フォルダのまま残る。
 *
 * @returns AssignResult(警告 UI 用の unmatchedTracks を含む)
 */
export function detectAnimationFoldersByXdts(
  tree: CspLayer[],
  xdts: XdtsData
): AssignResult {
  // トラック ↔ フォルダ の対応付けを計算
  const result = assignTracksToFolders(tree, xdts.tracks)

  // 割当された layer にだけ anim folder フラグを立てる
  // trackName は元の XDTS トラック名(raw、trim 前)を保持(UI 表示のため)
  const tracksByNo = new Map(xdts.tracks.map(t => [t.trackNo, t]))
  function walk(layers: CspLayer[]): void {
    for (const layer of layers) {
      const trackNo = result.assignment.get(layer.id)
      if (trackNo !== undefined) {
        const track = tracksByNo.get(trackNo)
        layer.isAnimationFolder = true
        layer.animationFolder = {
          detectedBy: 'xdts',
          trackName: track?.name ?? layer.originalName,
          trackNo,
        }
      }
      if (layer.children.length > 0) {
        walk(layer.children)
      }
    }
  }
  walk(tree)

  return result
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
 * autoMarked フォルダのうち、直接の子に processTable 登録名のフォルダを
 * 持つものをアニメーションフォルダに昇格させる。
 *
 * ルール:
 * - 祖先がアニメフォルダ（XDTS/手動/autoProcess いずれでも）なら対象外
 * - 子孫に既に昇格済みフォルダを含むなら対象外（内側優先）
 * - 直接の子のみ照合（孫は見ない）
 * - 既に isAnimationFolder=true なら対象外（XDTS/手動が優先）
 * - 名前照合は trim + lowercase
 *
 * 元のツリーは変更せず、変更のあったレイヤーのみ新オブジェクトを返す。
 */
export function promoteAutoMarkedByProcessMatch(
  tree: CspLayer[],
  processTable: ProcessFolderEntry[],
): CspLayer[] {
  if (processTable.length === 0) return tree

  const processNames = new Set<string>()
  for (const entry of processTable) {
    for (const name of entry.folderNames) {
      const normalized = name.trim().toLowerCase()
      if (normalized.length > 0) processNames.add(normalized)
    }
  }
  if (processNames.size === 0) return tree

  function hasDirectProcessChild(children: CspLayer[]): boolean {
    return children.some(c =>
      c.isFolder && processNames.has(c.originalName.trim().toLowerCase())
    )
  }

  // ボトムアップ走査。戻り値は変更後レイヤーと、子孫に昇格を含むかのフラグ。
  function walk(
    layer: CspLayer,
    insideAnimFolder: boolean,
  ): { next: CspLayer; hasPromotedDescendant: boolean; changed: boolean } {
    const nextInside = insideAnimFolder || layer.isAnimationFolder
    const childResults = layer.children.map(c => walk(c, nextInside))
    const anyChildChanged = childResults.some(r => r.changed)
    const newChildren = anyChildChanged ? childResults.map(r => r.next) : layer.children
    const childHasPromoted = childResults.some(r => r.hasPromotedDescendant)

    const shouldPromote =
      !insideAnimFolder &&
      !layer.isAnimationFolder &&
      layer.autoMarked &&
      layer.isFolder &&
      !childHasPromoted &&
      hasDirectProcessChild(newChildren)

    if (shouldPromote) {
      return {
        next: {
          ...layer,
          children: newChildren,
          isAnimationFolder: true,
          autoMarked: false,
          animationFolder: { detectedBy: 'autoProcess', trackName: layer.originalName },
        },
        hasPromotedDescendant: true,
        changed: true,
      }
    }

    if (anyChildChanged) {
      return {
        next: { ...layer, children: newChildren },
        hasPromotedDescendant: childHasPromoted,
        changed: true,
      }
    }

    return { next: layer, hasPromotedDescendant: childHasPromoted, changed: false }
  }

  const topResults = tree.map(l => walk(l, false))
  const anyChanged = topResults.some(r => r.changed)
  return anyChanged ? topResults.map(r => r.next) : tree
}

/**
 * PSDオブジェクトからCspLayerツリーを構築する
 *
 * 注: XDTS を渡しても anim folder 検出は行わない。呼び出し側が
 * detectAnimationFoldersByXdts を明示的に呼ぶこと(その返り値で
 * unmatchedTracks 警告等を受け取れる)。
 * 後方互換のため xdts 引数は受け取るが現在は使用していない(将来の拡張用に残す)。
 */
export function buildLayerTree(
  psd: Psd,
  _xdts?: XdtsData,
  archivePatterns: string[] = []
): CspLayer[] {
  // ag-psdはボトムファースト順で返すので逆順にしてPhotoshop UI順（トップファースト）に統一する
  const children = (psd.children ?? []).slice().reverse()
  const tree = children.map(layer => convertLayer(layer, null, 0, false, archivePatterns))

  // クリスタが自動生成する「用紙」レイヤー（最下層）を自動的に非表示に設定する。
  // 白背景として合成されてしまうため、PNG透過出力時に意図しない結果を防ぐ。
  const bottom = tree[tree.length - 1]
  if (bottom && !bottom.isFolder && bottom.originalName === '用紙') {
    bottom.uiHidden = true
  }

  return tree
}
