import type { CspLayer, FlatLayer, OutputEntry, ProjectSettings } from '../types'
import type { VirtualSet } from '../types/marks'
import { flattenTree } from './flatten'
import { applyLayerMask, compositeGroup, compositeStack, createCanvas } from './compositor'
import { collectMembersInTreeOrder, buildMemberFlatsWithOverride } from '../utils/virtual-set-utils'

/**
 * アニメーションフォルダからセルを抽出してOutputEntry[]を返す
 *
 * lowerContextLayers: セルの下に合成するコンテキスト（レイアウト用紙・撮影指示等）
 * upperContextLayers: セルの上に合成するコンテキスト（アニメフォルダより上にある兄弟レイヤー等）
 * parentSuffix: ルート直下の親フォルダがprocessTableにマッチした場合のサフィックス
 * hierarchyFolder: 階層出力時のフォルダ名（衝突解決済み）
 *
 * セルの種別は構造から自動判定する:
 * - 直接子が単体レイヤー → そのまま1セルとして出力（XDTSキーフレーム画像）
 * - 直接子がフォルダ    → processTableと照合し、マッチ=工程別出力・非マッチ=本体合成
 */
export function extractCells(
  animFolder: CspLayer,
  projectSettings: ProjectSettings,
  docWidth: number,
  docHeight: number,
  lowerContextLayers: FlatLayer[],
  parentSuffix = '',
  hierarchyFolder?: string,
  background: 'white' | 'transparent' = 'white',
  upperContextLayers: FlatLayer[] = [],
): OutputEntry[] {
  if (!animFolder.isAnimationFolder) return []

  const folderName = hierarchyFolder ?? animFolder.originalName
  const visibleChildren = animFolder.children.filter(c => !c.hidden && !c.uiHidden)
  const folderNameToSuffix = buildFolderNameToSuffixMap(projectSettings.processTable)
  const namingMode = projectSettings.cellNamingMode ?? 'sequence'
  const entries: OutputEntry[] = []

  for (let cellIdx = 0; cellIdx < visibleChildren.length; cellIdx++) {
    const cell = visibleChildren[cellIdx]
    const trackName = animFolder.originalName
    const cellLabel = namingMode === 'sequence'
      ? String(visibleChildren.length - cellIdx).padStart(4, '0')
      : cell.originalName

    if (!cell.isFolder) {
      // 単体レイヤー: XDTSキーフレーム画像 → そのまま1セル出力
      // 単体セルレイヤーはアニメフォルダの直接の子として構造的コンテナ扱い（100%）
      const rawFlats = flattenCellContent([cell], docWidth, docHeight, new Set([cell.id]))
      const cellFlats = applyContainerMasks(rawFlats, cell, animFolder, docWidth, docHeight)
      const canvas = compositeWithContext(cellFlats, lowerContextLayers, upperContextLayers, docWidth, docHeight, background)
      const fileName = `${trackName}_${cellLabel}${parentSuffix}.jpg`
      entries.push({
        path: `${folderName}/${fileName}`,
        flatName: fileName,
        canvas,
        sourceLayerId: cell.id,
      })
    } else {
      // フォルダ: processTableと照合して工程別 or 本体合成
      const visibleSubs = cell.children.filter(c => !c.hidden && !c.uiHidden)

      const processGroups = new Map<string, CspLayer[]>()
      const bodyLayers: CspLayer[] = []

      for (const sub of visibleSubs) {
        const suffix = sub.isFolder
          ? folderNameToSuffix.get(sub.originalName.toLowerCase())
          : undefined
        if (suffix !== undefined) {
          const group = processGroups.get(suffix) ?? []
          group.push(sub)
          processGroups.set(suffix, group)
        } else {
          bodyLayers.push(sub)
        }
      }

      // 本体（processTableに非マッチ、または工程フォルダが存在しない場合）
      // bodyLayersはアートワークコンテンツ → オパシティを尊重（ignoreOpacityIds不要）
      if (bodyLayers.length > 0 || processGroups.size === 0) {
        const rawBodyFlats = flattenCellContent(bodyLayers, docWidth, docHeight)
        const bodyFlats = applyContainerMasks(rawBodyFlats, cell, animFolder, docWidth, docHeight)
        const canvas = compositeWithContext(bodyFlats, lowerContextLayers, upperContextLayers, docWidth, docHeight, background)
        const fileName = `${trackName}_${cellLabel}${parentSuffix}.jpg`
        entries.push({
          path: `${folderName}/${fileName}`,
          flatName: fileName,
          canvas,
          sourceLayerId: cell.id,
        })
      }

      // 工程別出力
      // 工程フォルダ本体は構造的コンテナとして100%、中身のアートワークはオパシティを尊重
      for (const [suffix, processLayers] of processGroups) {
        const processIgnoreIds = new Set(processLayers.map(p => p.id))
        const rawProcessFlats = flattenCellContent(processLayers, docWidth, docHeight, processIgnoreIds)
        const processFlats = applyContainerMasks(rawProcessFlats, cell, animFolder, docWidth, docHeight)
        const canvas = compositeWithContext(processFlats, lowerContextLayers, upperContextLayers, docWidth, docHeight, background)
        const fileName = `${trackName}_${cellLabel}${parentSuffix}${suffix}.jpg`
        entries.push({
          path: `${folderName}/${fileName}`,
          flatName: fileName,
          canvas,
          sourceLayerId: processLayers[0].id,
        })
      }
    }
  }

  return entries
}

