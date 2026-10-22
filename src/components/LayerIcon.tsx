import type { ReactNode, SVGProps } from 'react'
import type { LayerContentKind } from '../types/layer-display'

export type LayerIconKind = LayerContentKind | 'animation' | 'color' | 'edge' | 'mask' | 'maskoff' | 'tone' | 'water' | 'star' | 'more'

const paths: Record<LayerIconKind, ReactNode> = {
  'raster': <><rect x=".5" y=".5" width="15" height="15" fill="#fff" stroke="#292b2c" strokeWidth="1" rx=".15"/><path d="M3 2.2h10v11.6H6L3 10.8Z" fill="#fff" stroke="#626568" strokeWidth="1" strokeLinejoin="round"/><path d="M3 10.7h3.1v3.1Z" fill="#626568" stroke="none"/></>,
  'vector': <><rect x=".5" y=".5" width="15" height="15" fill="#fff" stroke="#292b2c" strokeWidth="1" rx=".15"/><rect x="2.5" y="2.5" width="11" height="11" rx=".3" stroke="#929496" strokeWidth=".9"/><path d="m8 3.8 3.8 2.1v4.6L8 12.6l-3.8-2.1V5.9Zm-3.8 2.1L8 8l3.8-2.1M8 8v4.6" stroke="#686c6e" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="round"/><g fill="#686c6e" stroke="none"><rect x="2" y="2" width="1.5" height="1.5"/><rect x="12.5" y="2" width="1.5" height="1.5"/><rect x="2" y="12.5" width="1.5" height="1.5"/><rect x="12.5" y="12.5" width="1.5" height="1.5"/></g></>,
  '3d': <><path d="m8 1.5 5.5 3v7L8 14.5l-5.5-3v-7Zm-5.5 3L8 8l5.5-3.5M8 8v6.5"/><path d="m8 1.5 5.5 3L8 8l-5.5-3.5Z" fill="currentColor" fillOpacity=".16"/></>,
  'image-material': <><rect x=".5" y=".5" width="15" height="15" fill="#fff" stroke="#292b2c" strokeWidth="1"/><rect x="2.1" y="2.1" width="11.8" height="11.8" fill="#fff" stroke="#626568" strokeWidth="1"/><path d="M2.6 11.3 5 8.7l2 1.5 3.2-3.4 3.1 2.3v4.3H2.6Z" fill="#949799" stroke="none"/><path d="m11.6 8.8 3.3 1.8v3.5L11.6 16l-3.3-1.9v-3.5Z" fill="#fff" stroke="#fff" strokeWidth="1.5"/><path d="m11.6 9.4 2.9 1.6v3l-2.9 1.6L8.7 14v-3Zm-2.9 1.6 2.9 1.6 2.9-1.6m-2.9 1.6v3" stroke="#626568" strokeWidth=".9" strokeLinejoin="round"/></>,
  'fill': <><rect x=".5" y=".5" width="15" height="15" fill="#fff" stroke="#292b2c" strokeWidth="1"/><circle cx="7.5" cy="7.4" r="5.3" fill="#56595b" stroke="none"/><path d="m11.6 8.8 3.3 1.8v3.5L11.6 16l-3.3-1.9v-3.5Z" fill="#fff" stroke="#fff" strokeWidth="1.5"/><path d="m11.6 9.4 2.9 1.6v3l-2.9 1.6L8.7 14v-3Zm-2.9 1.6 2.9 1.6 2.9-1.6m-2.9 1.6v3" stroke="#626568" strokeWidth=".9" strokeLinejoin="round"/></>,
  'gradient': <><rect x="1" y="1" width="14" height="14" fill="#fff" stroke="#626568"/><path d="M3 3h2v10H3Z" fill="#ccc" stroke="none"/><path d="M6 3h2v10H6Z" fill="#999" stroke="none"/><path d="M9 3h2v10H9Z" fill="#666" stroke="none"/><path d="M12 3h1v10h-1Z" fill="#333" stroke="none"/></>,
  'paper': <><rect x=".5" y=".5" width="15" height="15" fill="#fff" stroke="#292b2c" strokeWidth="1" rx=".15"/><path d="M3 2.2h10v11.6H6L3 10.8Z" fill="#fff" stroke="#626568" strokeWidth="1" strokeLinejoin="round"/><path d="M3 10.7h3.1v3.1Z" fill="#626568" stroke="none"/></>,
  'text': <><rect x=".5" y=".5" width="15" height="15" fill="#fff" stroke="#292b2c" strokeWidth="1"/><path d="M2.5 13.5 6.4 2.5h1.8l4 11h-2l-.9-2.8H5.4l-.9 2.8Zm3.5-4.4h2.8L7.4 5Z" fill="#626568" fillRule="evenodd" stroke="none"/><path d="m11.6 8.8 3.3 1.8v3.5L11.6 16l-3.3-1.9v-3.5Z" fill="#fff" stroke="#fff" strokeWidth="1.5"/><path d="m11.6 9.4 2.9 1.6v3l-2.9 1.6L8.7 14v-3Zm-2.9 1.6 2.9 1.6 2.9-1.6m-2.9 1.6v3" stroke="#626568" strokeWidth=".9" strokeLinejoin="round"/></>,
  'adjustment': <><circle cx="8" cy="8" r="5.6"/><path d="M8 2.4a5.6 5.6 0 0 1 0 11.2Z" fill="currentColor" stroke="none"/></>,
  'camera': <><rect x="1.5" y="4" width="9" height="8" rx="1"/><path d="m10.5 6 4-2v8l-4-2Z"/></>,
  'folder': <><path d="M1.5 4h5l1.5 2h6.5v7H1.5Z" fill="currentColor" fillOpacity=".14"/><path d="M1.5 6.5h13l-1.5 6.5H1.5Z"/></>,
  'animation': <><path d="M1.5 3.5h5L8 5h6.5v8H1.5Z"/><rect x="4" y="7" width="8" height="4"/><path d="M6 7v4m4-4v4"/></>,
  'other': <><rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="m8 5 3 3-3 3-3-3Z"/></>,
  'color': <><rect x="2" y="2" width="8" height="8" fill="var(--lc,#3e8cec)" stroke="var(--lc,#3e8cec)"/><rect x="7" y="7" width="7" height="7" fill="var(--lc-sub,#eef4fa)" stroke="#89a1b5"/></>,
  'edge': <><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3.4" fill="currentColor" stroke="none"/></>,
  'mask': <><rect x="2" y="2" width="12" height="12" rx=".5" fill="currentColor"/><circle cx="8" cy="8" r="3.4" fill="var(--color-surface-1,#fff)" stroke="none"/></>,
  'maskoff': <><g opacity=".5"><rect x="2" y="2" width="12" height="12" rx=".5"/><circle cx="8" cy="8" r="3.4"/></g><path d="m2 14 12-12" stroke="var(--color-danger,#a94d53)" strokeWidth="1.6"/></>,
  'tone': <><circle cx="4" cy="4" r="1" fill="currentColor"/><circle cx="8" cy="4" r="1" fill="currentColor"/><circle cx="12" cy="4" r="1" fill="currentColor"/><circle cx="6" cy="8" r="1" fill="currentColor"/><circle cx="10" cy="8" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="8" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/></>,
  'water': <><path d="M8 1.5C7 4.5 3.2 7.5 3.2 10a4.8 4.8 0 0 0 9.6 0C12.8 7.5 9 4.5 8 1.5Z"/><path d="M5 10a3 3 0 0 0 3 3"/></>,
  'star': <><path d="m8 1.5 2 4.3 4.7.5-3.5 3.3.9 4.8L8 12l-4.1 2.4.9-4.8L1.3 6.3 6 5.8Z"/></>,
  'more': <><circle cx="3" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="8" r="1" fill="currentColor"/><circle cx="13" cy="8" r="1" fill="currentColor"/></>,
}

/** Compact glyphs shared by the tree, actions and guide examples. */
export function LayerIcon({ kind, ...props }: SVGProps<SVGSVGElement> & { kind: LayerIconKind }) {
  return <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.1"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[kind]}</svg>
}
