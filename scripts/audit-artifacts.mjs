#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import { gunzipSync } from 'node:zlib'

const args = process.argv.slice(2)
const includeTauri = takeFlag('--tauri')
const roots = args.map(arg => resolve(arg))

if (roots.length === 0 && !includeTauri) {
  console.error('Usage: node scripts/audit-artifacts.mjs [--tauri] <artifact-path>...')
  process.exit(2)
}

if (includeTauri) {
  roots.push(...collectTauriArtifactRoots(resolve('src-tauri', 'target')))
}

const existingRoots = roots.filter(root => existsSync(root))
const missingRoots = roots.filter(root => !existsSync(root))
if (missingRoots.length > 0 && !includeTauri) {
  for (const root of missingRoots) console.error(`Missing artifact path: ${root}`)
  process.exit(2)
}

const findings = []
for (const root of existingRoots) {
  scanPath(root)
}

if (findings.length > 0) {
  console.error('Artifact path audit failed. Potential build/developer paths were found:')
  for (const finding of findings.slice(0, 50)) {
    console.error(`- ${finding.file}: ${finding.pattern} -> ${finding.snippet}`)
  }
  if (findings.length > 50) {
    console.error(`...and ${findings.length - 50} more findings`)
  }
  process.exit(1)
}

console.log(`Artifact path audit passed (${existingRoots.length} root${existingRoots.length === 1 ? '' : 's'} scanned).`)

function takeFlag(flag) {
  const index = args.indexOf(flag)
  if (index < 0) return false
  args.splice(index, 1)
  return true
}

function collectTauriArtifactRoots(targetRoot) {
  if (!existsSync(targetRoot)) return []
  const roots = []
  walkDirs(targetRoot, dir => {
    if (basename(dir) !== 'release') return
    for (const binaryName of ['csp-paperback', 'csp-paperback.exe']) {
      const binary = join(dir, binaryName)
      if (existsSync(binary)) roots.push(binary)
    }
    const bundle = join(dir, 'bundle')
    if (existsSync(bundle)) roots.push(bundle)
  })
  return roots
}

function walkDirs(dir, onDir) {
  onDir(dir)
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const child = join(dir, entry.name)
    if (shouldSkipDirectory(child)) continue
    walkDirs(child, onDir)
  }
}

function shouldSkipDirectory(dir) {
  const normalized = dir.split(sep).join('/')
  return /\/(?:build|deps|examples|incremental|\.fingerprint)(?:\/|$)/.test(normalized)
}

function scanPath(path) {
  const stats = statSync(path)
  if (stats.isDirectory()) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      scanPath(join(path, entry.name))
    }
    return
  }
  if (!stats.isFile()) return
  scanFile(path)
}

function scanFile(file) {
  const buffer = readFileSync(file)
  scanBuffer(file, buffer)

  if (/\.(?:tar\.gz|tgz)$/i.test(file)) {
    scanTarBuffer(file, gunzipSync(buffer))
  } else if (/\.gz$/i.test(file)) {
    scanBuffer(`${file}#gunzip`, gunzipSync(buffer))
  }
}

function scanTarBuffer(file, buffer) {
  let offset = 0
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break

    const name = readTarString(header, 0, 100)
    const prefix = readTarString(header, 345, 155)
    const fullName = prefix ? `${prefix}/${name}` : name
    const sizeOctal = readTarString(header, 124, 12).trim()
    const size = Number.parseInt(sizeOctal || '0', 8)
    const contentStart = offset + 512
    const contentEnd = contentStart + size

    scanText(`${file}#${fullName}:path`, fullName)
    if (size > 0 && contentEnd <= buffer.length) {
      scanBuffer(`${file}#${fullName}`, buffer.subarray(contentStart, contentEnd))
    }

    offset = contentStart + Math.ceil(size / 512) * 512
  }
}

function readTarString(buffer, offset, length) {
  const slice = buffer.subarray(offset, offset + length)
  const end = slice.indexOf(0)
  return slice.subarray(0, end >= 0 ? end : slice.length).toString('utf8')
}

function scanBuffer(file, buffer) {
  scanText(`${file}:utf8`, buffer.toString('utf8'))
  scanText(`${file}:utf16le`, buffer.toString('utf16le'))
}

function scanText(file, text) {
  for (const pattern of buildPatterns()) {
    pattern.regex.lastIndex = 0
    let match
    while ((match = pattern.regex.exec(text)) !== null) {
      findings.push({
        file,
        pattern: pattern.name,
        snippet: compactSnippet(match[0]),
      })
      if (match[0].length === 0) pattern.regex.lastIndex += 1
    }
  }
}

function buildPatterns() {
  const workspace = process.cwd()
  const home = process.env.HOME || process.env.USERPROFILE || ''
  const escapedLiterals = [
    workspace,
    workspace.replaceAll('\\', '/'),
    home,
    home.replaceAll('\\', '/'),
  ].filter(Boolean)

  return [
    ...escapedLiterals.map(value => ({
      name: `literal:${value}`,
      regex: new RegExp(escapeRegExp(value), 'gi'),
    })),
    {
      name: 'windows-user-profile',
      regex: /[A-Z]:[\\/]+Users[\\/]+[^\\/\0\r\n"'<>| ]+/gi,
    },
    {
      name: 'windows-github-runner',
      regex: /[A-Z]:[\\/]+a[\\/]+[^\\/\0\r\n"'<>| ]+/gi,
    },
    {
      name: 'windows-dev-folder',
      regex: /[A-Z]:[\\/]+(?:GitHub|workspaces|workspace)[\\/]+[^\\/\0\r\n"'<>| ]+/gi,
    },
    {
      name: 'posix-github-runner',
      regex: /\/(?:home\/runner|Users\/runner|github\/workspace|__w)\/[^\0\r\n"'<> ]+/g,
    },
    {
      name: 'posix-user-profile',
      regex: /\/Users\/(?!Shared(?:\/|$))[^/\0\r\n"'<> ]+\/[^\0\r\n"'<> ]*/g,
    },
    {
      name: 'posix-temp-build-path',
      regex: /\/(?:private\/var\/folders|var\/folders|workspaces)\/[^\0\r\n"'<> ]+/g,
    },
  ]
}

function compactSnippet(value) {
  const compact = value.replace(/\s+/g, ' ')
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
