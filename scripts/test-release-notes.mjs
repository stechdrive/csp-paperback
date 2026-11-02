import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { renderReleaseNotes } from './release-notes.mjs'

test('release notes contain only the original Japanese release date, version and fixed notice', () => {
  const notice = '起動の案内\n\n「**詳細情報**」→「**実行**」\n'
  assert.equal(renderReleaseNotes({
    tag: 'v1.43.324', publishedAt: '2026-11-02T17:12:53Z',
    now: new Date('2027-01-01T00:00:00Z'), notice,
  }), 'リリース日：2026-11-03 ／ バージョン：1.43.324\n\n' + notice)
})

test('a new draft uses the publication day in Japan', () => {
  for (const publishedAt of [undefined, null, '']) {
    assert.equal(renderReleaseNotes({
      tag: 'v2.0.400', publishedAt, now: new Date('2026-11-03T15:01:00Z'), notice: '案内',
    }), 'リリース日：2026-11-04 ／ バージョン：2.0.400\n\n案内\n')
  }
})

test('invalid release metadata and a missing notice fail instead of emitting misleading notes', () => {
  for (const extra of [
    { tag: 'v1.2.3\nother' }, { tag: undefined }, { publishedAt: 'not-a-date' }, { notice: '' },
  ]) {
    assert.throws(() => renderReleaseNotes({
      tag: 'v1.2.3', publishedAt: '2026-11-02T00:00:00Z', notice: '案内', ...extra,
    }), /Unexpected release tag|Invalid release date|Missing release notice/)
  }
})

test('the release CLI uses the maintained notice without adding update history', () => {
  const notice = readFileSync(new URL('../.github/release-notes.md', import.meta.url), 'utf8')
  const output = execFileSync(process.execPath, [
    fileURLToPath(new URL('./release-notes.mjs', import.meta.url)), 'v9.8.7', '2026-11-02T17:12:53Z',
  ], { encoding: 'utf8' })
  assert.equal(output, 'リリース日：2026-11-03 ／ バージョン：9.8.7\n\n' + notice.trim() + '\n')
})

for (const extension of ['.exe', '.dmg']) {
  test('desktop staging keeps a fixed ' + extension + ' filename and preserves bytes across versions', t => {
    const directory = mkdtempSync(join(tmpdir(), 'paperback-release-stage-'))
    t.after(() => {
      const target = relative(tmpdir(), directory)
      assert.ok(target && !target.startsWith('..') && !isAbsolute(target))
      rmSync(directory, { recursive: true, force: true })
    })
    const workflow = readFileSync(new URL('../.github/workflows/desktop-build.yml', import.meta.url), 'utf8')
    const match = workflow.match(/node --input-type=module <<'NODE'\r?\n([\s\S]*?)\r?\n\s*NODE/)
    assert.ok(match, 'Desktop staging script must exist')
    const script = match[1].split('\n').map(line => line.replace(/^ {10}/, '')).join('\n')
    const source = join(directory, 'versioned-input' + extension)
    const bytes = Buffer.from('preserve the exact audited artifact bytes')
    writeFileSync(source, bytes)
    for (const version of ['1.43.324', '99.100.999']) {
      writeFileSync(join(directory, 'package.json'), JSON.stringify({ version }))
      execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: directory,
        env: { ...process.env, ARTIFACT_PATHS: JSON.stringify([source]), ASSET_EXTENSION: extension, ASSET_PLATFORM: 'any-platform' },
      })
      const output = join(directory, 'release-assets')
      assert.deepEqual(readdirSync(output), ['csp-paperback' + extension])
      assert.deepEqual(readFileSync(join(output, 'csp-paperback' + extension)), bytes)
    }
  })
}
