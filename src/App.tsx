import { useFileLoader } from './hooks/useFileLoader'
import { usePersistence } from './hooks/usePersistence'
import { LocaleProvider } from './i18n'
import { FileDropZone } from './components/FileDropZone'
import { Toolbar } from './components/Toolbar'
import { MainLayout } from './components/MainLayout'
import './App.css'

function AppInner() {
  const { isLoading, error, loadPsdFile, loadXdtsFile } = useFileLoader()
  const { savePsd, hasPsd } = usePersistence()

  return (
    <FileDropZone onPsdFile={loadPsdFile} onXdtsFile={loadXdtsFile}>
      <div className="app-shell">
        <Toolbar
          onPsdFile={loadPsdFile}
          onXdtsFile={loadXdtsFile}
          isLoading={isLoading}
          error={error}
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
