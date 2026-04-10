import { useFileLoader } from './hooks/useFileLoader'
import { useUndoRedo } from './hooks/useUndoRedo'
import { LocaleProvider } from './i18n'
import { FileDropZone } from './components/FileDropZone'
import { Toolbar } from './components/Toolbar'
import { MainLayout } from './components/MainLayout'
import './App.css'

function AppInner() {
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

export default function App() {
  return (
    <LocaleProvider>
      <AppInner />
    </LocaleProvider>
  )
}
