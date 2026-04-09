import { useState } from 'react'
import type { XdtsTrack } from '../types'
import styles from './UnmatchedTracksWarning.module.css'

interface UnmatchedTracksWarningProps {
  unmatchedTracks: XdtsTrack[]
}

/**
 * XDTS のトラックのうち PSD ツリー内に対応フォルダが見つからなかったもの
 * (= anim folder 割当に失敗したトラック) を警告表示する。
 *
 * 要約バナー(件数のみ)と、クリックで開く詳細ダイアログ(トラック一覧)の 2 段構成。
 * #1 対応の設計 Q1=ダイアログ、Q2=リッチに対応。
 *
 * unmatchedTracks が空のときは何も表示しない。
 */
export function UnmatchedTracksWarning({ unmatchedTracks }: UnmatchedTracksWarningProps) {
  const [showDetail, setShowDetail] = useState(false)

  if (unmatchedTracks.length === 0) return null

  return (
    <>
      <div
        className={styles.banner}
        role="button"
        tabIndex={0}
        onClick={() => setShowDetail(true)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowDetail(true) }}
      >
        <span className={styles.icon} aria-hidden="true">⚠</span>
        <span className={styles.summary}>
          XDTS トラック {unmatchedTracks.length} 件に対応フォルダが見つかりません
        </span>
        <span className={styles.detail}>クリックで詳細</span>
      </div>

      {showDetail && (
        <div
          className={styles.overlay}
          onClick={e => { if (e.target === e.currentTarget) setShowDetail(false) }}
        >
          <div className={styles.dialog}>
            <div className={styles.title}>⚠ 未対応の XDTS トラック</div>
            <div className={styles.description}>
              以下のトラックは XDTS に定義されていますが、PSD ツリー内に対応するアニメフォルダが見つかりませんでした。
              <br />
              PSD とペアでない XDTS を読み込んでいる可能性、またはフォルダ名が異なる可能性があります。
            </div>
            <ul className={styles.list}>
              {unmatchedTracks.map(track => (
                <li key={track.trackNo} className={styles.listItem}>
                  <span className={styles.trackNo}>trackNo {track.trackNo}</span>
                  <span className={styles.trackName}>{JSON.stringify(track.name)}</span>
                </li>
              ))}
            </ul>
            <div className={styles.actions}>
              <button className={styles.closeBtn} onClick={() => setShowDetail(false)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
