import { useEffect, useState } from 'react'

const MOBILE_MEDIA_QUERY = '(pointer: coarse) and (max-width: 1024px)'

function getMobileMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null
  }
  return window.matchMedia(MOBILE_MEDIA_QUERY)
}

function getInitialIsMobile(): boolean {
  return getMobileMediaQuery()?.matches ?? false
}

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(getInitialIsMobile)

  useEffect(() => {
    const mq = getMobileMediaQuery()
    if (!mq) return

    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return mobile
}
