import styles from './OutputGateIcon.module.css'

/** The parent button's pressed state means excluded. Both viewers use the same marks. */
export function OutputGateIcon() {
  return <svg className={styles.icon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <circle className={styles.enabled} cx="12" cy="12" r="7" />
    <path className={styles.excluded} d="m6 6 12 12M18 6 6 18" />
  </svg>
}