/**
 * フォルダ名→サフィックスのルックアップマップを構築（小文字化済み）
 */
function buildFolderNameToSuffixMap(
  processTable: ProjectSettings['processTable']
): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of processTable) {
    for (const folderName of entry.folderNames) {
      map.set(folderName.toLowerCase(), entry.suffix)
    }
  }
  return map
}

/**
 * アニメフォルダIDへのparentSuffixマップを構築する
 *
 * ツリー全体を走査し、アニメフォルダの「直接の親フォルダ名」が
 * processTableにマッチする場合にsuffixを付与する。
 *
 * 例: LO/演出/B → Bの直接親は"演出" → suffix "_en"
 *     LO/LO/A  → Aの直接親は"LO"  → processTable未登録 → suffix なし
 */
function buildAnimParentSuffixMap(
  rootLayers: CspLayer[],
  folderNameToSuffix: Map<string, string>,
): Map<string, string> {
  const map = new Map<string, string>()

  function walk(layers: CspLayer[]): void {
    for (const layer of layers) {
      if (!layer.isFolder) continue
      // このフォルダ直下のアニメフォルダに、このフォルダ名に対応するsuffixを付与
      const suffix = folderNameToSuffix.get(layer.originalName.toLowerCase())
      if (suffix !== undefined) {
        for (const child of layer.children) {
          if (child.isAnimationFolder) {
            map.set(child.id, suffix)
          }
        }
      }
      walk(layer.children)
    }
  }

  walk(rootLayers)
  return map
}

/**
 * アニメフォルダIDから階層出力フォルダ名へのマップを構築する
 * 衝突する場合は -2, -3 ... を末尾に付加する
 */
function buildAnimHierarchyFolderMap(
  tree: CspLayer[],
  animParentSuffixMap: Map<string, string>,
): Map<string, string> {
  const usedBaseNameCounts = new Map<string, number>()
  const map = new Map<string, string>()

  function assign(layers: CspLayer[]): void {
    for (const layer of layers) {
      if (layer.hidden || layer.uiHidden) continue
      if (layer.isAnimationFolder) {
        const parentSuffix = animParentSuffixMap.get(layer.id) ?? ''
        const baseName = `${layer.originalName}${parentSuffix}`
        const count = usedBaseNameCounts.get(baseName) ?? 0
        const folderName = count === 0 ? baseName : `${baseName}-${count + 1}`
        usedBaseNameCounts.set(baseName, count + 1)
        map.set(layer.id, folderName)
      } else if (layer.isFolder) {
        assign(layer.children)
      }
    }
  }

  assign(tree)
  return map
}

