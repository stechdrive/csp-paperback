import type { HelpHighlight } from './HelpFigure'

// Percentages measured from the 1440 x 1000 screenshots in public/help.
// Share regions across guides so the same screenshot stays aligned everywhere.
export const HELP_HIGHLIGHTS = {
  startupSettings: { label: '書き出し設定', x: 0, y: 4.4, width: 78.9, height: 25 },
  virtualCels: { label: '仮想セル', x: 0.00, y: 4.40, width: 16.67, height: 95.60 },
  preview: { label: 'プレビュー', x: 16.94, y: 4.40, width: 46.67, height: 95.60 },
  layers: { label: '出力一覧と素材ツリー', x: 63.89, y: 4.40, width: 36.11, height: 95.60 , labelAlign: 'right' },
  navigator: { label: '全体プレビュー', x: 16.94, y: 7.74, width: 46.67, height: 89.06 },
  exportSettings: { label: '書き出し設定', x: 29.7, y: 73.1, width: 48.6, height: 23.6 },
  output: { label: '出力プレビュー', x: 16.94, y: 7.74, width: 46.67, height: 89.06 },
  outputMenu: { label: '出力メニュー', x: 88.3, y: 0.6, width: 11.1, height: 12, labelAlign: 'right' },
  settingsDialog: { label: '詳細設定', x: 19.4, y: 7.5, width: 61.1, height: 85 },
  processSettings: { label: '工程設定', x: 21.2, y: 35.4, width: 57.6, height: 27.9 },
} satisfies Record<string, HelpHighlight>
