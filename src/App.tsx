import { useEffect, useState } from 'react'
import { useFileLoader } from './hooks/useFileLoader'
import { useUndoRedo } from './hooks/useUndoRedo'
import { LocaleProvider } from './i18n'
import { FileDropZone } from './components/FileDropZone'
import { Toolbar } from './components/Toolbar'
import { MainLayout } from './components/MainLayout'
import { QuickExportDialog } from './components/QuickExportDialog'
import { useAppStore } from './store'
import { getQuickExportLaunchPaths } from './platform/launch'
import './App.css'

function NormalApp() {
  const { isLoading, error, notification, loadFiles } = useFileLoader()
  const { canUndo, canRedo, undo, redo } = useUndoRedo()

  return (
    <FileDropZone onFiles={loadFiles}>
      <div className="app-shell">
        <Toolbar
          onFiles={loadFiles}
          isLoading={isLoading}
          error={error}
          notification={notification}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
        />
        <div className="app-main">
          <MainLayout />
        </div>
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