/**
 * フラットファイル名の衝突を解決する（-2, -3 を拡張子前に挿入）
 */
function resolveFlatNameCollisions(entries: OutputEntry[]): void {
  const countMap = new Map<string, number>()
  for (const e of entries) {
    countMap.set(e.flatName, (countMap.get(e.flatName) ?? 0) + 1)
  }

  const seenMap = new Map<string, number>()
  for (const e of entries) {
    const total = countMap.get(e.flatName) ?? 1
    if (total <= 1) continue

    const seen = seenMap.get(e.flatName) ?? 0
    seenMap.set(e.flatName, seen + 1)
    if (seen === 0) continue  // 最初の出現はそのまま

    const dotIdx = e.flatName.lastIndexOf('.')
    const base = e.flatName.slice(0, dotIdx)
    const ext = e.flatName.slice(dotIdx)
    const newFlatName = `${base}-${seen + 1}${ext}`
    // pathのファイル名部分も更新
    const slashIdx = e.path.lastIndexOf('/')
    e.flatName = newFlatName
    e.path = slashIdx >= 0
      ? `${e.path.slice(0, slashIdx + 1)}${newFlatName}`
      : newFlatName
  }
}

/**
 * 仮想セルの挿入位置を基準に上下コンテキストを収集する。
 *
 * collectLocalSiblingContext と同じ再帰アルゴリズムで、
 * insertionLayerId を基準点として上下コンテキストを分類する。
 *
 * 'above': VS は insertionLayer の直上（VS の下 = insertionLayer + それより下の兄弟）
 * 'below': VS は insertionLayer の直下（VS の上 = insertionLayer + それより上の兄弟）
 *
 * アニメーションフォルダ・アニメ子孫フォルダは除外（自身の出力ロジックで別途処理）。
 */
function collectVsContextFlats(
  insertionLayerId: string,
  insertionPosition: 'above' | 'below',
  tree: CspLayer[],
  docWidth: number,
  docHeight: number,
): { lower: FlatLayer[], upper: FlatLayer[] } {
  const lowerStack: FlatLayer[][] = []
  const upperStack: FlatLayer[][] = []

  function findAndCollect(layers: CspLayer[]): boolean {
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]

      if (layer.id === insertionLayerId) {
        // 挿入レイヤーを発見: 同レベルの兄弟を上下に分類する
        // 'above': VS の実効位置 = i-0.5 → j<i が upper、j>=i が lower（挿入レイヤー含む）
        // 'below': VS の実効位置 = i+0.5 → j<=i が upper（挿入レイヤー含む）、j>i が lower
        const lowerCsps: CspLayer[] = []
        const upperCsps: CspLayer[] = []

        for (let j = 0; j < layers.length; j++) {
          const sib = layers[j]
          if (sib.hidden || sib.uiHidden) continue
          if (sib.isAnimationFolder || hasAnimFolderDescendant(sib)) continue

          const isUpper = insertionPosition === 'above' ? j < i : j <= i
          if (isUpper) upperCsps.push(sib)
          else lowerCsps.push(sib)
        }

        lowerStack.push(flattenTree(lowerCsps, docWidth, docHeight))
        upperStack.push(flattenTree(upperCsps, docWidth, docHeight))
        return true
      }

      // フォルダを再帰探索（isAnimationFolder も探索対象に含める）
      if (layer.isFolder && findAndCollect(layer.children)) {
        // パス要素（layer）の兄弟を位置で分類して積む
        const lowerCsps: CspLayer[] = []
        const upperCsps: CspLayer[] = []

        for (let j = 0; j < layers.length; j++) {
          if (j === i) continue
          const sib = layers[j]
          if (sib.hidden || sib.uiHidden) continue
          if (sib.isAnimationFolder || hasAnimFolderDescendant(sib)) continue

          if (j < i) upperCsps.push(sib)
          else lowerCsps.push(sib)
        }

        lowerStack.push(flattenTree(lowerCsps, docWidth, docHeight))
        upperStack.push(flattenTree(upperCsps, docWidth, docHeight))
        return true
      }
    }
    return false
  }

  findAndCollect(tree)

  // lowerStack: [最内側...最外側] → 外側から描画するため逆順に展開
  const lower = [...lowerStack].reverse().flat()
  // upperStack: [最内側...最外側] → 内側から描画（内側がVS直上）
  const upper = upperStack.flat()

  return { lower, upper }
}

