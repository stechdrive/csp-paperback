import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function version(tag) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error(`Unexpected release tag: ${tag}`)
  return tag.slice(1).split('.').map(BigInt)
}

function compareTags(a, b) {
  const left = version(a), right = version(b)
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1
  }
  return 0
}

function verifyLatest(release, tag, id = release?.id) {
  version(tag)
  if (!Number.isSafeInteger(id) || release?.id !== id || release.tag_name !== tag
    || release.draft !== false || release.prerelease !== false || !release.published_at) {
    throw new Error(`Latest published release changed or is not ready: ${tag}`)
  }
  const expected = [
    `CSP-Paperback_${tag.slice(1)}_ja-macos-arm64.dmg`,
    `CSP-Paperback_${tag.slice(1)}_ja-windows-x64-portable.exe`,
  ]
  const assets = release.assets ?? []
  if (assets.length !== expected.length || assets.some(asset => asset.state !== 'uploaded' || !(asset.size > 0))
    || assets.map(asset => asset.name).sort().some((name, i) => name !== expected[i])) {
    throw new Error(`Latest release does not have both completed desktop assets: ${tag}`)
  }
}

function github(args) {
  const output = execFileSync('gh', ['api', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return output.trim() ? JSON.parse(output) : null
}

/** Remove published older releases only; never remove Git tags or in-flight drafts. */
export function pruneReleases({ repository, tag, apply = false, api = github }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || repository.split('/').some(part => ['.', '..'].includes(part))) {
    throw new Error('Expected repository owner/name')
  }
  const base = `repos/${repository}/releases`
  const latest = api([`${base}/latest`])
  verifyLatest(latest, tag)
  const releases = api(['--paginate', '--slurp', `${base}?per_page=100`]).flat()
  if (!releases.some(release => release.id === latest.id && release.tag_name === tag)) {
    throw new Error('Latest release is missing from the release list')
  }
  // Validate the complete list before deleting anything, including later pages.
  const older = releases.filter(release => !release.draft && release.id !== latest.id)
  for (const release of older) {
    if (!Number.isSafeInteger(release.id) || compareTags(release.tag_name, tag) >= 0) {
      throw new Error(`Refusing to delete a release that is not older: ${release.tag_name}`)
    }
  }
  const deleted = []
  if (apply) {
    for (const release of older) {
      verifyLatest(api([`${base}/latest`]), tag, latest.id)
      api(['--method', 'DELETE', `${base}/${release.id}`])
      deleted.push(release.tag_name)
    }
    verifyLatest(api([`${base}/latest`]), tag, latest.id)
  }
  return { retained: tag, candidates: older.map(release => release.tag_name), deleted }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [repository, tag, ...options] = process.argv.slice(2)
    if (!repository || !tag || options.length > 1 || options.some(option => option !== '--apply')) {
      throw new Error('Usage: node scripts/prune-releases.mjs OWNER/REPO vMAJOR.MINOR.BUILD [--apply]')
    }
    console.log(JSON.stringify(pruneReleases({ repository, tag, apply: options.includes('--apply') }), null, 2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
