import { useAppStore } from '../store'
import { useLocale } from '../i18n'
import { VirtualSetItem } from './VirtualSetItem'
import styles from './VirtualSetPanel.module.css'

export function VirtualSetPanel() {
  const virtualSets = useAppStore(s => s.virtualSets)
  const addVirtualSet = useAppStore(s => s.addVirtualSet)
  const { t } = useLocale()

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{t.virtualSet.title}</span>
        <button
          className={styles.addBtn}
          onClick={() => addVirtualSet(t.virtualSet.newSetName, '')}
        >
          {t.virtualSet.add}
        </button>
      </div>
      <div className={styles.list}>
        {virtualSets.length === 0 ? (
          <div className={styles.empty}>
            {t.virtualSet.empty.split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </div>
        ) : (
          virtualSets.map(vs => (
            <VirtualSetItem key={vs.id} virtualSet={vs} />
          ))
        )}
      </div>
    </div>
  )
}