/**
 * 仮想セルを OutputEntry として抽出する。
 *
 * 各仮想セルについて:
 * 1. insertionLayerId を基準に上下コンテキストを収集
 * 2. メンバーレイヤーを buildMemberFlatsWithOverride でフラット化
 * 3. compositeWithContext で合成して OutputEntry を生成
 *
 * insertionLayerId が未設定またはメンバーが空の仮想セルはスキップする。
 */
export function extractVirtualSetEntries(
  tree: CspLayer[],
  virtualSets: VirtualSet[],
  docWidth: number,
  docHeight: number,
  background: 'white' | 'transparent' = 'white',
): OutputEntry[] {
  const entries: OutputEntry[] = []

  for (const vs of virtualSets) {
    if (!vs.insertionLayerId || vs.members.length === 0) continue

    // 挿入位置から上下コンテキストを収集
    const { lower, upper } = collectVsContextFlats(
      vs.insertionLayerId,
      vs.insertionPosition,
      tree,
      docWidth,
      docHeight,
    )

    // VSメンバーをフラット化（visibilityOverrides・blendModeオーバーライド適用済み）
    const memberIds = new Set(vs.members.map(m => m.layerId))
    const memberLayers = collectMembersInTreeOrder(tree, memberIds)
    const vsFlats = buildMemberFlatsWithOverride(
      vs.members, memberLayers, docWidth, docHeight, vs.visibilityOverrides
    )

    if (vsFlats.length === 0 && lower.length === 0 && upper.length === 0) continue

    // VSメンバーをフォルダと同様に隔離合成してから配置する
    // （パススルーではなく非パススルーフォルダと同じ挙動）
    const vsComposite = compositeGroup(vsFlats, docWidth, docHeight)
    const vsAsFolder: FlatLayer[] = [{
      canvas: vsComposite,
      blendMode: 'normal',
      opacity: 100,
      top: 0,
      left: 0,
      sourceId: vs.id,
      clipping: false,
    }]
    const canvas = compositeWithContext(vsAsFolder, lower, upper, docWidth, docHeight, background)
    const fileName = `${vs.name}.jpg`
    entries.push({
      path: fileName,
      flatName: fileName,
      canvas,
      sourceLayerId: vs.id,
    })
  }

  resolveFlatNameCollisions(entries)
  return entries
}

/**
 * セルフラットにセルフォルダ・アニメフォルダのマスクを適用する。
 *
 * global preview（flattenLayer経由）と一致させるため:
 * - 非Pass Throughセルフォルダのマスクを先に適用（対象はフォルダセルのみ）
 * - アニメフォルダのマスクをその外側に適用
 *
 * Pass Throughセルフォルダのマスクは flattenLayer と同様にスキップ（v1制限）。
 */
