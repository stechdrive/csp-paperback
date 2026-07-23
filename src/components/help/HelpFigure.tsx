import styles from '../HelpDialog.module.css'

interface HelpHighlight {
  label: string
  x: number
  y: number
  width: number
  height: number
}

interface HelpFigureProps {
  src: string
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
  return (
    <figure className={`${styles.figure} ${compact ? styles.figureCompact : ''}`}>
      <div className={styles.figureFrame}>
        <img
          className={styles.figureImage}
          src={`${import.meta.env.BASE_URL}help/${src}`}
          alt={alt}
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
          >
            <span className={styles.figureHighlightLabel}>{highlight.label}</span>
          </span>
        ))}
      </div>
      <figcaption className={styles.figureCaption}>{caption}</figcaption>
    </figure>
  )
}
