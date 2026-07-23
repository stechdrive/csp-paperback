import styles from '../HelpDialog.module.css'

interface HelpFigureProps {
  src: string
  alt: string
  caption: string
  compact?: boolean
}

export function HelpFigure({ src, alt, caption, compact = false }: HelpFigureProps) {
  return (
    <figure className={`${styles.figure} ${compact ? styles.figureCompact : ''}`}>
      <div className={styles.figureFrame}>
        <img
          className={styles.figureImage}
          src={`${import.meta.env.BASE_URL}help/${src}`}
          alt={alt}
          loading="lazy"
        />
      </div>
      <figcaption className={styles.figureCaption}>{caption}</figcaption>
    </figure>
  )
}
