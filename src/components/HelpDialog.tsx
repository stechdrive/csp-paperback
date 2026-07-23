import { useCallback, useEffect, useRef, useState } from 'react'
import { AboutGuide } from './help/AboutGuide'
import { FeatureGuide } from './help/FeatureGuide'
import { ABOUT_SECTIONS, FEATURE_SECTIONS, QUICK_SECTIONS } from './help/helpSections'
import { QuickStartGuide } from './help/QuickStartGuide'
import { StudioTemplateGuide } from './help/StudioTemplateGuide'
import styles from './HelpDialog.module.css'

interface HelpDialogProps {
  onClose: () => void
}

type HelpTab = 'quick' | 'features' | 'about'

interface HelpSection {
  id: string
  label: string
}

const TABS: Array<{ id: HelpTab; label: string; description: string }> = [
  { id: 'quick', label: '最短ガイド', description: '出力とテンプレート設定' },
  { id: 'features', label: '機能ガイド', description: 'すべての画面と機能' },
  { id: 'about', label: 'このツールについて', description: '何を補い、どう出力するか' },
]

function getSections(tab: HelpTab): readonly HelpSection[] {
  if (tab === 'quick') return QUICK_SECTIONS
  if (tab === 'features') return FEATURE_SECTIONS
  return ABOUT_SECTIONS
}

export function HelpDialog({ onClose }: HelpDialogProps) {
  const [activeTab, setActiveTab] = useState<HelpTab>('quick')
  const [activeSection, setActiveSection] = useState<string>(QUICK_SECTIONS[0]?.id ?? '')
  const contentRef = useRef<HTMLDivElement>(null)
  const sections = getSections(activeTab)

  const selectTab = useCallback((tab: HelpTab) => {
    setActiveTab(tab)
    setActiveSection(getSections(tab)[0]?.id ?? '')
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [])

  const scrollTo = useCallback((id: string) => {
    const content = contentRef.current
    const target = content?.querySelector<HTMLElement>(`[data-help-section="${id}"]`)
    if (!content || !target) return

    content.scrollTo({
      top: Math.max(0, target.offsetTop - 20),
      behavior: 'smooth',
    })
    setActiveSection(id)
  }, [])

  const handleContentScroll = useCallback(() => {
    const content = contentRef.current
    if (!content) return

    const candidates = Array.from(
      content.querySelectorAll<HTMLElement>('[data-help-section]'),
    )
    if (candidates.length === 0) return

    let current = candidates[0]
    for (const candidate of candidates) {
      if (candidate.offsetTop <= content.scrollTop + 72) current = candidate
      else break
    }
    setActiveSection(current.dataset.helpSection ?? '')
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className={styles.overlay}
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-dialog-title"
      >
        <div className={styles.header}>
          <div className={styles.headerHeading}>
            <span className={styles.headerIcon} aria-hidden="true">?</span>
            <div>
              <div id="help-dialog-title" className={styles.headerTitle}>CSP Paperback ヘルプ</div>
              <div className={styles.headerSubtitle}>やりたいことから選べます</div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="ヘルプを閉じる">✕</button>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="ヘルプの種類">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
                onClick={() => selectTab(tab.id)}
            >
              <span className={styles.tabLabel}>{tab.label}</span>
              <span className={styles.tabDescription}>{tab.description}</span>
            </button>
          ))}
        </div>

        <div className={`${styles.layout} ${sections.length === 0 ? styles.layoutNoToc : ''}`}>
          {sections.length > 0 && (
            <nav className={styles.toc} aria-label="章の目次">
              {sections.map((item, index) => (
                <button
                  key={item.id}
                  className={`${styles.tocItem} ${activeSection === item.id ? styles.tocItemActive : ''}`}
                  onClick={() => scrollTo(item.id)}
                  aria-current={activeSection === item.id ? 'location' : undefined}
                >
                  <span className={styles.tocNumber}>{index + 1}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          )}

          <div
            className={styles.content}
            ref={contentRef}
            onScroll={handleContentScroll}
          >
            {activeTab === 'quick' && (
              <>
                <section data-help-section="quick-export">
                  <QuickStartGuide variant="help" />
                </section>
                <StudioTemplateGuide />
              </>
            )}
            {activeTab === 'features' && <FeatureGuide />}
            {activeTab === 'about' && <AboutGuide />}
          </div>
        </div>

        <div className={styles.footer}>
          <span className={styles.footerHint}>Escでも閉じられます</span>
          <button className={styles.doneBtn} onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  )
}
