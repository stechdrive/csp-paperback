import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { publishPages } from './deploy-pages.mjs'

const repository = fileURLToPath(new URL('..', import.meta.url))
const testRoot = path.join(repository, '.tmp', 'test-temp')
mkdirSync(testRoot, { recursive: true })
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trimEnd()
function write(root, name, content) {
  const target = path.join(root, name)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, content)
}
function fixture(run) {
  const directory = mkdtempSync(path.join(testRoot, 'pages-test-'))
  const root = path.join(directory, 'source'), remote = path.join(directory, 'remote.git')
  mkdirSync(root); git(root, 'init', '--quiet', '--initial-branch=main')
  git(root, 'config', 'user.name', 'Pages Test'); git(root, 'config', 'user.email', 'pages-test@example.invalid')
  write(root, '.gitignore', 'dist/\n.tmp/\n'); write(root, 'source.txt', 'Do not change\n')
  git(root, 'add', '--', '.gitignore', 'source.txt'); git(root, 'commit', '--quiet', '-m', 'source')
  git(directory, 'init', '--quiet', '--bare', remote)
  write(root, 'dist/index.html', '<!doctype html><title>test</title>\n')
  const before = { head: git(root, 'rev-parse', 'HEAD'), status: git(root, 'status', '--porcelain') }
  const publish = (enabled = true) => publishPages({ root, repoUrl: remote, publish: enabled })
  const verifySource = () => {
    assert.deepEqual({ head: git(root, 'rev-parse', 'HEAD'), status: git(root, 'status', '--porcelain') }, before)
    assert.equal(readFileSync(path.join(root, 'source.txt'), 'utf8'), 'Do not change\n')
    assert.deepEqual(readdirSync(path.join(root, '.tmp')), [])
  }
  // Retain a failing fixture for diagnosis. Successful fixtures only are removed.
  run({ directory, root, remote, publish, verifySource })
  const target = realpathSync(directory)
  assert.equal(path.dirname(target), realpathSync(testRoot))
  assert.ok(path.basename(target).startsWith('pages-test-'))
  rmSync(target, { recursive: true, force: true })
}

test('publishes exact bytes and literal names, ignores source dotfiles, and skips identical trees', () => fixture(({ root, remote, publish, verifySource }) => {
  const names = ['assets/app.js', '-leading.txt', ' 空白 {素材}.txt', 'assets/日本語.bin']
  for (const name of names) write(root, `dist/${name}`, Buffer.from([0, 10, 13, 127, 255]))
  write(root, 'dist/.private', 'private'); write(root, 'dist/.hidden/secret', 'private')
  const first = publish()
  assert.equal(first.published, true)
  assert.equal(first.files, 5)
  assert.deepEqual(git(remote, 'ls-tree', '-rz', '--name-only', 'gh-pages').split('\0').filter(Boolean).sort(), ['index.html', ...names].sort())
  for (const name of names) {
    const content = execFileSync('git', ['show', `gh-pages:${name}`], { cwd: remote })
    assert.ok(content.equals(readFileSync(path.join(root, 'dist', name))))
  }
  assert.deepEqual(publish(), { ...first, changed: false, published: false })
  assert.equal(git(remote, 'rev-list', '--count', 'gh-pages'), '1')
  verifySource()
}))

test('updates the branch without losing history or existing dotfiles and removes obsolete visible files', () => fixture(({ directory, root, remote, publish, verifySource }) => {
  write(root, 'dist/obsolete.txt', 'old'); publish()
  const seed = path.join(directory, 'seed')
  git(directory, 'clone', '--quiet', '--branch', 'gh-pages', remote, seed)
  git(seed, 'config', 'user.name', 'Pages Test'); git(seed, 'config', 'user.email', 'pages-test@example.invalid')
  write(seed, '.nojekyll', ''); write(seed, 'assets/.keep', 'keep\n')
  git(seed, 'add', '--', '.nojekyll', 'assets/.keep'); git(seed, 'commit', '--quiet', '-m', 'site metadata')
  git(seed, 'push', '--quiet', 'origin', 'gh-pages')
  const parent = git(remote, 'rev-parse', 'gh-pages')
  unlinkSync(path.join(root, 'dist', 'obsolete.txt'))
  write(root, 'dist/index.html', '<!doctype html><title>updated</title>\n')
  write(root, 'dist/assets/new.js', 'updated\n')
  const result = publish()
  assert.equal(result.published, true)
  assert.equal(git(remote, 'rev-parse', 'gh-pages^'), parent)
  assert.deepEqual(git(remote, 'ls-tree', '-rz', '--name-only', 'gh-pages').split('\0').filter(Boolean).sort(), ['.nojekyll', 'assets/.keep', 'assets/new.js', 'index.html'])
  assert.equal(git(remote, 'show', 'gh-pages:assets/.keep'), 'keep')
  verifySource()
}))

test('dry run assembles the same tree without pushing', () => fixture(({ root, remote, publish, verifySource }) => {
  const first = publish()
  write(root, 'dist/index.html', 'changed\n')
  const dry = publish(false)
  assert.equal(dry.published, false); assert.equal(dry.changed, true)
  assert.equal(git(remote, 'rev-parse', 'gh-pages'), first.commit)
  assert.equal(publish().tree, dry.tree)
  verifySource()
}))

test('refuses missing index and linked directories before changing the destination', () => fixture(({ directory, root, remote, publish }) => {
  const first = publish()
  unlinkSync(path.join(root, 'dist', 'index.html'))
  assert.throws(() => publish(), /index.html is missing/)
  write(root, 'dist/index.html', 'ok\n')
  const outside = path.join(directory, 'outside')
  mkdirSync(outside); write(outside, 'secret.txt', 'must not be published')
  symlinkSync(outside, path.join(root, 'dist', 'linked'), 'junction')
  assert.throws(() => publish(), /symbolic link/)
  assert.equal(git(remote, 'rev-parse', 'gh-pages'), first.commit)
}))

test('a rejected push leaves the source and published branch unchanged', () => fixture(({ root, remote, publish, verifySource }) => {
  const first = publish()
  write(remote, 'hooks/pre-receive', '#!/bin/sh\nexit 1\n')
  // Executable permission is required for Git hooks on Unix.
  chmodSync(path.join(remote, 'hooks', 'pre-receive'), 0o755)
  write(root, 'dist/index.html', 'rejected update\n')
  assert.throws(() => publish(), /git push failed/)
  assert.equal(git(remote, 'rev-parse', 'gh-pages'), first.commit)
  verifySource()
}))
