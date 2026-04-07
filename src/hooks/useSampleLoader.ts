import { useState, useCallback } from 'react'
import { useAppStore } from '../store'

const BASE = import.meta.env.BASE_URL

export function useSampleLoader() {
  const [loading, setLoading] = useState(false)
  const loadPsd = useAppStore(s => s.loadPsd)
  const loadXdts = useAppStore(s => s.loadXdts)

  const loadSample = useCallback(async () => {
    setLoading(true)
    try {
      const [psdBuf, xdtsText] = await Promise.all([
        fetch(`${BASE}sample/c001.psd`).then(r => {
          if (!r.ok) throw new Error('PSD fetch failed')
          return r.arrayBuffer()
        }),
        fetch(`${BASE}sample/c001.xdts`).then(r => {
          if (!r.ok) throw new Error('XDTS fetch failed')
          return r.text()
        }),
      ])
      loadXdts(xdtsText, 'c001.xdts')
      loadPsd(psdBuf, 'c001.psd')
    } finally {
      setLoading(false)
    }
  }, [loadPsd, loadXdts])

  return { loadSample, loading }
}
