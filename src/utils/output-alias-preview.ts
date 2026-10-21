import type { AppStore } from '../store'
import { selectLayerTreeWithVisibility, selectOutputFiles } from '../store/selectors'
import { buildOutputPlan } from './output-plan'
import { sanitizeOutputPath, sanitizePathSegment } from './path-sanitize'
import { replaceExtension } from './image-export'

/** Use the export manifest itself for feedback; no rendering or store mutation. */
export function previewOutputAlias(state: AppStore, layerId: string, draft: string) {
  const value = sanitizePathSegment(draft)
  if (!draft.trim()) return { value, error: '出力名を入力してください。空欄のまま離れると取り消します。', notes: [], names: [], count: 0 }
  const outputAliases = new Map(state.outputAliases).set(layerId, value)
  const plan = buildOutputPlan(selectLayerTreeWithVisibility(state), { ...state, outputAliases })
  const owns = (file: typeof plan[number]) => file.animFolderId === layerId || (!file.animFolderId && file.sourceLayerId === layerId)
  const files = plan.filter(owns)
  const notes: string[] = []
  if (draft !== value) notes.push(`使用できない文字や長さを調整して「${value}」を使います。`)
  if (files.some(file => file.outputBaseName !== value || file.relativePath !== sanitizeOutputPath(replaceExtension(
    state.outputConfig.structure === 'hierarchy' ? file.path : file.flatName, state.outputConfig.format)))) {
    notes.push('同名の出力と区別するため、枝番などを付けます。')
  }
  if (!files.length) notes.push('現在の表示・出力設定では出力はありません。別名は保持されます。')
  const previous = new Map(selectOutputFiles(state).map(file => [file.outputId, file.relativePath]))
  const affected = plan.filter(file => !owns(file) && previous.get(file.outputId) !== file.relativePath)
  if (affected.length) notes.push(`同名の調整により、ほかの出力 ${affected.length} 件の名前も変わります: ${affected.slice(0, 3).map(file => file.relativePath).join('、')}`)
  return { value, error: '', notes, names: files.slice(0, 3).map(file => file.relativePath), count: files.length }
}
