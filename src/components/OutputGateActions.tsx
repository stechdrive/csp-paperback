import { useAppStore } from '../store'
import { selectOutputFiles } from '../store/selectors'

/** Shared commands for list, board, keyboard and touch menus. */
export function OutputGateActions({ onDone }: { onDone: () => void }) {
  const files = useAppStore(selectOutputFiles)
  const selected = useAppStore(s => s.selectedOutputIds)
  const excluded = useAppStore(s => s.outputExclusions)
  const targets = files.filter(file => selected.has(file.outputId))
  const change = (enabled: boolean) => { useAppStore.getState().setOutputsEnabled(selected, enabled); onDone() }
  return <>
    <button role="menuitem" disabled={!targets.some(file => !excluded.has(file.gateId))} onClick={() => change(false)}>選択を出力から外す</button>
    <button role="menuitem" disabled={!targets.some(file => excluded.has(file.gateId))} onClick={() => change(true)}>選択を出力に戻す</button>
    <button role="menuitem" disabled={!excluded.size} onClick={() => { useAppStore.getState().resetOutputExclusions(); onDone() }}>すべて出力に戻す</button>
  </>
}
