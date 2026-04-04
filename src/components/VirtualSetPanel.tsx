import { useAppStore } from '../store'
import { VirtualSetItem } from './VirtualSetItem'
import styles from './VirtualSetPanel.module.css'

export function VirtualSetPanel() {
  const virtualSets = useAppStore(s => s.virtualSets)
  const addVirtualSet = useAppStore(s => s.addVirtualSet)

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>仮想セット</span>
        <button
          className={styles.addBtn}
          onClick={() => addVirtualSet('新規セット', '')}
        >
          ＋ 追加
        </button>
      </div>
      <div className={styles.list}>
        {virtualSets.length === 0 ? (
          <div className={styles.empty}>
            「＋ 追加」で仮想セットを作成し<br />
            レイヤーをドロップしてください
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
