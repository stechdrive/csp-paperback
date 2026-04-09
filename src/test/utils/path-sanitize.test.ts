import { describe, it, expect } from 'vitest'
import { sanitizePathSegment, sanitizeZipPath } from '../../utils/path-sanitize'

describe('sanitizePathSegment', () => {
  it('通常のファイル名はそのまま返す', () => {
    expect(sanitizePathSegment('A_0001.jpg')).toBe('A_0001.jpg')
    expect(sanitizePathSegment('仮想セルテスト.png')).toBe('仮想セルテスト.png')
  })

  it('空文字列は `_` に変換', () => {
    expect(sanitizePathSegment('')).toBe('_')
  })

  it('`/` と `\\` を `_` に置換', () => {
    expect(sanitizePathSegment('a/b')).toBe('a_b')
    expect(sanitizePathSegment('a\\b')).toBe('a_b')
    expect(sanitizePathSegment('a/b\\c/d')).toBe('a_b_c_d')
  })

  it('単独の `.` と `..` は `_` に置換', () => {
    expect(sanitizePathSegment('.')).toBe('_')
    expect(sanitizePathSegment('..')).toBe('_')
  })

  it('`..` を含むが単独ではない場合は残す(文字列として含まれるだけなら安全)', () => {
    expect(sanitizePathSegment('..foo')).toBe('foo')  // 先頭ドットは trim されるので残らない
    expect(sanitizePathSegment('foo..')).toBe('foo')  // 末尾ドットも trim
    expect(sanitizePathSegment('foo..bar')).toBe('foo..bar')  // 中の `..` は OK
  })

  it('Windows 禁則文字 `<>:"|?*` を `_` に置換', () => {
    expect(sanitizePathSegment('a<b>c:d')).toBe('a_b_c_d')
    expect(sanitizePathSegment('a"b|c?d*e')).toBe('a_b_c_d_e')
  })

  it('制御文字 (0x00-0x1F, 0x7F) を削除', () => {
    expect(sanitizePathSegment('a\x00b')).toBe('ab')
    expect(sanitizePathSegment('a\nb\tc\r')).toBe('ab\tc'.replace('\t', ''))  // \t も 0x09 制御文字
    expect(sanitizePathSegment('a\x7fb')).toBe('ab')
    expect(sanitizePathSegment('a\x1fb')).toBe('ab')
  })

  it('先頭末尾の空白とドットを trim(Windows の自動削除対策)', () => {
    expect(sanitizePathSegment('  foo  ')).toBe('foo')
    expect(sanitizePathSegment('...foo...')).toBe('foo')
    expect(sanitizePathSegment(' . foo . ')).toBe('foo')
  })

  it('Windows 予約名はベース名に `_` プレフィックスを付ける', () => {
    expect(sanitizePathSegment('CON')).toBe('_CON')
    expect(sanitizePathSegment('con')).toBe('_con')  // 大文字小文字無視
    expect(sanitizePathSegment('PRN.txt')).toBe('_PRN.txt')  // 拡張子付きでも予約
    expect(sanitizePathSegment('COM1')).toBe('_COM1')
    expect(sanitizePathSegment('LPT9.log')).toBe('_LPT9.log')
    expect(sanitizePathSegment('AUX')).toBe('_AUX')
    expect(sanitizePathSegment('NUL')).toBe('_NUL')
  })

  it('予約名に似ているが別の単語は普通に通す', () => {
    expect(sanitizePathSegment('CONTAINER')).toBe('CONTAINER')
    expect(sanitizePathSegment('NULL')).toBe('NULL')
    expect(sanitizePathSegment('COMPANY')).toBe('COMPANY')
  })

  it('長すぎる名前は UTF-8 255 byte 以内に truncate(拡張子を保持)', () => {
    const longBase = 'a'.repeat(300)
    const input = `${longBase}.jpg`
    const result = sanitizePathSegment(input)
    expect(new TextEncoder().encode(result).length).toBeLessThanOrEqual(255)
    expect(result.endsWith('.jpg')).toBe(true)
  })

  it('マルチバイト文字でも UTF-8 byte 長で正しく truncate', () => {
    // 日本語文字は UTF-8 で 3 byte/字。100 字 = 300 byte になる
    const longName = 'あ'.repeat(100) + '.png'
    const result = sanitizePathSegment(longName)
    expect(new TextEncoder().encode(result).length).toBeLessThanOrEqual(255)
    expect(result.endsWith('.png')).toBe(true)
  })

  it('全部除去されて空になった場合は `_` を返す', () => {
    expect(sanitizePathSegment('...')).toBe('_')
    expect(sanitizePathSegment('   ')).toBe('_')
    expect(sanitizePathSegment('\x00\x01\x02')).toBe('_')
  })
})

describe('sanitizeZipPath', () => {
  it('通常のパスはそのまま返す', () => {
    expect(sanitizeZipPath('A/A_0001.jpg')).toBe('A/A_0001.jpg')
    expect(sanitizeZipPath('B/B_0001_s.jpg')).toBe('B/B_0001_s.jpg')
  })

  it('各セグメントを個別にサニタイズする', () => {
    expect(sanitizeZipPath('CON/file.jpg')).toBe('_CON/file.jpg')
    expect(sanitizeZipPath('a<b>/c|d.jpg')).toBe('a_b_/c_d.jpg')
  })

  it('Zip Slip 典型攻撃 `../../etc/passwd` を無害化', () => {
    const result = sanitizeZipPath('../../etc/passwd')
    // `..` セグメントが全部 `_` に置換されて、絶対的な外部参照にならない
    expect(result).not.toContain('..')
    expect(result).toBe('_/_/etc/passwd')
  })

  it('絶対パス風の先頭 `/` を無害化', () => {
    // split 結果の先頭が空文字列 → filter で除去
    expect(sanitizeZipPath('/etc/passwd')).toBe('etc/passwd')
  })

  it('連続する `/` は空セグメントとして除去', () => {
    expect(sanitizeZipPath('a//b///c')).toBe('a/b/c')
  })

  it('末尾の `/` は除去', () => {
    expect(sanitizeZipPath('a/b/')).toBe('a/b')
  })

  it('空文字列は `_` に変換', () => {
    expect(sanitizeZipPath('')).toBe('_')
  })

  it('`///` だけのパスは `_` に変換', () => {
    expect(sanitizeZipPath('///')).toBe('_')
  })

  it('`.` と `..` のセグメントは `_` に置換される', () => {
    expect(sanitizeZipPath('./foo/../bar')).toBe('_/foo/_/bar')
  })

  it('仮想セット名に `/` が含まれる悪意ケース', () => {
    // ユーザが virtualSet.name を `../secret` と命名するケース
    // 実装としては path の `/` で分割されるので、`../secret.jpg` → `_/secret.jpg`
    expect(sanitizeZipPath('../secret.jpg')).toBe('_/secret.jpg')
  })

  it('長いセグメント + マルチバイトが混ざっても全セグメントが 255 byte 以内', () => {
    const longJa = 'あ'.repeat(200)  // 600 byte
    const result = sanitizeZipPath(`${longJa}/${longJa}.jpg`)
    const encoder = new TextEncoder()
    for (const segment of result.split('/')) {
      expect(encoder.encode(segment).length).toBeLessThanOrEqual(255)
    }
  })
})
