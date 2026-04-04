import type { CspLayer, FlatLayer, OutputEntry, ProjectSettings } from '../types'
import { flattenTree } from './flatten'
import { compositeStack, createCanvas } from './compositor'

/**
 * アニメーションフォルダからセルを抽出してOutputEntry[]を返す
 *
 * contextLayers: アニメフォルダ以外のルート直下レイヤー群（レイアウト用紙・撮影指示等）
 * これをアニメセルの下に敷いて合成する
 */
export function extractCells(
  animFolder: CspLayer,
  projectSettings: ProjectSettings,
  docWidth: number,
  docHeight: number,
  contextLayers: FlatLayer[],
): OutputEntry[] {
  if (!animFolder.isAnimationFolder || !animFolder.animationFolder) return []

  const { mode } = animFolder.animationFolder
  const visibleChildren = animFolder.children.filter(c => !c.hidden && !c.uiHidden)

  if (mode === 'normal') {
    return extractNormalMode(animFolder, visibleChildren, projectSettings, docWidth, docHeight, contextLayers)
  } else {
    return extractCellInclusiveMode(animFolder, visibleChildren, projectSettings, docWidth, docHeight, contextLayers)
  }
}

/**
 * 通常モード: 直下の各子が1セル
 * 子がフォルダなら内部を全合成して1枚に
 */
function extractNormalMode(
  animFolder: CspLayer,
  cells: CspLayer[],
  projectSettings: ProjectSettings,
  docWidth: number,
  docHeight: number,
  contextLayers: FlatLayer[],
): OutputEntry[] {
  const entries: OutputEntry[] = []
  const digits = projectSettings.sequenceDigits

  cells.forEach((cell, index) => {
    const seqNum = String(index + 1).padStart(digits, '0')
    const cellName = `${animFolder.originalName}_${seqNum}`

    // セルを1枚に合成
    const cellFlats = flattenCellContent([cell], docWidth, docHeight)
    const canvas = compositeWithContext(cellFlats, contextLayers, docWidth, docHeight)

    const fileName = `${cellName}.jpg`
    entries.push({
      path: `${animFolder.originalName}/${fileName}`,
      flatName: fileName,
      canvas,
      sourceLayerId: cell.id,
    })
  })

  return entries
}

/**
 * セル内包型モード:
 * - セルフォルダ内の子をprojectSettings.processTableと照合
 * - マッチ → 独立出力 (cellName_suffix.jpg)
 * - 非マッチ → セル本体として合成 (cellName.jpg)
 */
