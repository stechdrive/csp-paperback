import { useCallback, useEffect, useRef, useState } from 'react'
import type { BlendMode } from '../types'
import styles from './BlendOpacityBar.module.css'

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: '通常' },
  { value: 'pass through', label: '通過' },
  { value: 'multiply', label: '乗算' },
  { value: 'screen', label: 'スクリーン' },
  { value: 'overlay', label: 'オーバーレイ' },
  { value: 'darken', label: '暗く' },
  { value: 'lighten', label: '明るく' },
  { value: 'color dodge', label: '覆い焼き' },
  { value: 'color burn', label: '焼き込み' },
  { value: 'hard light', label: 'ハードライト' },
  { value: 'soft light', label: 'ソフトライト' },
  { value: 'difference', label: '差の絶対値' },
  { value: 'exclusion', label: '除外' },
  { value: 'hue', label: '色相' },
  { value: 'saturation', label: '彩度' },
  { value: 'color', label: 'カラー' },
  { value: 'luminosity', label: '輝度' },
]

// -------------------------------------------------------
// ドラッグスクラバー（横ドラッグで数値変更、クリックで直接入力）
// -------------------------------------------------------

interface DragNumberProps {
  value: number
  min: number
  max: number
  disabled: boolean
  onChange: (v: number) => void
}

export function DragNumber({ value, min, max, disabled, onChange }: DragNumberProps) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')
  const dragging = useRef(false)
  const startX = useRef(0)
  const startVal = useRef(0)
  const moved = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select()
  }, [editing])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return
    e.preventDefault()
    dragging.current = true
    moved.current = false
    startX.current = e.clientX
    startVal.current = value

    const handleMove = (ev: MouseEvent) => {
      const delta = Math.round((ev.clientX - startX.current) / 2)
      if (Math.abs(delta) >= 1) moved.current = true
      onChange(Math.max(min, Math.min(max, startVal.current + delta)))
    }
    const handleUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [disabled, value, min, max, onChange])

  const handleClick = useCallback(() => {
    if (disabled || moved.current) return
    setEditVal(String(value))
    setEditing(true)
  }, [disabled, value])

  const commitEdit = useCallback(() => {
    const n = parseInt(editVal, 10)
    if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)))
    setEditing(false)
  }, [editVal, min, max, onChange])

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={styles.opacityEditInput}
        type="number"
        min={min}
        max={max}
        value={editVal}
        onChange={e => setEditVal(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={e => {
          if (e.key === 'Enter') commitEdit()
          if (e.key === 'Escape') setEditing(false)
        }}
      />
    )
  }

  return (
    <div
      className={`${styles.opacityScrubber} ${disabled ? styles.opacityScrubberDisabled : ''}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      title="左右にドラッグして変更 / クリックで数値入力"
    >
      <span className={styles.opacityScrubberLabel}>不透明度</span>
      <span className={styles.opacityScrubberTrack}>
        <span className={styles.opacityScrubberFill} style={{ width: `${value}%` }} />
      </span>
      <span className={styles.opacityScrubberValue}>{value}%</span>
    </div>
  )
}

// -------------------------------------------------------
// BlendOpacityBar — 合成モード選択 + 不透明度スクラバー
// -------------------------------------------------------

interface BlendOpacityBarProps {
  blendMode: string
  opacity: number
  disabled: boolean
  /** フォルダ選択時のみ「通過」を表示する場合 true */
  showPassThrough?: boolean
  onBlendModeChange: (value: string) => void
  onOpacityChange: (value: number) => void
}

export function BlendOpacityBar({
  blendMode,
  opacity,
  disabled,
  showPassThrough = true,
  onBlendModeChange,
  onOpacityChange,
}: BlendOpacityBarProps) {
  return (
    <div className={`${styles.bar} ${disabled ? '' : styles.barActive}`}>
      <select
        className={styles.blendSelect}
        value={blendMode}
        onChange={e => onBlendModeChange(e.target.value)}
        disabled={disabled}
      >
        {BLEND_MODES
          .filter(m => showPassThrough || m.value !== 'pass through')
          .map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))
        }
      </select>
      <DragNumber
        value={opacity}
        min={0}
        max={100}
        disabled={disabled}
        onChange={onOpacityChange}
      />
    </div>
  )
}
