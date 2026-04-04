import type { XdtsData, XdtsTrack } from '../types'

/**
 * xdts XML文字列を解析してXdtsDataを返す
 *
 * xdtsはCSPが書き出すXML形式のタイムシートファイル。
 * trackリストにレイヤー名とCAMが含まれる。
 * CAMはカメラトラックなのでアニメーションフォルダ検出から除外する。
 */
export function parseXdts(xmlText: string): XdtsData {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`Failed to parse xdts: ${parseError.textContent}`)
  }

  const tracks = extractTracks(doc)
  return { tracks }
}

function extractTracks(doc: Document): XdtsTrack[] {
  const tracks: XdtsTrack[] = []

  // xdtsのtrack要素を探す（CSPのフォーマットに準拠）
  // <track> または <Track> 要素のname属性を取得
  const trackElements = doc.querySelectorAll('track, Track')

  if (trackElements.length > 0) {
    for (const el of trackElements) {
      const name = el.getAttribute('name') ?? el.getAttribute('Name') ?? ''
      if (!name) continue
      const isCam = isCAMTrack(name)
      tracks.push({ name, isCam })
    }
    return tracks
  }

  // 代替: <trackItem> 要素からname属性を取得するパターン
  const trackItems = doc.querySelectorAll('trackItem, TrackItem')
  for (const el of trackItems) {
    const name = el.getAttribute('name') ?? el.getAttribute('Name') ?? ''
    if (!name) continue
    const isCam = isCAMTrack(name)
    tracks.push({ name, isCam })
  }

  return tracks
}

/**
 * CAMトラック（カメラ）かどうか判定
 * 大文字小文字を区別せず 'cam' に一致する場合はCAMとみなす
 */
function isCAMTrack(name: string): boolean {
  return name.toLowerCase() === 'cam'
}