function applyContainerMasks(
  flats: FlatLayer[],
  cell: CspLayer,
  animFolder: CspLayer,
  docWidth: number,
  docHeight: number,
): FlatLayer[] {
  let result = flats
  if (result.length === 0) return result

  // セルフォルダのマスク（非pass-throughフォルダセルのみ）
  if (cell.isFolder && cell.blendMode !== 'pass through') {
    const cellMask = cell.agPsdRef.mask
    if (cellMask?.canvas && !cellMask.disabled) {
      const composited = compositeGroup(result, docWidth, docHeight)
      const masked = applyLayerMask(composited, 0, 0, cellMask, docWidth, docHeight)
      result = [{ canvas: masked, blendMode: 'normal', opacity: 100, top: 0, left: 0, sourceId: cell.id, clipping: false }]
    }
  }

  // アニメフォルダのマスク
  const animMask = animFolder.agPsdRef.mask
  if (animMask?.canvas && !animMask.disabled) {
    const composited = compositeGroup(result, docWidth, docHeight)
    const masked = applyLayerMask(composited, 0, 0, animMask, docWidth, docHeight)
    result = [{ canvas: masked, blendMode: 'normal', opacity: 100, top: 0, left: 0, sourceId: animFolder.id, clipping: false }]
  }

  return result
}

/**
 * セルのレイヤー群をFlatLayerに変換（内部合成）
 *
 * ignoreOpacityIds: 不透明度を100%として扱うレイヤーID（工程フォルダ本体・単体セルレイヤー等）
 */
function flattenCellContent(
  layers: CspLayer[],
  docWidth: number,
  docHeight: number,
  ignoreOpacityIds?: Set<string>,
): FlatLayer[] {
  return flattenTree(layers, docWidth, docHeight, undefined, ignoreOpacityIds)
}

/**
 * セルFlats + コンテキストFlatsを合成して最終キャンバスを返す
 *
 * 合成順: lowerContext（セルより下）→ cellFlats → upperContext（セルより上）
 *
 * lowerContext: レイアウト用紙・背景・アニメフォルダより下にある兄弟レイヤー
 * upperContext: アニメフォルダより上にある兄弟レイヤー（セルの上に重なる）
 */
function compositeWithContext(
  cellFlats: FlatLayer[],
  lowerContext: FlatLayer[],
  upperContext: FlatLayer[],
  docWidth: number,
  docHeight: number,
  background: 'white' | 'transparent' = 'white',
): HTMLCanvasElement {
  if (cellFlats.length === 0 && lowerContext.length === 0 && upperContext.length === 0) {
    return createCanvas(docWidth, docHeight)
  }
  const allFlats = [...lowerContext, ...cellFlats, ...upperContext]
  return compositeStack(allFlats, docWidth, docHeight, background)
}

/**
 * layers[targetIdx] の兄弟を、targetIdx との位置関係で lower/upper に分割してフラット化する。
 *
 * lower: targetIdx より下（インデックス大）にある兄弟 → セルの下に合成
 * upper: targetIdx より上（インデックス小）にある兄弟 → セルの上に合成
 *
 * アニメフォルダ・アニメ子孫を持つフォルダは除外（それらは別途処理される）。
 */
function splitSiblingsByPosition(
  layers: CspLayer[],
  targetIdx: number,
  docWidth: number,
  docHeight: number,
): [lower: FlatLayer[], upper: FlatLayer[]] {
  const lowerCsps: CspLayer[] = []
  const upperCsps: CspLayer[] = []
  for (let j = 0; j < layers.length; j++) {
    if (j === targetIdx) continue
    const sib = layers[j]
    if (sib.hidden || sib.uiHidden) continue
    if (sib.isAnimationFolder || hasAnimFolderDescendant(sib)) continue
    if (sib.autoMarked || sib.singleMark) continue  // マーク済みはアニメセルのコンテキストに含めない
    if (j < targetIdx) upperCsps.push(sib)  // 上にある → セルの上に描画
    else lowerCsps.push(sib)                   // 下にある → セルの下に描画
  }
  return [
    flattenTree(lowerCsps, docWidth, docHeight),
    flattenTree(upperCsps, docWidth, docHeight),
  ]
}

/**
 * _プレフィックスフォルダ・シングルマークをOutputEntryとして抽出する
 */