function extractCellInclusiveMode(
  animFolder: CspLayer,
  cellFolders: CspLayer[],
  projectSettings: ProjectSettings,
  docWidth: number,
  docHeight: number,
  contextLayers: FlatLayer[],
): OutputEntry[] {
  const entries: OutputEntry[] = []
  const { processTable } = projectSettings

  // フォルダ名→サフィックスのルックアップマップを構築
  const folderNameToSuffix = buildFolderNameToSuffixMap(processTable)

  for (const cellFolder of cellFolders) {
    if (!cellFolder.isFolder) {
      // セル内包型ではセルはフォルダであるべきだが、通常レイヤーも一応処理
      const flats = flattenCellContent([cellFolder], docWidth, docHeight)
      const canvas = compositeWithContext(flats, contextLayers, docWidth, docHeight)
      const fileName = `${cellFolder.originalName}.jpg`
      entries.push({
        path: `${animFolder.originalName}/${fileName}`,
        flatName: fileName,
        canvas,
        sourceLayerId: cellFolder.id,
      })
      continue
    }

    const cellName = cellFolder.originalName
    const visibleSubLayers = cellFolder.children.filter(c => !c.hidden && !c.uiHidden)

    // 工程フォルダと本体を分離
    const processGroups: Map<string, CspLayer[]> = new Map()
    const bodyLayers: CspLayer[] = []

    for (const sub of visibleSubLayers) {
      const suffix = sub.isFolder ? folderNameToSuffix.get(sub.originalName.toLowerCase()) : undefined
      if (suffix !== undefined) {
        const group = processGroups.get(suffix) ?? []
        group.push(sub)
        processGroups.set(suffix, group)
      } else {
        bodyLayers.push(sub)
      }
    }

    // セル本体を出力 (cellName.jpg)
    if (bodyLayers.length > 0) {
      const bodyFlats = flattenCellContent(bodyLayers, docWidth, docHeight)
      const canvas = compositeWithContext(bodyFlats, contextLayers, docWidth, docHeight)
      const fileName = `${cellName}.jpg`
      entries.push({
        path: `${animFolder.originalName}/${fileName}`,
        flatName: fileName,
        canvas,
        sourceLayerId: cellFolder.id,
      })
    }

    // 各工程フォルダを独立出力 (cellName_suffix.jpg)
    for (const [suffix, processLayers] of processGroups) {
      const processFlats = flattenCellContent(processLayers, docWidth, docHeight)
      const canvas = compositeWithContext(processFlats, contextLayers, docWidth, docHeight)
      const fileName = `${cellName}${suffix}.jpg`
      entries.push({
        path: `${animFolder.originalName}/${fileName}`,
        flatName: fileName,
        canvas,
        sourceLayerId: processLayers[0].id,
      })
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
 * セルのレイヤー群をFlatLayerに変換（内部合成）
 */
function flattenCellContent(
  layers: CspLayer[],
  docWidth: number,
  docHeight: number,
): FlatLayer[] {
  return flattenTree(layers, docWidth, docHeight)
}

/**
 * セルFlats + コンテキストFlats（レイアウト用紙等）を合成して最終キャンバスを返す
 * コンテキストはセルの下に配置（先に描画）
 */
function compositeWithContext(
  cellFlats: FlatLayer[],
  contextLayers: FlatLayer[],
  docWidth: number,
  docHeight: number,
): HTMLCanvasElement {
  if (cellFlats.length === 0 && contextLayers.length === 0) {
    return createCanvas(docWidth, docHeight)
  }
  // コンテキスト（背景）→ セルの順でスタック
  const allFlats = [...contextLayers, ...cellFlats]
  return compositeStack(allFlats, docWidth, docHeight, 'white')
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
        // このレイヤーを単独で出力（その階層でコンテキストと合成）
        const layerFlats = flattenTree([layer], docWidth, docHeight)
        const canvas = compositeWithContext(layerFlats, contextFlats, docWidth, docHeight)
        // 先頭の_を除いたファイル名
        const fileName = `${layer.name}.jpg`
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
 * アニメフォルダ→セル連番、その他の_プレフィックスフォルダ→単独出力
 */
export function extractAllEntries(
  tree: CspLayer[],
  projectSettings: ProjectSettings,
  docWidth: number,
  docHeight: number,
): OutputEntry[] {
  const entries: OutputEntry[] = []

  // ルート直下のコンテキスト（アニメフォルダ以外のフラット化済みレイヤー）
  const nonAnimRootLayers = tree.filter(l => !l.isAnimationFolder && !hasAnimFolderDescendant(l))
  const contextFlats = flattenTree(nonAnimRootLayers, docWidth, docHeight)

  function walk(layers: CspLayer[]): void {
    for (const layer of layers) {
      if (layer.hidden || layer.uiHidden) continue

      if (layer.isAnimationFolder) {
        const cellEntries = extractCells(layer, projectSettings, docWidth, docHeight, contextFlats)
        entries.push(...cellEntries)
        continue
      }

      if (layer.autoMarked || layer.singleMark) {
        const layerFlats = flattenTree([layer], docWidth, docHeight)
        const canvas = compositeWithContext(layerFlats, contextFlats, docWidth, docHeight)
        const fileName = `${layer.name}.jpg`
        entries.push({ path: fileName, flatName: fileName, canvas, sourceLayerId: layer.id })
      }

      if (layer.isFolder) {
        walk(layer.children)
      }
    }
  }

  walk(tree)
  return entries
}

function hasAnimFolderDescendant(layer: CspLayer): boolean {
  if (layer.isAnimationFolder) return true
  return layer.children.some(hasAnimFolderDescendant)
}
