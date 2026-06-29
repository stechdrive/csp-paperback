#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const args = new Set(process.argv.slice(2))
const checkOnly = args.has('--check')
const force = args.has('--force')
const skipCi = process.env.GITHUB_ACTIONS === 'true' && !force
const skipEnv = process.env.CSP_PAPERBACK_SKIP_VERSION_SYNC === '1' && !force

if (skipCi || skipEnv) {
  const reason = skipCi ? 'GitHub Actions' : 'CSP_PAPERBACK_SKIP_VERSION_SYNC=1'
  console.log(`Build version sync skipped (${reason}).`)
  process.exit(0)
}

const packagePath = 'package.json'
const packageLockPath = 'package-lock.json'
const cargoTomlPath = 'src-tauri/Cargo.toml'
const cargoLockPath = 'src-tauri/Cargo.lock'

const packageJson = readJson(packagePath)
const currentVersion = parseSemver(packageJson.version, packagePath)
const commitCount = getBuildCommitCount()
const buildNumber = Math.max(currentVersion.patch, commitCount)
const nextVersion = `${currentVersion.major}.${currentVersion.minor}.${buildNumber}`

const changed = []
updateJsonVersion(packagePath, nextVersion, changed)
updatePackageLock(packageLockPath, nextVersion, changed)
updateCargoToml(cargoTomlPath, nextVersion, changed)
updateCargoLock(cargoLockPath, nextVersion, changed)

if (changed.length === 0) {
  console.log(`Build version already synced: ${nextVersion}`)
} else if (checkOnly) {
  console.error(`Build version is not synced: ${nextVersion}`)
  for (const file of changed) console.error(`- ${file}`)
  process.exit(1)
} else {
  console.log(`Build version synced: ${nextVersion}`)
  for (const file of changed) console.log(`- ${file}`)
}

function getBuildCommitCount() {
  const raw = execFileSync('git', ['rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim()
  const count = Number(raw)
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`Invalid git commit count: ${raw}`)
  }
  return hasWorkingTreeChanges() ? count + 1 : count
}

function hasWorkingTreeChanges() {
  const raw = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  return raw.length > 0
}

function parseSemver(version, source) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) {
    throw new Error(`${source} version must be plain X.Y.Z semver: ${version}`)
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function writeJsonIfChanged(file, value, changed) {
  const next = `${JSON.stringify(value, null, 2)}\n`
  const current = readFileSync(file, 'utf8')
  if (current === next) return
  changed.push(file)
  if (!checkOnly) writeFileSync(file, next, 'utf8')
}

function updateJsonVersion(file, version, changed) {
  const json = readJson(file)
  json.version = version
  writeJsonIfChanged(file, json, changed)
}

function updatePackageLock(file, version, changed) {
  if (!existsSync(file)) return
  const json = readJson(file)
  json.version = version
  if (json.packages?.['']) {
    json.packages[''].version = version
  }
  writeJsonIfChanged(file, json, changed)
}

function updateCargoToml(file, version, changed) {
  if (!existsSync(file)) return
  const current = readFileSync(file, 'utf8')
  const next = replacePackageVersion(current, version, file)
  if (current === next) return
  changed.push(file)
  if (!checkOnly) writeFileSync(file, next, 'utf8')
}

function replacePackageVersion(text, version, source) {
  const packageStart = text.search(/^\[package\]\s*$/m)
  if (packageStart < 0) throw new Error(`${source} is missing [package]`)

  const rest = text.slice(packageStart + '[package]'.length)
  const nextSectionRelative = rest.search(/^\[[^\]]+\]\s*$/m)
  const blockEnd = nextSectionRelative < 0
    ? text.length
    : packageStart + '[package]'.length + nextSectionRelative
  const before = text.slice(0, packageStart)
  const block = text.slice(packageStart, blockEnd)
  const after = text.slice(blockEnd)
  if (!/^version\s*=\s*"[^"]+"/m.test(block)) {
    throw new Error(`${source} [package] is missing version`)
  }
  const nextBlock = block.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`)
  return `${before}${nextBlock}${after}`
}

function updateCargoLock(file, version, changed) {
  if (!existsSync(file)) return
  const current = readFileSync(file, 'utf8')
  const next = current.replace(
    /(\[\[package\]\]\r?\nname = "csp-paperback"\r?\nversion = ")[^"]+(")/,
    `$1${version}$2`,
  )
  if (current === next) return
  changed.push(file)
  if (!checkOnly) writeFileSync(file, next, 'utf8')
}
