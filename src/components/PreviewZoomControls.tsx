import { formatZoom } from '../utils/preview-zoom'
import { Tooltip } from './Tooltip'
import styles from './OutputPreview.module.css'

export function PreviewZoomControls({ zoom, fit, actualSize }: { zoom: number; fit: () => void; actualSize: () => void }) {
  return <div className={styles.boardTools}>
    <span aria-label="表示倍率">{formatZoom(zoom)}</span>
    <Tooltip content="画像の1ピクセルを画面の1ピクセルで表示"><button type="button" onClick={actualSize}>100%</button></Tooltip>
    <button type="button" onClick={fit}>画面に収める</button>
  </div>
}
