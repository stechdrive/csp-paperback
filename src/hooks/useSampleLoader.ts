import { useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { useCspb } from './useCspb'

const BASE = import.meta.env.BASE_URL

export function useSampleLoader() {
  const [loading, setLoading] = useState(false)
  const loadPsd = useAppStore(s => s.loadPsd)
  const loadXdts = useAppStore(s => s.loadXdts)
  const { loadCspbFile } = useCspb()

  const loadSample = useCallback(async () => {
    setLoading(true)
    try {
      const [psdBuf, xdtsText, cspbText] = await Promise.all([
        fetch(`${BASE}sample/c001.psd`).then(r => {
          if (!r.ok) throw new Error('PSD fetch failed')
          return r.arrayBuffer()
        }),
        fetch(`${BASE}sample/c001.xdts`).then(r => {
          if (!r.ok) throw new Error('XDTS fetch failed')
          return r.text()
        }),
        fetch(`${BASE}sample/c001.cspb`).then(r => {
          if (!r.ok) throw new Error('CSPB fetch failed')
          return r.text()
        }),
      ])
      loadXdts(xdtsText, 'c001.xdts')
      loadPsd(psdBuf, 'c001.psd')

      // Apply .cspb settings (virtual sets, process table, archive patterns)
      const cspbFile = new File([cspbText], 'c001.cspb', { type: 'application/json' })
      await loadCspbFile(cspbFile)
    } finally {
      setLoading(false)
    }
  }, [loadPsd, loadXdts, loadCspbFile])

  return { loadSample, loading }
}
