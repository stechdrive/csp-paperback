import type { HelpHighlight } from './HelpFigure'
import screenshots from './helpScreenshots.json'

// Geometry and image hashes are captured together by npm run help:capture.
export const HELP_HIGHLIGHTS = {
  startupSettings: { label: '書き出し設定', ...screenshots['startup-guide.png'].regions.startupSettings },
  virtualCels: { label: '仮想セル', ...screenshots['loaded-overview.png'].regions.virtualCels },
  preview: { label: 'プレビュー', ...screenshots['loaded-overview.png'].regions.preview },
  layers: { label: '出力一覧と素材ツリー', ...screenshots['loaded-overview.png'].regions.layers },
  navigator: { label: 'キャンバス', ...screenshots['whole-preview.png'].regions.navigator },
  exportSettings: { label: '書き出し設定', ...screenshots['export-settings.png'].regions.exportSettings },
  output: { label: '書き出し画像', ...screenshots['loaded-overview.png'].regions.output },
  outputMenu: { label: '出力メニュー', ...screenshots['output-menu.png'].regions.outputMenu },
  quickExportSettings: { label: 'クイック書き出しの保存方法', ...screenshots['quick-export-settings.png'].regions.quickExportSettings },
  settingsDialog: { label: '詳細設定', ...screenshots['settings-dialog.png'].regions.settingsDialog },
  processSettings: { label: '工程設定', ...screenshots['settings-dialog.png'].regions.processSettings },
} satisfies Record<string, HelpHighlight>
