import type { CspLayer } from '../types'
import { isAutoMarkedContainerOutputSuppressed } from './auto-marked-container'

export type LayerOutputRole = { kind: 'individual'; origin: 'automatic' | 'manual' }
  | { kind: 'animation'; origin: 'manual' | 'autoProcess' }

export function layerRoleLabel(role: LayerOutputRole): string {
  return role.kind === 'individual'
    ? role.origin === 'automatic' ? '単独出力（フォルダ名から自動指定）' : '単独出力（手動指定）'
    : role.origin === 'manual' ? 'アニメーションフォルダとして扱う（手動指定）' : 'アニメーションフォルダとして扱う（工程構成から自動指定）'
}

/** Derive badges from effective output precedence without storing duplicate state. */
export function resolveLayerRowState(layer: CspLayer, manualIndividual: boolean, insideAnimation = false) {
  const animationSource = layer.isAnimationFolder ? layer.animationFolder?.detectedBy : undefined
  const autoIndividual = !insideAnimation && !layer.isAnimationFolder && layer.autoMarked && !isAutoMarkedContainerOutputSuppressed(layer)
  const role: LayerOutputRole | undefined = layer.isAnimationFolder
    ? animationSource === 'manual' || animationSource === 'autoProcess' ? { kind: 'animation', origin: animationSource } : undefined
    : !insideAnimation && (autoIndividual || manualIndividual) ? { kind: 'individual', origin: manualIndividual ? 'manual' : 'automatic' } : undefined
  return { role, autoIndividual, animationSource }
}

export interface LayerAction {
  id: 'rename' | 'individual' | 'animation' | 'info' | 'remove' | 'quicklook' | 'newFolder'
  label: string
  checked?: boolean
  disabled?: boolean
  run?: () => void
}

export function createLayerActions(options: {
  role?: LayerOutputRole; isAnimation: boolean; canAssignAnimation: boolean
  insideAnimation?: boolean; manualIndividual?: boolean
  rename?: () => void; toggleIndividual: () => void; toggleAnimation: () => void
}): LayerAction[] {
  const { role } = options
  const actions: LayerAction[] = []
  if (options.rename) actions.push({ id: 'rename', label: '出力名を編集', run: options.rename })
  if (options.insideAnimation) {
    actions.push(options.manualIndividual
      ? { id: 'individual', label: '単独出力の手動指定を解除（セル内では無効）', checked: true, run: options.toggleIndividual }
      : { id: 'info', label: 'アニメーションフォルダ内の素材', disabled: true })
  } else if (!options.isAnimation) {
    const automatic = role?.kind === 'individual' && role.origin === 'automatic'
    actions.push({ id: 'individual', label: automatic ? layerRoleLabel(role)
      : role?.kind === 'individual' ? 'この素材の個別書き出しを解除する' : 'この素材を別画像として書き出す',
    checked: role?.kind === 'individual', disabled: automatic, run: options.toggleIndividual })
  }
  if (role?.kind === 'animation' || options.canAssignAnimation) {
    const automatic = role?.kind === 'animation' && role.origin === 'autoProcess'
    actions.push({ id: 'animation', label: automatic ? layerRoleLabel(role)
      : options.isAnimation ? '手動アニメーションフォルダ指定を解除する' : 'このフォルダを手動でアニメーションフォルダとして扱う',
    checked: options.isAnimation, disabled: automatic, run: options.toggleAnimation })
  }
  return actions
}
