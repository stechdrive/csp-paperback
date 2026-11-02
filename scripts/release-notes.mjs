import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function renderReleaseNotes({ tag, publishedAt, notice, now = new Date() }) {
  if (typeof tag !== 'string' || !/^v\d+\.\d+\.\d+$/.test(tag)) {
    throw new Error('Unexpected release tag: ' + tag)
  }
  const releasedAt = new Date(publishedAt || now)
  if (Number.isNaN(releasedAt.getTime())) throw new Error('Invalid release date')
  if (typeof notice !== 'string' || !notice.trim()) throw new Error('Missing release notice')
  const date = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(releasedAt)
  return 'リリース日：' + date + ' ／ バージョン：' + tag.slice(1) + '\n\n' + notice.trim() + '\n'
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [tag, publishedAt, ...extra] = process.argv.slice(2)
    if (!tag || extra.length) throw new Error('Usage: node scripts/release-notes.mjs vMAJOR.MINOR.BUILD [PUBLISHED_AT]')
    const notice = readFileSync(new URL('../.github/release-notes.md', import.meta.url), 'utf8')
    process.stdout.write(renderReleaseNotes({ tag, publishedAt, notice }))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
