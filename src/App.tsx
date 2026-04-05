import { useFileLoader } from './hooks/useFileLoader'
import { usePersistence } from './hooks/usePersistence'
import { LocaleProvider } from './i18n'
import { FileDropZone } from './components/FileDropZone'
import { Toolbar } from './components/Toolbar'
import { MainLayout } from './components/MainLayout'
import './App.css'

function AppInner() {
  const { isLoading, error, notification, loadPsdFile, loadXdtsFile, loadCspbFile, saveCspb } = useFileLoader()
  const { savePsd, hasPsd } = usePersistence()

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
