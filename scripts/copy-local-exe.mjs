#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

loadLocalEnv()

const destinationDir = process.env.CSP_PAPERBACK_EXE_COPY_DIR
  || process.env.npm_config_csp_paperback_exe_copy_dir

if (!destinationDir) {
  console.log('Local EXE copy skipped. Set CSP_PAPERBACK_EXE_COPY_DIR to enable it.')
  process.exit(0)
}

if (process.platform !== 'win32') {
  console.log('Local EXE copy skipped. Portable EXE copy is Windows-only.')
  process.exit(0)
}

const source = resolve('src-tauri', 'target', 'release', 'csp-paperback.exe')
if (!existsSync(source)) {
  console.error(`Local EXE copy failed. Built EXE not found: ${source}`)
  process.exit(1)
}

const destinationRoot = resolve(destinationDir)
mkdirSync(destinationRoot, { recursive: true })
const destination = resolve(destinationRoot, basename(source))
copyFileSync(source, destination)
console.log(`Local EXE copied to ${destination}`)

function loadLocalEnv() {
  const localEnvPath = resolve('.env.local')
  if (!existsSync(localEnvPath)) return

  const lines = readFileSync(localEnvPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = unquoteEnvValue(trimmed.slice(separatorIndex + 1).trim())
    if (!key || process.env[key] !== undefined) continue
    process.env[key] = value
  }
}

function unquoteEnvValue(value) {
  if (value.length < 2) return value
  const quote = value[0]
  if ((quote !== '"' && quote !== "'") || value[value.length - 1] !== quote) return value
  const inner = value.slice(1, -1)
  return quote === '"'
    ? inner.replaceAll('\\"', '"').replaceAll('\\\\', '\\')
    : inner
}
