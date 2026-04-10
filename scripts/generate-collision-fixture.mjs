import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeCanvas, writePsdBuffer } from 'ag-psd'
import { createCanvas } from '@napi-rs/canvas'

initializeCanvas((width, height) => createCanvas(width, height))

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const outDir = path.join(repoRoot, 'testdata', 'collision')
const width = 1180
const height = 520
const rowHeight = 28
const labelWidth = width

const labels = [
  { key: 'bg', text: './[BG]/paper' },
  { key: 'fg', text: './[FG]/overlay' },
  { key: 'candidateA', text: './[_候補]/[A]/unused' },
  { key: 'candidateBg1', text: './[_候補]/[BG1]/unused' },
  { key: 'genzuNote', text: './[_原図]/note' },
  { key: 'book2', text: './[_原図]/[_BOOK1]/2' },
  { key: 'book1', text: './[_原図]/[_BOOK1]/1' },
  { key: 'bg1_2', text: './[_原図]/[_BG]/[BG1]/2' },
  { key: 'bg1_1', text: './[_原図]/[_BG]/[BG1]/1' },
  { key: 'aSpace2', text: './[LO]/[TEST]/[A ]/2', inputOpacity: 0.35 },
  { key: 'aSpace1', text: './[LO]/[TEST]/[A ]/1', inputOpacity: 0.35 },
  { key: 'aDup1', text: './[LO]/[TEST]/[A]/1' },
  { key: 'aEns1', text: './[LO]/[演出]/[A]/1' },
  { key: 'bBody', text: './[LO]/[作画]/[B]/[1]/body' },
  { key: 'bTone50', text: './[LO]/[作画]/[B]/[1]/tone50', inputOpacity: 0.5 },
  { key: 'bSakuga', text: './[LO]/[作画]/[B]/[1]/[_s]/作監修正' },
].map((label, index) => ({
  inputOpacity: 1,
  ...label,
  top: 16 + index * rowHeight,
  color: colorForIndex(index),
}))

const labelByKey = new Map(labels.map(label => [label.key, label]))

function colorForIndex(index) {
  const hue = (index * 47) % 360
  return `hsl(${hue}, 70%, 42%)`
}

function ensureEmptyDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
}

function labelCanvas(label) {
  const canvas = createCanvas(labelWidth, rowHeight)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, labelWidth, rowHeight)
  ctx.fillStyle = label.color
  ctx.fillRect(0, 5, 8, 18)
  ctx.font = '14px "Segoe UI", "Yu Gothic", Arial, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#111827'
  ctx.fillText(label.text, 16, 19)
  return canvas
}

function makeLabelLayer(name, key, overrides = {}) {
  const label = labelByKey.get(key)
  if (!label) throw new Error(`Unknown label key: ${key}`)
  return {
    name,
    top: label.top,
    left: 0,
    canvas: labelCanvas(label),
    opacity: label.inputOpacity,
    blendMode: 'normal',
    ...overrides,
  }
}

