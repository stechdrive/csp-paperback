import { useEffect, useState } from 'react'
import { useFileLoader } from './hooks/useFileLoader'
import { useUndoRedo } from './hooks/useUndoRedo'
import { LocaleProvider } from './i18n'
import { FileDropZone } from './components/FileDropZone'
import { Toolbar } from './components/Toolbar'
import { MainLayout } from './components/MainLayout'
import { QuickExportDialog } from './components/QuickExportDialog'
import { ExportStatus } from './components/ExportStatus'
import { useExportJob } from './store/export-job'
import { useAppStore } from './store'
import { getQuickExportLaunchPaths } from './platform/launch'
import './App.css'

function NormalApp() {
  const { isLoading, error, notification, loadFiles } = useFileLoader()
  const { canUndo, canRedo, undo, redo } = useUndoRedo()
  const document = useAppStore(s => s.clipDocument ?? s.rawPsd)
  const [preview, setPreview] = useState({ document, mode: 'navigator' as 'output' | 'navigator' })
  const isExporting = useExportJob(s => s.isExporting)
  const [virtualPanelOpen, setVirtualPanelOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'virtual' | 'preview' | 'layer'>('preview')
  if (preview.document !== document) {
    setPreview({ document, mode: 'navigator' })
    setActiveTab('preview')
  }
  const changePreviewMode = (mode: 'output' | 'navigator') => {
    setPreview({ document, mode })
    setActiveTab('preview')
  }
  const toggleVirtualPanel = () => {
    setVirtualPanelOpen(open => !open)
    setActiveTab(virtualPanelOpen ? 'preview' : 'virtual')
  }

  return (
    <FileDropZone onFiles={loadFiles}>
      <div className="app-shell">
        <div className="app-workspace" inert={isExporting} aria-busy={isExporting}>
        <Toolbar
          onFiles={loadFiles}
          isLoading={isLoading}
          error={error}
          notification={notification}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          virtualPanelOpen={virtualPanelOpen}
          onToggleVirtualPanel={toggleVirtualPanel}
        />
        <div className="app-main">
          <MainLayout
            previewMode={preview.mode}
            onPreviewModeChange={changePreviewMode}
            virtualPanelOpen={virtualPanelOpen}
            onCloseVirtualPanel={() => { setVirtualPanelOpen(false); setActiveTab('preview') }}
            activeTab={activeTab}
            onActiveTabChange={tab => { setActiveTab(tab); if (tab === 'virtual') setVirtualPanelOpen(true) }}
          />
        </div>
        </div>
        <ExportStatus />
      </div>
    </FileDropZone>
  )
}

function AppInner() {
  const [quickLaunchPaths, setQuickLaunchPaths] = useState<string[] | null>(null)
  const mobileUiScale = useAppStore(s => s.mobileUiScale)
  const activeTheme = useAppStore(s => s.activeTheme)

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--mobile-ui-scale', String(mobileUiScale))
    return () => {
      root.style.removeProperty('--mobile-ui-scale')
    }
  }, [mobileUiScale])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = activeTheme
    return () => {
      root.removeAttribute('data-theme')
    }
  }, [activeTheme])

  useEffect(() => {
    let cancelled = false
    void getQuickExportLaunchPaths()
      .then(paths => {
        if (!cancelled) setQuickLaunchPaths(paths)
      })
      .catch(() => {
        if (!cancelled) setQuickLaunchPaths([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (quickLaunchPaths === null) {
    return <div className="app-boot">起動しています</div>
  }

  if (quickLaunchPaths.length > 0) {
    return <QuickExportDialog paths={quickLaunchPaths} />
  }

  return <NormalApp />
}

export default function App() {
  return (
    <LocaleProvider>
      <AppInner />
    </LocaleProvider>
  )
}
