import type { HelpHighlight } from './HelpFigure'

// Percentages measured from the 1440 x 1000 screenshots in public/help.
// Share regions across guides so the same screenshot stays aligned everywhere.
export const HELP_HIGHLIGHTS = {
  startupSettings: { label: '書き出し設定', x: 18.3, y: 8.3, width: 60.6, height: 21.4 },
  virtualCels: { label: '仮想セル', x: 0.6, y: 16.4, width: 16.8, height: 22.5 },
  preview: { label: 'プレビュー', x: 18.3, y: 5.1, width: 60.6, height: 94.5 },
  layers: { label: 'レイヤー', x: 79.2, y: 5.1, width: 20.5, height: 94.5, labelAlign: 'right' },
  navigator: { label: 'タイムライン表示', x: 18.3, y: 8.3, width: 60.6, height: 27 },
  exportSettings: { label: '書き出し設定', x: 18.3, y: 35.7, width: 60.6, height: 17.9 },
  output: { label: '出力プレビュー', x: 18.3, y: 53.6, width: 60.6, height: 46 },
  outputMenu: { label: '出力メニュー', x: 90.8, y: 0.8, width: 8.4, height: 12.3, labelAlign: 'right' },
  settingsDialog: { label: '詳細設定', x: 22.9, y: 7.5, width: 54.2, height: 85 },
  processSettings: { label: '工程設定', x: 24.7, y: 35.4, width: 50.7, height: 26.1 },
} satisfies Record<string, HelpHighlight>
