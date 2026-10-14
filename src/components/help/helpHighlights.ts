import type { HelpHighlight } from './HelpFigure'

// Percentages measured from the 1440 x 1000 screenshots in public/help.
// Share regions across guides so the same screenshot stays aligned everywhere.
export const HELP_HIGHLIGHTS = {
  startupSettings: { label: '書き出し設定', x: 0, y: 4.4, width: 78.9, height: 25 },
  virtualCels: { label: '仮想セル', x: 0, y: 4.4, width: 16.7, height: 95.6 },
  preview: { label: 'プレビュー', x: 16.9, y: 4.4, width: 61.9, height: 95.6 },
  layers: { label: 'レイヤー', x: 79.2, y: 28.6, width: 20.8, height: 71.4, labelAlign: 'right' },
  navigator: { label: 'タイムライン表示', x: 79.2, y: 4.4, width: 20.8, height: 23.8, labelAlign: 'right' },
  exportSettings: { label: '書き出し設定', x: 29.7, y: 73.1, width: 48.6, height: 23.6 },
  output: { label: '出力プレビュー', x: 16.9, y: 4.4, width: 61.9, height: 92.1 },
  outputMenu: { label: '出力メニュー', x: 88.3, y: 0.6, width: 11.1, height: 12, labelAlign: 'right' },
  settingsDialog: { label: '詳細設定', x: 19.4, y: 7.5, width: 61.1, height: 85 },
  processSettings: { label: '工程設定', x: 21.2, y: 35.4, width: 57.6, height: 27.9 },
} satisfies Record<string, HelpHighlight>
