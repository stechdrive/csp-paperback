import styles from './OutputGateIcon.module.css'
import { OUTPUT_GATE_ICON_PATH, OUTPUT_GATE_SLASH_PATH } from '../utils/output-gate-icon'

/** The parent button's pressed state adds the exclusion slash. */
export function OutputGateIcon() {
  return <svg className={styles.icon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={OUTPUT_GATE_ICON_PATH} />
    <path className={styles.slash} d={OUTPUT_GATE_SLASH_PATH} />
  </svg>
}
