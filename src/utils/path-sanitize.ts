/**
 * ZIP エントリパス用のサニタイザ。
 *
 * 目的: PSD のレイヤー名・仮想セット名・processTable の suffix など、ユーザが自由に
 *      命名できる値が ZIP エントリパスにそのまま流れると、以下のリスクがある:
 *
 * - **Zip Slip**: エントリ名に `..` が含まれると展開先の外にファイルが配置される
 *                 (https://snyk.io/research/zip-slip-vulnerability)
 * - **OS 固有の不正な名前**: Windows では `<>:"|?*` や予約名 (CON, PRN 等) が使えない
 * - **制御文字**: NUL, 改行等が混入するとターミナル/FS で予期せぬ挙動を起こす
 * - **先頭末尾の空白/ドット**: Windows が自動削除して別名との衝突や破壊を起こす
 *
 * 本モジュールは「ZIP に書き出す直前」に path を正規化することで、
 * どんな不正な名前が上流から来ても ZIP エントリは安全な形に揃うことを保証する。
 *
 * なお、サニタイズ後にエントリ名が衝突した場合は、呼び出し側の resolveEntryNames で
 * `_2`, `_3` サフィックスを付けて再解決する前提。
 */

/** Windows で予約されているベース名(大文字小文字無視) */
const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM0', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT0', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
])

/**
 * パスセグメント 1 つ(= `/` で区切られた 1 要素)をサニタイズする。
 *
 * 処理順:
 * 1. パス区切り `/` `\` を `_` に置換(保険: セグメントには本来含まれないが、
 *    上流がうっかり埋めるケースを吸収)
 * 2. Windows 禁則文字 `<>:"|?*` を `_` に置換
 * 3. 制御文字(0x00〜0x1f, 0x7f)を削除
 * 4. `.` と `..` というドットのみのセグメントは `_` に置換
 *    (実体としてディレクトリトラバーサルを指すケース)
 * 5. 先頭末尾の空白とドットを trim(Windows がこれを自動削除してしまうため)
 * 6. trim 後に空なら `_` を返す
 * 7. Windows 予約名(ベース名のみ、拡張子無視で比較)に該当すれば先頭に `_` を付与
 * 8. UTF-8 エンコード長が 255 byte を超えるなら truncate(末尾の拡張子を保持)
 */
export function sanitizePathSegment(segment: string): string {
  if (!segment) return '_'

  // 1. パス区切りを潰す
  let s = segment.replace(/[/\\]/g, '_')

  // 2. Windows 禁則文字
  s = s.replace(/[<>:"|?*]/g, '_')

  // 3. 制御文字 (0x00-0x1F, 0x7F) を削除
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x1f\x7f]/g, '')

  // 4. `.` と `..` という「ドットのみ」のセグメントは危険なので置換
  if (s === '.' || s === '..') return '_'

  // 5. 先頭末尾の空白とドットを trim
  s = s.replace(/^[\s.]+/, '').replace(/[\s.]+$/, '')

  // 6. 空になったら _
  if (!s) return '_'

  // 7. Windows 予約名チェック(ベース名のみ比較、拡張子は無視)
  const dotIdx = s.indexOf('.')
  const baseName = dotIdx >= 0 ? s.slice(0, dotIdx) : s
  if (WINDOWS_RESERVED_NAMES.has(baseName.toUpperCase())) {
    s = `_${s}`
  }

  // 8. UTF-8 で 255 byte を超える場合は truncate
  s = truncateUtf8(s, 255)

  return s
}

/**
 * ZIP エントリパス全体をサニタイズする。
 *
 * `/` 区切りで分割し、各セグメントを sanitizePathSegment で処理してから再結合する。
 * 空セグメント(`//` の連続、先頭末尾の `/` 等)は除去される。
 *
 * 入力が完全に空になった場合は `_` を返す(ZIP エントリ名は空不可)。
 */
export function sanitizeZipPath(path: string): string {
  if (!path) return '_'
  // 先に「空セグメント(`//` の連続、先頭末尾の `/` 由来)」を除去してからサニタイズ。
  // sanitizePathSegment は空文字列を `_` に変換するので、フィルタは必ず先にやる。
  const rawSegments = path.split('/').filter(s => s !== '')
  if (rawSegments.length === 0) return '_'
  const segments = rawSegments.map(sanitizePathSegment)
  return segments.join('/')
}

/**
 * 文字列を UTF-8 エンコード後のバイト長で truncate する。
 * マルチバイト境界を超えないよう安全に切る。拡張子があれば末尾を維持する。
 */
function truncateUtf8(s: string, maxBytes: number): string {
  // encode して長さ確認
  const encoder = new TextEncoder()
  const bytes = encoder.encode(s)
  if (bytes.length <= maxBytes) return s

  // 拡張子を取り分ける(最後のドット以降、ただし 32 byte 以内のものだけ拡張子として扱う)
  const dotIdx = s.lastIndexOf('.')
  const ext = dotIdx >= 0 && encoder.encode(s.slice(dotIdx)).length <= 32
    ? s.slice(dotIdx)
    : ''
  const extBytes = encoder.encode(ext).length
  const baseBudget = maxBytes - extBytes
  if (baseBudget <= 0) {
    // 拡張子単独で溢れる極端ケース: 拡張子を諦めてベース名を truncate
    return truncateUtf8Raw(s, maxBytes)
  }

  const baseRaw = ext ? s.slice(0, dotIdx) : s
  return truncateUtf8Raw(baseRaw, baseBudget) + ext
}

/** 文字列を UTF-8 バイト長で安全に truncate する(拡張子考慮なし) */
function truncateUtf8Raw(s: string, maxBytes: number): string {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder('utf-8', { fatal: false })
  const bytes = encoder.encode(s)
  if (bytes.length <= maxBytes) return s
  // maxBytes で切ると UTF-8 マルチバイト境界を跨ぐ可能性がある
  // decoder は不完全バイトを置換文字に置き換える(fatal: false)ので、
  // 末尾の置換文字を取り除いて安定させる
  const truncated = bytes.slice(0, maxBytes)
  const decoded = decoder.decode(truncated)
  // U+FFFD (replacement character) が末尾に出ていたら取り除く
  return decoded.replace(/\uFFFD+$/, '')
}
