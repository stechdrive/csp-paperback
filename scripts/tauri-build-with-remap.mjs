#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { homedir, tmpdir } from 'node:os'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
if (args.length === 0) {
  args.push(...defaultReleaseArgs())
}
const env = { ...process.env }
const encodedSeparator = '\x1f'

const remapFlags = collectRemapPrefixes().map(({ from, to }) => (
  `--remap-path-prefix=${from}=${to}`
))

if (process.platform === 'win32') {
  env.RUSTFLAGS = [env.RUSTFLAGS, ...remapFlags.map(quoteRustFlag)].filter(Boolean).join(' ')
  delete env.CARGO_ENCODED_RUSTFLAGS
} else {
  const existingEncodedFlags = env.CARGO_ENCODED_RUSTFLAGS
    ? env.CARGO_ENCODED_RUSTFLAGS.split(encodedSeparator).filter(Boolean)
    : []
  env.CARGO_ENCODED_RUSTFLAGS = [...existingEncodedFlags, ...remapFlags].join(encodedSeparator)
  delete env.RUSTFLAGS
}

const command = process.platform === 'win32' ? 'cmd.exe' : 'tauri'
const commandArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', ['tauri', 'build', ...args].map(quoteShellArg).join(' ')]
  : ['build', ...args]
const child = spawn(command, commandArgs, {
  stdio: 'inherit',
  env,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})

child.on('error', error => {
  console.error(error)
  process.exit(1)
})

function collectRemapPrefixes() {
  const prefixes = new Map()
  addPrefix(prefixes, process.cwd(), '.')
  addPrefix(prefixes, resolve('src-tauri'), './src-tauri')
  addPrefix(prefixes, homedir(), '~')
  addPrefix(prefixes, tmpdir(), '$TMP')
  if (process.env.CARGO_HOME) addPrefix(prefixes, process.env.CARGO_HOME, '$CARGO_HOME')
  if (process.env.RUSTUP_HOME) addPrefix(prefixes, process.env.RUSTUP_HOME, '$RUSTUP_HOME')
  return [...prefixes.values()]
}

function defaultReleaseArgs() {
  if (process.platform === 'win32') return ['--no-bundle']
  if (process.platform === 'darwin') return ['--target', 'aarch64-apple-darwin', '--bundles', 'dmg']
  return []
}

function addPrefix(prefixes, from, to) {
  if (!from) return
  const normalized = resolve(from)
  prefixes.set(normalized.toLowerCase(), { from: normalized, to })
  const slashNormalized = normalized.replaceAll('\\', '/')
  prefixes.set(slashNormalized.toLowerCase(), { from: slashNormalized, to })
}

function quoteRustFlag(flag) {
  if (!/\s/.test(flag)) return flag
  return `"${flag.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

function quoteShellArg(arg) {
  if (!/[ \t"&<>^|]/.test(arg)) return arg
  return `"${arg.replaceAll('"', '\\"')}"`
}
