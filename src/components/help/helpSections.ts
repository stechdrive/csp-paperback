export const FEATURE_SECTIONS = [
  { id: 'screen', label: '画面全体' },
  { id: 'files', label: 'ファイルを読み込む' },
  { id: 'preview', label: 'プレビュー' },
  { id: 'output-settings', label: '書き出し設定' },
  { id: 'export', label: 'ZIP・フォルダ出力' },
  { id: 'layer-tree', label: 'レイヤー操作' },
  { id: 'single-output', label: '単体出力' },
  { id: 'animation-folders', label: 'アニメフォルダ' },
  { id: 'process', label: '工程フォルダ' },
  { id: 'virtual-cels', label: '仮想セル' },
  { id: 'detailed-settings', label: '詳細設定・共有' },
  { id: 'desktop-mobile', label: 'デスクトップ・モバイル' },
] as const

export const ABOUT_SECTIONS = [
  { id: 'problem', label: 'CSP標準で困ること' },
  { id: 'features', label: 'できること' },
  { id: 'compositing', label: '画像に含まれるもの' },
  { id: 'opacity', label: '不透明度の扱い' },
  { id: 'privacy', label: '通信とファイル' },
  { id: 'template', label: 'サンプルテンプレート' },
] as const