export function extractMarkedLayers(
  tree: CspLayer[],
  docWidth: number,
  docHeight: number,
): OutputEntry[] {
  const entries: OutputEntry[] = []

  function walk(layers: CspLayer[], contextFlats: FlatLayer[]): void {
    for (const layer of layers) {
      if (layer.hidden || layer.uiHidden) continue

      if (layer.autoMarked || layer.singleMark) {
        const layerFlats = flattenTree([layer], docWidth, docHeight)
        const canvas = compositeWithContext(layerFlats, contextFlats, [], docWidth, docHeight)
        const fileName = `${layer.originalName}.jpg`
        entries.push({
          path: fileName,
          flatName: fileName,
          canvas,
          sourceLayerId: layer.id,
        })
      }

      if (layer.isFolder && !layer.isAnimationFolder) {
        walk(layer.children, contextFlats)
      }
    }
  }

  walk(tree, [])
  return entries
}

/**
 * 全出力エントリを生成（全出力モード）
 *
 * - ルート直下フォルダのprocessTable逆引きでparentSuffixを決定
 * - 階層フォルダ名の衝突は -2, -3 で解決
 * - フラットファイル名の衝突も -2, -3 で解決
 *
 * アニメフォルダの兄弟レイヤーは位置に応じて lower/upper コンテキストに分類する:
 * - アニメフォルダより下（インデックス大）にある兄弟 → セルの下に合成
 * - アニメフォルダより上（インデックス小）にある兄弟 → セルの上に合成
 * 複数階層のアニメ包含フォルダが入れ子になる場合も、各レベルで正しく分類して積み上げる。
 */
export function extractAllEntries(
  tree: CspLayer[],
  projectSettings: ProjectSettings,
  docWidth: number,
  docHeight: number,
  background: 'white' | 'transparent' = 'white',
): OutputEntry[] {
  const entries: OutputEntry[] = []

  const folderNameToSuffix = buildFolderNameToSuffixMap(projectSettings.processTable)
  const animParentSuffixMap = buildAnimParentSuffixMap(tree, folderNameToSuffix)
  const animHierarchyFolderMap = buildAnimHierarchyFolderMap(tree, animParentSuffixMap)

  /**
   * inheritedLower: 祖先フォルダから継承されたlowerコンテキスト（外→内の順）
   * inheritedUpper: 祖先フォルダから継承されたupperコンテキスト（内→外の順）
   *
   * 各アニメ包含フォルダを経由するたびに、そのフォルダ内での兄弟の位置を
   * 判定してinheritedLower/Upperに追加していく。
   */
  function walk(layers: CspLayer[], inheritedLower: FlatLayer[], inheritedUpper: FlatLayer[]): void {
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]
      if (layer.hidden || layer.uiHidden) continue

      if (layer.isAnimationFolder && !layer.autoMarked && !layer.singleMark) {
        // マーク済みでないアニメフォルダ: セルを抽出して出力
        // autoMarked/singleMark が同時に設定されている場合（_プレフィックス + XDTSトラック一致）は
        // 単体マーク出力として扱うため、このブランチをスキップする
        const [localLower, localUpper] = splitSiblingsByPosition(layers, i, docWidth, docHeight)
        const thisLower = [...inheritedLower, ...localLower]
        const thisUpper = [...localUpper, ...inheritedUpper]

        const parentSuffix = animParentSuffixMap.get(layer.id) ?? ''
        const hierarchyFolder = animHierarchyFolderMap.get(layer.id) ?? layer.originalName
        const cellEntries = extractCells(
          layer, projectSettings, docWidth, docHeight, thisLower,
          parentSuffix, hierarchyFolder, background,
          thisUpper,
        )
        entries.push(...cellEntries)
        continue
      }

      if (layer.autoMarked || layer.singleMark) {
        // プレビューと同じ collectMarkedLayerContext を使って合成コンテキストを取得する。
        // walk の inheritedLower/Upper に依存せず、ツリー全体から正しく upper/lower を収集するため
        // ネストされていても必ず一致した結果になる。
        const { lower, upper } = collectMarkedLayerContext(layer.id, tree, docWidth, docHeight)
        const layerFlats = flattenTree([layer], docWidth, docHeight)
        const canvas = compositeWithContext(layerFlats, lower, upper, docWidth, docHeight, background)
        const fileName = `${layer.originalName}.jpg`
        entries.push({ path: fileName, flatName: fileName, canvas, sourceLayerId: layer.id })

        // フォルダなら子も走査して内包マーク済みレイヤーを出力する。
        // 各子マーク済みレイヤーは独立して collectMarkedLayerContext を呼ぶので
        // 継承コンテキストを渡す必要はない。
        if (layer.isFolder) {
          walk(layer.children, [], [])
        }
        continue
      }

      if (layer.isFolder) {
        if (hasAnimFolderDescendant(layer)) {
          // アニメ包含フォルダ: 兄弟を分類して継承コンテキストとして子に渡す
          const [localLower, localUpper] = splitSiblingsByPosition(layers, i, docWidth, docHeight)
          walk(
            layer.children,
            [...inheritedLower, ...localLower],
            [...localUpper, ...inheritedUpper],
          )
        } else {
          walk(layer.children, inheritedLower, inheritedUpper)
        }
      }
    }
  }

  walk(tree, [], [])
  resolveFlatNameCollisions(entries)
  return entries
}

