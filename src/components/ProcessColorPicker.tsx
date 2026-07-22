import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { hexToRgb, normalizeHexColor, rgbToHex } from '../utils/process-color'
import styles from './SettingsDialog.module.css'

interface ProcessColorPickerProps {
  color: string
  label: string
  onChange: (color: string) => void
}

export function ProcessColorPicker({ color, label, onChange }: ProcessColorPickerProps) {
  const normalizedColor = normalizeHexColor(color) ?? '#FBECE6'
  const [open, setOpen] = useState(false)
  const [hexDraft, setHexDraft] = useState(normalizedColor.slice(1))
  const rgb = hexToRgb(normalizedColor)

  useEffect(() => {
    setHexDraft(normalizedColor.slice(1))
  }, [normalizedColor])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const updateRgb = (channel: 'r' | 'g' | 'b', rawValue: string) => {
    const parsed = Number.parseInt(rawValue, 10)
    const next = { ...rgb, [channel]: Number.isFinite(parsed) ? parsed : 0 }
    onChange(rgbToHex(next.r, next.g, next.b))
  }

  const updateHex = (rawValue: string) => {
    const draft = rawValue.replace(/[^0-9a-f]/gi, '').slice(0, 6).toUpperCase()
    setHexDraft(draft)
    const next = normalizeHexColor(draft)
    if (next) onChange(next)
  }

  return (
    <>
      <button
        type="button"
        className={styles.colorSwatchButton}
        style={{ backgroundColor: normalizedColor }}
        onClick={() => setOpen(true)}
        aria-label={`${label}のフチ色を変更`}
        title={`${label}のフチ色 ${normalizedColor}`}
      />
      {open && createPortal(
        <div
          className={styles.colorPickerOverlay}
          onMouseDown={event => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <div
            className={styles.colorPickerDialog}
            role="dialog"
            aria-modal="true"
            aria-label={`${label}のフチ色`}
          >
            <div className={styles.colorPickerHeader}>
              <div>
                <div className={styles.colorPickerTitle}>{label}のフチ色</div>
                <div className={styles.colorPickerHint}>修正工程フチ（乗算・不透明度80%）</div>
              </div>
              <button
                type="button"
                className={styles.colorPickerClose}
                onClick={() => setOpen(false)}
                aria-label="カラー指定を閉じる"
              >✕</button>
            </div>

            <label className={styles.nativeColorRow}>
              <input
                type="color"
                className={styles.nativeColorInput}
                value={normalizedColor}
                onChange={event => onChange(event.target.value.toUpperCase())}
                aria-label="カラーホイール・パレット"
              />
              <span>
                <strong>カラーホイール／パレット</strong>
                <small>色の面を押して標準カラーUIを開きます</small>
              </span>
            </label>

            <div className={styles.rgbFields}>
              {(['r', 'g', 'b'] as const).map(channel => (
                <label key={channel} className={styles.colorNumberField}>
                  <span>{channel.toUpperCase()}</span>
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={rgb[channel]}
                    onChange={event => updateRgb(channel, event.target.value)}
                    aria-label={channel.toUpperCase()}
                  />
                </label>
              ))}
            </div>

            <label className={styles.hexField}>
              <span>HEX</span>
              <div className={styles.hexInputWrapper}>
                <span>#</span>
                <input
                  value={hexDraft}
                  inputMode="text"
                  spellCheck={false}
                  maxLength={6}
                  onChange={event => updateHex(event.target.value)}
                  onBlur={() => setHexDraft(normalizedColor.slice(1))}
                  aria-label="16進数カラー"
                />
              </div>
            </label>

            <div className={styles.colorPickerPreview}>
              <span style={{ backgroundColor: normalizedColor }} />
              <code>{normalizedColor}</code>
              <span>RGB {rgb.r}, {rgb.g}, {rgb.b}</span>
            </div>

            <button
              type="button"
              className={styles.colorPickerDone}
              onClick={() => setOpen(false)}
            >決定</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
