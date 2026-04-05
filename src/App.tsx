import { useFileLoader } from './hooks/useFileLoader'
import { usePersistence } from './hooks/usePersistence'
import { useUndoRedo } from './hooks/useUndoRedo'
import { LocaleProvider } from './i18n'
import { FileDropZone } from './components/FileDropZone'
import { Toolbar } from './components/Toolbar'
import { MainLayout } from './components/MainLayout'
import './App.css'

function AppInner() {
  const { isLoading, error, notification, loadPsdFile, loadXdtsFile, loadCspbFile, saveCspb } = useFileLoader()
  const { savePsd, hasPsd } = usePersistence()
  const { canUndo, canRedo, undo, redo } = useUndoRedo()

  return (
    <FileDropZone onPsdFile={loadPsdFile} onXdtsFile={loadXdtsFile} onCspbFile={loadCspbFile}>
      <div className="app-shell">
        <Toolbar
          onPsdFile={loadPsdFile}
          onXdtsFile={loadXdtsFile}
          onCspbFile={loadCspbFile}
          onSaveCspb={saveCspb}
          isLoading={isLoading}
          error={error}
          notification={notification}
          onSavePsd={savePsd}
          hasPsd={hasPsd}
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

export default function App() {
  return (
    <LocaleProvider>
      <AppInner />
    </LocaleProvider>
  )
}