/**
 * グローバルコンテキスト用ソースレイヤーを収集する。
 *
 * アニメフォルダ・アニメ子孫を持つフォルダは除外。
 * 対象はアニメとは無関係なルート直下のレイヤー群（レイアウト用紙・撮影指示・背景原図等）。
 *
 * アニメ子孫フォルダ（演出工程等）内の非アニメレイヤーは
 * そのフォルダ内のアニメフォルダ専用のローカルコンテキストであり、
 * ここには含めない（含めると全アニメフォルダに誤って合成される）。
 */
export function collectContextSourceLayers(layers: CspLayer[]): CspLayer[] {
  const result: CspLayer[] = []
  for (const layer of layers) {
    if (layer.hidden || layer.uiHidden) continue
    if (layer.isAnimationFolder) continue
    // マーク済みレイヤーはグローバルコンテキストに含めない。
    // アニメセルへの合成は splitSiblingsByPosition で兄弟として正しく処理される。
    if (layer.autoMarked || layer.singleMark) continue
    if (!hasAnimFolderDescendant(layer)) {
      result.push(layer)
    }
    // アニメ子孫を持つフォルダはグローバルコンテキストから除外
    // （内部の非アニメレイヤーはcollectLocalSiblingContextで取得）
  }
  return result
}

/**
 * 指定したアニメフォルダのローカルコンテキスト（兄弟非アニメレイヤー）を
 * lower（セルの下）と upper（セルの上）に分けて収集する。
 *
 * ルートから対象フォルダへのパス上の各アニメ包含フォルダ内にある、
 * パス外・非アニメ・アニメ子孫なしの直接子レイヤーを収集し、
 * パス要素（またはアニメフォルダ）より上か下かで lower/upper に分類する。
 *
 * スタックはfindAndCollect再帰の巻き戻し順（内側→外側）で積まれるため、
 * lower は外→内の順に並べ（外側から先に描画）、
 * upper は内→外の順に並べる（内側から先に描画 = 外側が最上位）。
 */
