import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { pruneReleases } from './prune-releases.mjs'

function release(id, tag, extra = {}) {
  return { id, tag_name: tag, draft: false, prerelease: false, published_at: '2026-01-01T00:00:00Z',
    assets: ['ja-macos-arm64.dmg', 'ja-windows-x64-portable.exe'].map(platform => ({
      name: `CSP-Paperback_${tag.slice(1)}_${platform}`, state: 'uploaded', size: 100,
    })), ...extra }
}

function fixture({ latest = release(3, 'v1.41.315'), pages, latestSequence, failDelete } = {}) {
  const entries = pages ?? [[latest, release(2, 'v1.41.314')], [release(1, 'v1.40.311')]]
  const calls = [], removed = []
  let checks = 0
  const api = args => {
    calls.push(args)
    if (args.length === 1 && args[0] === 'repos/owner/app/releases/latest') {
      return latestSequence?.[checks++] ?? latest
    }
    if (args[0] === '--paginate') {
      assert.deepEqual(args, ['--paginate', '--slurp', 'repos/owner/app/releases?per_page=100'])
      return entries
    }
    assert.deepEqual(args.slice(0, 2), ['--method', 'DELETE'])
    assert.match(args[2], /^repos\/owner\/app\/releases\/\d+$/)
    const id = Number(args[2].split('/').at(-1))
    if (failDelete === id) throw new Error('Delete rejected')
    removed.push(id)
  }
  return { calls, removed, run: (apply = true) => pruneReleases({ repository: 'owner/app', tag: 'v1.41.315', apply, api }) }
}

test('dry run lists every old published release without deleting; apply retains latest and drafts', () => {
  const latest = release(3, 'v1.41.315')
  const f = fixture({ pages: [[latest, release(2, 'v1.41.314')], [release(1, 'v1.40.311'), release(4, 'v1.41.316', { draft: true })]] })
  assert.deepEqual(f.run(false), { retained: 'v1.41.315', candidates: ['v1.41.314', 'v1.40.311'], deleted: [] })
  assert.deepEqual(f.removed, [])
  assert.deepEqual(f.run().deleted, ['v1.41.314', 'v1.40.311'])
  assert.deepEqual(f.removed, [2, 1]) // Only release IDs, never Git ref endpoints.
})

test('a release list containing only latest succeeds without deleting anything', () => {
  const f = fixture({ pages: [[release(3, 'v1.41.315')]] })
  assert.deepEqual(f.run(), { retained: 'v1.41.315', candidates: [], deleted: [] })
  assert.deepEqual(f.removed, [])
})

test('unpublished, prerelease, wrong latest and incomplete assets prevent all deletion', () => {
  for (const extra of [
    { draft: true }, { prerelease: true }, { published_at: null }, { tag_name: 'v1.41.314' },
    { assets: [] }, { assets: [{ name: 'wrong.exe', state: 'uploaded', size: 100 }] },
    { assets: release(3, 'v1.41.315').assets.map(asset => ({ ...asset, state: 'new' })) },
    { assets: release(3, 'v1.41.315').assets.map(asset => ({ ...asset, size: 0 })) },
  ]) {
    const f = fixture({ latest: release(3, 'v1.41.315', extra) })
    assert.throws(() => f.run(), /not ready|completed desktop assets/)
    assert.deepEqual(f.removed, [])
  }
})

test('a newer or unknown release on a later page prevents deletion of earlier candidates', () => {
  for (const tag of ['v1.41.316', 'v1.42.1', 'v2.0.1', 'v1.41.315', 'unexpected']) {
    const f = fixture({ pages: [[release(3, 'v1.41.315'), release(2, 'v1.41.314')], [release(4, tag)]] })
    assert.throws(() => f.run(), /not older|Unexpected release tag/)
    assert.deepEqual(f.removed, [])
  }
  const missing = fixture({ pages: [[release(2, 'v1.41.314')]] })
  assert.throws(() => missing.run(), /missing from the release list/)
  assert.deepEqual(missing.removed, [])
})

test('a latest-release change before or during cleanup stops subsequent deletion', () => {
  const latest = release(3, 'v1.41.315'), newer = release(4, 'v1.41.316')
  for (const [sequence, removed] of [
    [[latest, newer], []],
    [[latest, latest, newer], [2]],
    [[latest, { ...latest, id: 5 }], []],
  ]) {
    const f = fixture({ latestSequence: sequence })
    assert.throws(() => f.run(), /Latest published release changed/)
    assert.deepEqual(f.removed, removed)
  }
})

test('a failed delete stops the cleanup and reports failure', () => {
  const f = fixture({ failDelete: 2 })
  assert.throws(() => f.run(), /Delete rejected/)
  assert.deepEqual(f.removed, [])
})

test('release workflow runs cleanup after publication and quality gates include these tests', () => {
  const workflow = readFileSync(new URL('../.github/workflows/desktop-release.yml', import.meta.url), 'utf8')
  const publishJob = workflow.slice(workflow.indexOf('\n  publish-desktop-release:'))
  const publish = publishJob.indexOf('--draft=false --prerelease=false')
  const prune = publishJob.indexOf('node scripts/prune-releases.mjs "$GITHUB_REPOSITORY" "$TAG_NAME" --apply')
  assert.ok(publish >= 0 && prune > publish, 'Cleanup must be wired after successful publication')
  assert.match(publishJob, /ref: \$\{\{ github\.workflow_sha \}\}/)
  const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.ok(scripts['test:deploy'].includes('scripts/test-prune-releases.mjs'))
  assert.ok(scripts['check:ci'].includes('npm run test:deploy'))
})

test('parallel release publication still requires all original quality checks and both audited builds', () => {
  const readWorkflow = name => readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8')
  const release = readWorkflow('desktop-release')
  const quality = readWorkflow('quality-gate')
  const desktop = readWorkflow('desktop-build')
  const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  for (const command of scripts['check:ci'].split(' && ')) {
    assert.ok(quality.includes(command), `Shared CI must retain ${command}`)
  }
  assert.match(release, /needs: \[quality-gate, build-desktop\]/)
  assert.match(quality, /fail-fast: false/)
  assert.match(quality, /needs: \[checks, browser-tests\]/)
  assert.ok(quality.includes('test "$CHECKS_RESULT" = success && test "$BROWSER_RESULT" = success'))
  assert.match(desktop, /cargo test --locked --manifest-path src-tauri\/Cargo.toml --lib/)
  assert.ok(desktop.indexOf('npm run audit:artifacts -- dist --tauri') < desktop.indexOf('name: Upload audited desktop asset'))
  assert.doesNotMatch(desktop, /tagName:|releaseId:|contents: write/)
})
