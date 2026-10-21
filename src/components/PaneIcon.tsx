export function PaneIcon({ kind }: { kind: 'menu' | 'search' | 'close' | 'quicklook' }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    {kind === 'menu' ? <path d="M4 6h16M4 12h16M4 18h16" /> :
      kind === 'close' ? <path d="m6 6 12 12M18 6 6 18" /> :
        kind === 'search' ? <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></> :
          <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
  </svg>
}