function makeGroup(name, children, overrides = {}) {
  return {
    name,
    children,
    opened: true,
    sectionDivider: { type: 1 },
    blendMode: 'normal',
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

function writeExpectedPng(filePath, items) {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, width, height)

  for (const item of items) {
    const key = typeof item === 'string' ? item : item.key
    const opacity = typeof item === 'string' ? 1 : item.opacity
    const label = labelByKey.get(key)
    if (!label) throw new Error(`Unknown expected label key: ${key}`)
    ctx.save()
    ctx.globalAlpha = opacity ?? 1
    ctx.drawImage(labelCanvas(label), 0, label.top)
    ctx.restore()
  }

  fs.writeFileSync(filePath, canvas.toBuffer('image/png'))
}

function buildXdts() {
  const tracks = [
    { trackNo: 0, frames: [{ frame: 0, value: '1' }, { frame: 3, value: '2' }] },
    { trackNo: 1, frames: [{ frame: 0, value: '1' }] },
    { trackNo: 2, frames: [{ frame: 0, value: '1' }] },
    { trackNo: 3, frames: [{ frame: 0, value: '1' }, { frame: 3, value: '2' }] },
    { trackNo: 4, frames: [{ frame: 0, value: '1' }] },
  ].map(track => ({
    trackNo: track.trackNo,
    frames: track.frames.map(frame => ({
      frame: frame.frame,
      data: [{ id: 0, values: [frame.value] }],
    })),
  }))

  const json = {
    timeTables: [{
      name: 'collision timeline',
      duration: 6,
      frameRate: 24,
      timeTableHeaders: [{
        fieldId: 0,
        names: ['A ', 'A', 'A', 'BG1', 'B'],
      }],
      fields: [{
        fieldId: 0,
        tracks,
      }],
    }],
    version: 5,
    header: {
      cut: 'collision',
      scene: '1',
    },
  }

  return `exchangeDigitalTimeSheet Save Data\n${JSON.stringify(json, null, 2)}\n`
}

const appTreeTopToBottom = [
  makeLabelLayer('FG', 'fg'),
  makeGroup('_候補', [
    makeGroup('BG1', [
      makeLabelLayer('unused bg1 marker', 'candidateBg1'),
    ], { blendMode: 'pass through' }),
    makeGroup('A', [
      makeLabelLayer('unused A marker', 'candidateA'),
    ], { blendMode: 'pass through' }),
  ], { blendMode: 'pass through' }),
  makeGroup('_原図', [
    makeLabelLayer('note', 'genzuNote'),
    makeGroup('_BOOK1', [
      makeLabelLayer('2', 'book2'),
      makeLabelLayer('1', 'book1'),
    ], { blendMode: 'normal' }),
    makeGroup('_BG', [
      makeGroup('BG1', [
        makeLabelLayer('2', 'bg1_2'),
        makeLabelLayer('1', 'bg1_1'),
      ], { blendMode: 'pass through' }),
    ], { blendMode: 'pass through' }),
  ], { blendMode: 'pass through' }),
  makeGroup('LO', [
    makeGroup('演出', [
      makeGroup('A', [
        makeLabelLayer('1', 'aEns1'),
      ], { blendMode: 'pass through' }),
    ], { blendMode: 'pass through' }),
    makeGroup('TEST', [
      makeGroup('A', [
        makeLabelLayer('1', 'aDup1'),
      ], { blendMode: 'pass through' }),
      makeGroup('A ', [
        makeLabelLayer('2', 'aSpace2'),
        makeLabelLayer('1', 'aSpace1'),
      ], { opacity: 0.25, blendMode: 'pass through' }),
    ], { blendMode: 'pass through' }),
    makeGroup('作画', [
      makeGroup('B', [
        makeGroup('1', [
          makeGroup('_s', [
            makeLabelLayer('作監修正', 'bSakuga'),
          ], { opacity: 0.3, blendMode: 'normal' }),
          makeLabelLayer('tone50', 'bTone50'),
          makeLabelLayer('body', 'bBody'),
        ], { opacity: 0.25, blendMode: 'normal' }),
      ], { opacity: 0.4, blendMode: 'pass through' }),
    ], { blendMode: 'pass through' }),
  ], { blendMode: 'pass through' }),
  makeLabelLayer('BG', 'bg'),
]

const commonEntries = {
  'A_0002.jpg': ['bg', 'aSpace2', 'fg'],
  'A_0001.jpg': ['bg', 'aSpace1', 'fg'],
  'A(2)_0001.jpg': ['bg', 'aDup1', 'fg'],
  'A_0001_e.jpg': ['bg', 'aEns1', 'fg'],
  'B_0001.jpg': ['bg', { key: 'bTone50', opacity: 0.5 }, 'bBody', 'fg'],
  'B_0001_s.jpg': ['bg', 'bSakuga', 'fg'],
  'BG1_0002.jpg': ['bg1_2'],
  'BG1_0001.jpg': ['bg1_1'],
  '_候補.jpg': ['bg', 'candidateA', 'candidateBg1', 'fg'],
  '_BG.jpg': ['bg', 'bg1_2', 'genzuNote', 'fg'],
}

const cases = {
  'xdts-only': {
    manualAnimFolderPaths: [],
    entries: {
      ...commonEntries,
      '_原図.jpg': ['bg', 'genzuNote', 'book2', 'book1', 'bg1_2', 'fg'],
      '_BOOK1.jpg': ['bg', 'book2', 'book1', 'genzuNote', 'fg'],
    },
  },
  'manual-book': {
    manualAnimFolderPaths: [['_原図', '_BOOK1']],
    entries: {
      ...commonEntries,
      '_原図.jpg': ['bg', 'genzuNote', 'book2', 'bg1_2', 'fg'],
      '_BOOK1_0002.jpg': ['book2', 'genzuNote'],
      '_BOOK1_0001.jpg': ['book1', 'genzuNote'],
    },
  },
}

ensureEmptyDir(outDir)

const psd = {
  width,
  height,
  children: toPsdOrder(appTreeTopToBottom),
}
fs.writeFileSync(path.join(outDir, 'collision.psd'), writePsdBuffer(psd, { noBackground: true }))
fs.writeFileSync(path.join(outDir, 'collision.xdts'), buildXdts(), 'utf-8')

for (const [caseName, testCase] of Object.entries(cases)) {
  const goldenDir = path.join(outDir, `golden-${caseName}`)
  fs.mkdirSync(goldenDir, { recursive: true })
  for (const [flatName, expectedLabels] of Object.entries(testCase.entries)) {
    writeExpectedPng(path.join(goldenDir, flatName.replace(/\.jpg$/i, '.png')), expectedLabels)
  }
}

const manifest = {
  name: 'collision',
  width,
  height,
  labels: Object.fromEntries(labels.map(({ key, text, top, inputOpacity }) => [
    key,
    { text, top, inputOpacity },
  ])),
  tracks: ['A ', 'A', 'A', 'BG1', 'B'],
  cases,
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')

console.log(`Generated ${path.relative(repoRoot, outDir)}`)
