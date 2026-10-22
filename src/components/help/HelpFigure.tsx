import styles from '../HelpDialog.module.css'
import screenshots from './helpScreenshots.json'

export interface HelpHighlight {
  label: string
  x: number
  y: number
  width: number
  height: number
}

interface HelpFigureProps {
  src: keyof typeof screenshots
  alt: string
  caption: string
  compact?: boolean
  highlights: HelpHighlight[]
}

export function HelpFigure({
  src,
  alt,
  caption,
  compact = false,
  highlights,
}: HelpFigureProps) {
  const screenshot = screenshots[src]
  return (
    <figure className={styles.figure} style={{ maxWidth: compact ? Math.min(640, screenshot.width) : screenshot.width }}>
      <div className={styles.figureFrame}>
        <img
          className={styles.figureImage}
          src={`${import.meta.env.BASE_URL}help/${src}?v=${screenshot.sha256.slice(0, 12)}`}
          alt={alt}
          width={screenshot.width}
          height={screenshot.height}
          loading="lazy"
        />
        {highlights.map(highlight => (
          <span
            key={highlight.label}
            className={styles.figureHighlight}
            data-help-highlight={highlight.label}
            style={{
              left: `${highlight.x}%`,
              top: `${highlight.y}%`,
              width: `${highlight.width}%`,
              height: `${highlight.height}%`,
            }}
            aria-hidden="true"
          />
        ))}
      </div>
      <figcaption className={styles.figureCaption}>
        <span className={styles.figureLegend}>赤枠：{highlights.map(highlight => highlight.label).join(' ／ ')}</span>
        {caption}
      </figcaption>
    </figure>
  )
}
