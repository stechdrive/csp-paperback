import type { CspLayer } from '../types'
import { isAutoMarkedContainerOutputSuppressed } from './auto-marked-container'
import { isAutomaticOutputSuppressed } from './output-target'

export function describeOutputSource(layer: CspLayer, alias?: string): string {
  return alias === undefined ? layer.originalName : `${alias}（元: ${layer.originalName}）`
}

/** Output owners, independent of visibility and export exclusions. Never descend into cells. */
export function collectOutputAliasTargets(tree: CspLayer[]): Map<string, CspLayer> {
  const targets = new Map<string, CspLayer>()
  const walk = (layers: CspLayer[]) => {
    for (const layer of layers) {
      if (!isAutomaticOutputSuppressed(layer)) {
        if (layer.isAnimationFolder) {
          targets.set(layer.id, layer)
          continue
        }
        if ((layer.singleMark || layer.autoMarked) && !isAutoMarkedContainerOutputSuppressed(layer, true)) {
          targets.set(layer.id, layer)
        }
      }
      walk(layer.children)
    }
  }
  walk(tree)
  return targets
}
