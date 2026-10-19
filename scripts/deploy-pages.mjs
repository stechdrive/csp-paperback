import { spawnSync } from 'node:child_process'
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const branch = 'refs/heads/gh-pages'
const hidden = name => name.split('/').some(part => part.startsWith('.'))

function git(cwd, args, input, accepted = [0]) {
  const result = spawnSync('git', args, { cwd, input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  if (result.error) throw result.error
  if (!accepted.includes(result.status)) {
    const detail = result.stderr.trim().replace(/(https?:\/\/)[^\s/@]+@/g, '$1[redacted]@')
    throw new Error(`git ${args[0]} failed (${result.status}): ${detail}`)
  }
  return { text: result.stdout.trim(), output: result.stdout, status: result.status }
}

function distFiles(directory) {
  if (!lstatSync(directory).isDirectory()) throw new Error('dist must be a real directory')
  const files = []
  function visit(relative = '') {
    for (const entry of readdirSync(path.join(directory, relative), { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue // Match the previous publisher's default.
      const name = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isSymbolicLink()) throw new Error(`dist contains a symbolic link: ${name}`)
      if (entry.isDirectory()) visit(name)
      else if (entry.isFile()) files.push(name)
      else throw new Error(`dist contains a non-regular file: ${name}`)
    }
  }
  visit()
  if (!files.includes('index.html')) throw new Error('dist/index.html is missing; run the Web build first')
  return files.sort()
}

/** Publish the fixed dist tree, without glob expansion or changing the source checkout. */
export function publishPages({ root, repoUrl, publish = false }) {
  root = realpathSync(root)
  const dist = path.join(root, 'dist'), files = distFiles(dist)
  const remote = repoUrl ?? git(root, ['remote', 'get-url', 'origin']).text
  if (!remote || remote.startsWith('-')) throw new Error('Invalid publication remote')

  const tempRoot = path.join(root, '.tmp')
  mkdirSync(tempRoot, { recursive: true })
  if (realpathSync(tempRoot) !== tempRoot) throw new Error('Publication workspace must remain inside the repository')
  const work = mkdtempSync(path.join(tempRoot, 'pages-'))
  try {
    // A separate repository and index keep main, its index and working files untouched.
    git(work, ['init', '--quiet', '--initial-branch=gh-pages'])
    const existing = git(work, ['ls-remote', '--exit-code', '--heads', '--', remote, branch], undefined, [0, 2])
    let parent
    if (existing.status === 0) {
      git(work, ['fetch', '--quiet', '--no-tags', '--depth=1', '--', remote, branch])
      parent = git(work, ['rev-parse', 'FETCH_HEAD']).text
      git(work, ['read-tree', parent])
      // Keep existing dotfiles such as .nojekyll, as gh-pages did by default.
      const previous = git(work, ['ls-files', '-z']).output.split('\0').filter(name => name && !hidden(name))
      if (previous.length) git(work, ['update-index', '--force-remove', '-z', '--stdin'], `${previous.join('\0')}\0`)
    } else git(work, ['read-tree', '--empty'])

    for (const name of files) {
      const filename = path.join(dist, name), stat = lstatSync(filename)
      if (!stat.isFile()) throw new Error(`dist changed during publication: ${name}`)
      const hash = git(work, ['hash-object', '-w', '--stdin'], readFileSync(filename)).text
      const mode = stat.mode & 0o111 ? '100755' : '100644'
      git(work, ['update-index', '-z', '--index-info'], `${mode} ${hash}\t${name}\0`)
    }
    const tree = git(work, ['write-tree']).text
    if (parent && tree === git(work, ['rev-parse', `${parent}^{tree}`]).text) {
      return { changed: false, published: false, files: files.length, tree, commit: parent }
    }
    if (!publish) return { changed: true, published: false, files: files.length, tree }

    for (const key of ['user.name', 'user.email']) {
      git(work, ['config', key, git(root, ['config', '--get', key]).text])
    }
    const commit = git(work, ['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', 'Updates']).text
    // No force: reject a concurrent deployment instead of overwriting its history.
    git(work, ['push', '--quiet', '--', remote, `${commit}:${branch}`])
    return { changed: true, published: true, files: files.length, tree, commit }
  } finally {
    const target = realpathSync(work)
    if (path.dirname(target) !== realpathSync(tempRoot) || !path.basename(target).startsWith('pages-')) {
      throw new Error('Refusing to remove a publication workspace outside the repository')
    }
    rmSync(target, { recursive: true, force: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2)
    if (args.some(arg => !['--publish', '--dry-run'].includes(arg)) || args.length > 1) {
      throw new Error('Usage: node scripts/deploy-pages.mjs [--publish | --dry-run]')
    }
    const result = publishPages({ root: path.resolve(fileURLToPath(new URL('..', import.meta.url))), publish: args[0] === '--publish' })
    console.log(result.changed ? `${result.published ? 'Published' : 'Dry run'}: ${result.files} files (${result.tree})` : 'Already up to date')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
