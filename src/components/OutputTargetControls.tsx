import type { RefObject } from 'react'
import { useAppStore } from '../store'
import { selectOutputCandidates } from '../store/selectors'
import type { OutputConfigTarget } from '../store/output-slice'
import { processDisplayName } from '../utils/process-folder'
import { individualOutputKey, isIndividualOutputEnabled, type OutputTarget } from '../utils/output-target'
import { Tooltip } from './Tooltip'
import styles from './ExportSettings.module.css'

/** One set of controls for the settings popover and the export dialog. */
export function OutputTargetControls({ configTarget = 'current', avoidRef }: {
  configTarget?: OutputConfigTarget
  avoidRef?: RefObject<HTMLDivElement | null>
}) {
  const candidates = useAppStore(selectOutputCandidates)
  const loaded = useAppStore(s => s.layerTree.length > 0)
  const table = useAppStore(s => s.projectSettings.processTable)
  const config = useAppStore(s => configTarget === 'saved' ? s.savedOutputConfig : s.outputConfig)
  const setExcludeBody = useAppStore(s => s.setExcludeBody)
  const setProcess = useAppStore(s => s.setProcessOutputEnabled)
  const setIndividual = useAppStore(s => s.setIndividualOutputEnabled)
  const targets = candidates.flatMap(entry => entry.outputTarget ? [entry.outputTarget] : [])
  const suffixes = new Set(targets.flatMap(target => target.processSuffixes))
  const processes = [...new Map(table.filter(entry => !loaded || suffixes.has(entry.suffix))
    .map(entry => [entry.suffix, entry])).values()]
  const individuals = new Map<string, { name: string; targets: OutputTarget[] }>()
  for (const target of targets) {
    if (target.individualName === undefined) continue
    const key = individualOutputKey(target.individualName)
    const group = individuals.get(key) ?? { name: target.individualName, targets: [] }
    group.targets.push(target)
    individuals.set(key, group)
  }
  const hasBody = !loaded || targets.some(target => target.body)
  return <div className={styles.targetControls}>
    <div className={styles.chipGroup} role="group" aria-label="出力対象">
      {hasBody && <Tooltip content="修正工程に属さないセル画像をまとめて切り替えます。OFFにしても、同じセル内の修正画像は残ります。目玉の表示状態は変えません。" avoidRef={avoidRef}>
        <button type="button" className={styles.chip} aria-pressed={!config.excludeBody}
          onClick={() => setExcludeBody(!config.excludeBody, configTarget)}>
          <span className={styles.checkMark} aria-hidden="true">{!config.excludeBody ? '✓' : ''}</span>作画（本体）
        </button>
      </Tooltip>}
      {processes.map(entry => {
        const name = processDisplayName(entry)
        const group = targets.filter(target => target.processSuffixes.includes(entry.suffix))
        const states = group.map(target => target.legacyIndividualName === undefined || isIndividualOutputEnabled(target, config))
        const excluded = config.excludedProcessSuffixes.includes(entry.suffix)
        const enabled = !excluded && states.every(Boolean)
        const mixed = !excluded && !enabled && states.some(Boolean)
        const legacyNames = group.flatMap(target => target.legacyIndividualName === undefined ? [] : [target.legacyIndividualName])
        return <Tooltip key={entry.suffix} content={`対象フォルダ名: ${entry.folderNames.join(', ')}\n目玉を変えず、この工程の画像を書き出すか切り替えます。`} avoidRef={avoidRef}>
          <button type="button" className={styles.chip} aria-label={name === entry.suffix ? name : `${name} ${entry.suffix}`}
            aria-pressed={mixed ? 'mixed' : enabled} onClick={() => setProcess(entry.suffix, !enabled, legacyNames, configTarget)}>
            <span className={styles.checkMark} aria-hidden="true">{mixed ? '−' : enabled ? '✓' : ''}</span>
            <span className={styles.chipName}>{name}</span>{name !== entry.suffix && <span className={styles.suffix}>{entry.suffix}</span>}
          </button>
        </Tooltip>
      })}
      {[...individuals].map(([key, group]) => {
        const states = group.targets.map(target => isIndividualOutputEnabled(target, config))
        const enabled = states.every(Boolean)
        const mixed = !enabled && states.some(Boolean)
        return <Tooltip key={key} content={`「${group.name}」を別画像として書き出します。同名の素材をまとめて切り替えます。\n目玉の表示状態は変えません。`} avoidRef={avoidRef}>
          <button type="button" className={styles.chip} aria-label={`${group.name} 個別書き出し`}
            aria-pressed={mixed ? 'mixed' : enabled} onClick={() => setIndividual(group.name, !enabled, configTarget)}>
            <span className={styles.checkMark} aria-hidden="true">{mixed ? '−' : enabled ? '✓' : ''}</span>
            <span className={styles.chipName}>{group.name}</span>
          </button>
        </Tooltip>
      })}
    </div>
    {!loaded && <span className={styles.targetHint}>素材を読み込むと、該当する工程と個別に書き出す素材名を表示します。</span>}
    {loaded && targets.length === 0 && <span className={styles.targetHint}>該当する出力対象がありません。</span>}
  </div>
}
