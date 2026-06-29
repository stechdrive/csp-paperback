import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeCanvas, writePsdBuffer } from 'ag-psd'
import { createCanvas } from '@napi-rs/canvas'

initializeCanvas((width, height) => createCanvas(width, height))

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const outDir = path.join(repoRoot, 'testdata', 'context-pruning')
const width = 960
const height = 260
const rowHeight = 28

const labels = [
  { key: 'paper', text: './[BG]/paper' },
  { key: 'materialGuide', text: './[素材]/guide' },
  { key: 'materialBook', text: './[素材]/[BOOK]/book' },
  { key: 'materialBg', text: './[素材]/[_BG]/paint' },
  { key: 'animA', text: './[A]/1/body' },
  { key: 'fg', text: './[FG]/overlay' },
].map((label, index) => ({
  ...label,
  top: 18 + index * rowHeight,
  color: colorForIndex(index),
}))

const labelByKey = new Map(labels.map(label => [label.key, label]))

function colorForIndex(index) {
  const hue = (index * 61) % 360
  return `hsl(${hue}, 70%, 42%)`
}

function ensureEmptyDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
}

function labelCanvas(label) {
  const canvas = createCanvas(width, rowHeight)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, width, rowHeight)
  ctx.fillStyle = label.color
  ctx.fillRect(0, 5, 8, 18)
  ctx.font = '14px "Segoe UI", "Yu Gothic", Arial, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#111827'
  ctx.fillText(label.text, 16, 19)
  return canvas
}

function makeLabelLayer(name, key) {
  const label = labelByKey.get(key)
  if (!label) throw new Error(`Unknown label key: ${key}`)
  return {
    name,
    top: label.top,
    left: 0,
    canvas: labelCanvas(label),
    opacity: 1,
    blendMode: 'normal',
  }
}

function makeGroup(name, children, overrides = {}) {
  return {
    name,
    children,
    opened: true,
    sectionDivider: { type: 1 },
    blendMode: 'pass through',
    opacity: 1,
    ...overrides,
  }
}

function toPsdOrder(nodes) {
  return nodes
    .map(node => {
      if (!node.children) return node
      return { ...node, children: toPsdOrder(node.children) }
    })
    .reverse()
}

function writeExpectedPng(filePath, keys) {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, width, height)

  for (const key of keys) {
    const label = labelByKey.get(key)
    if (!label) throw new Error(`Unknown expected label key: ${key}`)
    ctx.drawImage(labelCanvas(label), 0, label.top)
  }

  fs.writeFileSync(filePath, canvas.toBuffer('image/png'))
}

function buildXdts() {
  const json = {
    timeTables: [{
      name: 'context pruning timeline',
      duration: 1,
      frameRate: 24,
      timeTableHeaders: [{
        fieldId: 0,
        names: ['A'],
      }],
      fields: [{
        fieldId: 0,
        tracks: [{
          trackNo: 0,
          frames: [{
            frame: 0,
            data: [{ id: 0, values: ['1'] }],
          }],
        }],
      }],
    }],
    version: 5,
    header: {
      cut: 'context-pruning',
      scene: '1',
    },
  }

  return `exchangeDigitalTimeSheet Save Data\n${JSON.stringify(json, null, 2)}\n`
}

const appTreeTopToBottom = [
  makeLabelLayer('FG', 'fg'),
  makeGroup('A', [
    makeLabelLayer('1', 'animA'),
  ]),
  makeGroup('素材', [
    makeGroup('BOOK', [
      makeLabelLayer('book', 'materialBook'),
    ]),
    makeGroup('_BG', [
      makeLabelLayer('paint', 'materialBg'),
    ]),
    makeLabelLayer('guide', 'materialGuide'),
  ]),
  makeLabelLayer('BG', 'paper'),
]

const cases = {
  'auto-child': {
    singleMarkPaths: [],
    entries: {
      'A_0001.jpg': ['paper', 'materialGuide', 'materialBook', 'animA', 'fg'],
      '_BG.jpg': ['paper', 'materialGuide', 'materialBg', 'materialBook', 'fg'],
    },
  },
  'single-book': {
    singleMarkPaths: [['素材', 'BOOK']],
    entries: {
      'A_0001.jpg': ['paper', 'materialGuide', 'animA', 'fg'],
      '_BG.jpg': ['paper', 'materialGuide', 'materialBg', 'fg'],
      'BOOK.jpg': ['paper', 'materialGuide', 'materialBook', 'fg'],
    },
  },
}

ensureEmptyDir(outDir)

const psd = {
  width,
  height,
  children: toPsdOrder(appTreeTopToBottom),
}
fs.writeFileSync(path.join(outDir, 'context-pruning.psd'), writePsdBuffer(psd, { noBackground: true }))
fs.writeFileSync(path.join(outDir, 'context-pruning.xdts'), buildXdts(), 'utf-8')

for (const [caseName, testCase] of Object.entries(cases)) {
  const goldenDir = path.join(outDir, `golden-${caseName}`)
  fs.mkdirSync(goldenDir, { recursive: true })
  for (const [flatName, expectedLabels] of Object.entries(testCase.entries)) {
    writeExpectedPng(path.join(goldenDir, flatName.replace(/\.jpg$/i, '.png')), expectedLabels)
  }
}

const manifest = {
  name: 'context-pruning',
  width,
  height,
  labels: Object.fromEntries(labels.map(({ key, text, top }) => [
    key,
    { text, top },
  ])),
  tracks: ['A'],
  cases,
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')

console.log(`Generated ${path.relative(repoRoot, outDir)}`)
