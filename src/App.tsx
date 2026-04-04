import { useFileLoader } from './hooks/useFileLoader'
import { usePersistence } from './hooks/usePersistence'
import { FileDropZone } from './components/FileDropZone'
import { Toolbar } from './components/Toolbar'
import { MainLayout } from './components/MainLayout'
import './App.css'

export default function App() {
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