export function collectLocalSiblingContext(
  animFolderId: string,
  tree: CspLayer[],
  docWidth: number,
  docHeight: number,
): { lower: FlatLayer[], upper: FlatLayer[] } {
  // findAndCollectの再帰巻き戻し順（内側→外側）で積む
  const lowerStack: FlatLayer[][] = []
  const upperStack: FlatLayer[][] = []

  function findAndCollect(layers: CspLayer[]): boolean {
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]

      const isTarget = layer.id === animFolderId
      const isPathElement = !isTarget && layer.isFolder && hasAnimFolderDescendant(layer)

      if (isTarget || (isPathElement && findAndCollect(layer.children))) {
        // このレベルでパス要素（またはアニメフォルダ）を発見
        // 同レベルの兄弟を位置で lower/upper に分類
        const lowerCsps: CspLayer[] = []
        const upperCsps: CspLayer[] = []
        for (let j = 0; j < layers.length; j++) {
          if (j === i) continue
          const sib = layers[j]
          if (sib.hidden || sib.uiHidden) continue
          if (sib.isAnimationFolder || hasAnimFolderDescendant(sib)) continue
          if (sib.autoMarked || sib.singleMark) continue  // マーク済みはアニメセルのコンテキストに含めない
          if (j < i) upperCsps.push(sib)  // 上にある → upper
          else lowerCsps.push(sib)          // 下にある → lower
        }
        lowerStack.push(flattenTree(lowerCsps, docWidth, docHeight))
        upperStack.push(flattenTree(upperCsps, docWidth, docHeight))
        return true
      }
    }
    return false
  }

  findAndCollect(tree)

  // lowerStack: [innermost, ..., outermost]（内側→外側の順）
  // lower配列: 外側から描画（外側が下、内側がセル直下） → reverse して flat
  const lower = [...lowerStack].reverse().flat()

  // upperStack: [innermost, ..., outermost]
  // upper配列: 内側から描画（内側がセル直上、外側が最上位） → そのまま flat
  const upper = upperStack.flat()

  return { lower, upper }
}

/**
 * マーク済みレイヤーへのパス全段階でコンテキストを収集する。
 *
 * collectLocalSiblingContext と同じ再帰アルゴリズムを使い、
 * ルートから対象レイヤーへのパス上の各レベルで
 * 非マーク・非アニメの兄弟を upper/lower に分類して積む。
 *
 * これにより、対象レイヤーより上位の祖先フォルダの外にある層も
 * PSDのZ順（同レベルでの index 大小）に従って正しく upper/lower に配置できる。
 */
export function collectMarkedLayerContext(
  markedLayerId: string,
  tree: CspLayer[],
  docWidth: number,
  docHeight: number,
): { lower: FlatLayer[], upper: FlatLayer[] } {
  const lowerStack: FlatLayer[][] = []
  const upperStack: FlatLayer[][] = []

  function findAndCollect(layers: CspLayer[]): boolean {
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]
      const isTarget = layer.id === markedLayerId
      const isPathElement = !isTarget && layer.isFolder

      if (isTarget || (isPathElement && findAndCollect(layer.children))) {
        const lowerCsps: CspLayer[] = []
        const upperCsps: CspLayer[] = []
        for (let j = 0; j < layers.length; j++) {
          if (j === i) continue
          const sib = layers[j]
          if (sib.hidden || sib.uiHidden) continue
          if (sib.isAnimationFolder || hasAnimFolderDescendant(sib)) continue
          if (sib.autoMarked || sib.singleMark) continue
          if (j < i) upperCsps.push(sib)
          else lowerCsps.push(sib)
        }
        lowerStack.push(flattenTree(lowerCsps, docWidth, docHeight))
        upperStack.push(flattenTree(upperCsps, docWidth, docHeight))
        return true
      }
    }
    return false
  }

  findAndCollect(tree)

  // lowerStack: [innermost...outermost] → 外側から描画（外→内の順）→ reverse して flat
  const lower = [...lowerStack].reverse().flat()
  // upperStack: [innermost...outermost] → 内側から描画（内→外の順）→ そのまま flat
  const upper = upperStack.flat()
  return { lower, upper }
}

/**
 * ルート直下の親フォルダに基づくparentSuffixを取得する
 */
export function resolveParentSuffix(
  animFolderId: string,
  tree: CspLayer[],
  processTable: ProjectSettings['processTable'],
): string {
  const folderNameToSuffix = buildFolderNameToSuffixMap(processTable)
  const animParentSuffixMap = buildAnimParentSuffixMap(tree, folderNameToSuffix)
  return animParentSuffixMap.get(animFolderId) ?? ''
}

function hasAnimFolderDescendant(layer: CspLayer): boolean {
  if (layer.isAnimationFolder) return true
  return layer.children.some(hasAnimFolderDescendant)
}
