import { useFileLoader } from './hooks/useFileLoader'
import { FileDropZone } from './components/FileDropZone'
import { Toolbar } from './components/Toolbar'
import { MainLayout } from './components/MainLayout'
import './App.css'

export default function App() {
  const { isLoading, error, loadPsdFile, loadXdtsFile } = useFileLoader()

  return (
    <FileDropZone onPsdFile={loadPsdFile} onXdtsFile={loadXdtsFile}>
      <div className="app-shell">
        <Toolbar
          onPsdFile={loadPsdFile}
          onXdtsFile={loadXdtsFile}
          isLoading={isLoading}
          error={error}
        />
        <div className="app-main">
          <MainLayout />
        </div>
      </div>
    </FileDropZone>
  )
}
