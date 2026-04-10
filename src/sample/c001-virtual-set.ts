import type { CspLayer, VirtualSet } from '../types'

export const C001_VIRTUAL_SET_NAME = '仮想セルテスト'
export const C001_VIRTUAL_SET_PNG = `${C001_VIRTUAL_SET_NAME}.png`
export const C001_VIRTUAL_SET_JPG = `${C001_VIRTUAL_SET_NAME}.jpg`

type LayerPath = readonly string[]

interface PathVirtualSetMember {
  layerPath: LayerPath
  blendMode: string | null
  opacity: number | null
}

interface PathVirtualSetFixture {
  id: string
  name: string
  insertionLayerPath: LayerPath | null
  insertionPosition: 'above' | 'below'
  members: readonly PathVirtualSetMember[]
  expandToAnimationCells: boolean
  visibilityOverrides: ReadonlyArray<{
    layerPath: LayerPath
    visible: boolean
  }>
}

const C001_VIRTUAL_SET_FIXTURES: readonly PathVirtualSetFixture[] = [
  {
    id: '0b40dcc7-2922-4bef-8282-8ab894e3f66c',
    name: C001_VIRTUAL_SET_NAME,
    insertionLayerPath: ['_撮影指示'],
    insertionPosition: 'above',
    members: [
      { layerPath: ['LO', '作画', 'B'], blendMode: null, opacity: null },
      { layerPath: ['LO', '作画', 'A'], blendMode: null, opacity: null },
      { layerPath: ['_原図'], blendMode: null, opacity: null },
    ],
    expandToAnimationCells: false,
    visibilityOverrides: [
      { layerPath: ['LO', '作画', 'A'], visible: true },
      { layerPath: ['LO', '作画', 'A', '1'], visible: true },
      { layerPath: ['LO', '作画', 'A', '1', './[LO]/[作画]/[A]/[1]/線画'], visible: true },
      { layerPath: ['LO', '作画', 'B'], visible: true },
      { layerPath: ['LO', '作画', 'B', '1'], visible: true },
      { layerPath: ['LO', '作画', 'B', '1', '_s'], visible: false },
      { layerPath: ['LO', '作画', 'B', '1', '_s', '作監修正用紙'], visible: true },
      { layerPath: ['LO', '作画', 'B', '1', '_s', './[LO]/[作画]/[B]/[1]/[_s]/作監修正'], visible: true },
      { layerPath: ['LO', '作画', 'B', '1', './[LO]/[作画]/[B]/[1]/線画1'], visible: true },
      { layerPath: ['LO', '作画', 'B', '1', '影'], visible: true },
      { layerPath: ['LO', '作画', 'B', '1', '影', './[LO]/[作画]/[B]/[1]/[影]/影1'], visible: true },
      { layerPath: ['LO', '作画', 'B', '1', '影', './[LO]/[作画]/[B]/[1]/[影]/影2'], visible: true },
      { layerPath: ['_原図'], visible: true },
      { layerPath: ['_原図', '_BOOK1'], visible: true },
      { layerPath: ['_原図', '_BOOK1', './[_原図]/[_BOOK1]/BOOK1'], visible: true },
      { layerPath: ['_原図', '_BG'], visible: true },
      { layerPath: ['_原図', '_BG', './[_原図]/[_BG]/BG1'], visible: true },
    ],
  },
]

export function buildC001VirtualSets(tree: CspLayer[]): VirtualSet[] {
  return C001_VIRTUAL_SET_FIXTURES.map(fixture => ({
    id: fixture.id,
    name: fixture.name,
    insertionLayerId: fixture.insertionLayerPath === null
      ? null
      : findLayerByPath(tree, fixture.insertionLayerPath).id,
    insertionPosition: fixture.insertionPosition,
    members: fixture.members.map(member => ({
      layerId: findLayerByPath(tree, member.layerPath).id,
      blendMode: member.blendMode,
      opacity: member.opacity,
    })),
    expandToAnimationCells: fixture.expandToAnimationCells,
    visibilityOverrides: Object.fromEntries(
      fixture.visibilityOverrides.map(({ layerPath, visible }) => [
        findLayerByPath(tree, layerPath).id,
        visible,
      ]),
    ),
  }))
}

function findLayerByPath(layers: CspLayer[], layerPath: LayerPath): CspLayer {
  if (layerPath.length === 0) {
    throw new Error('C001 virtual set fixture path must not be empty')
  }

  let scope = layers
  let found: CspLayer | undefined

  for (let i = 0; i < layerPath.length; i++) {
    const segment = layerPath[i]
    const matches = scope.filter(layer => layer.originalName === segment)
    if (matches.length !== 1) {
      const available = scope.map(layer => layer.originalName).join(', ')
      throw new Error(
        `C001 virtual set fixture path ${formatLayerPath(layerPath)} ` +
        `failed at ${formatLayerPath(layerPath.slice(0, i + 1))}: ` +
        `expected 1 match for "${segment}", got ${matches.length}. ` +
        `Available siblings: ${available}`,
      )
    }

    found = matches[0]
    scope = found.children
  }

  if (found === undefined) {
    throw new Error(`C001 virtual set fixture path ${formatLayerPath(layerPath)} did not resolve`)
  }
  return found
}

function formatLayerPath(layerPath: LayerPath): string {
  return `./${layerPath.map(segment => `[${segment}]`).join('/')}`
}
