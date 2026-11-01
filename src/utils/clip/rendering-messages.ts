export function materialRenderingMessage(kind: 'vector' | 'text' | '3d', missing: boolean): string {
  const description = missing
    ? `${kind === '3d' ? '3D' : 'ベクター'}レイヤーの描画画像を取得できません。このレイヤーは透明な画像として扱い、ほかの素材の書き出しは続けます。`
    : kind === 'vector'
      ? 'ベクターレイヤーを近似描画しています。線幅・濃さ・ブラシ形状に差が生じる場合があります。'
      : '文字情報から描画します。フォント・縦書き・組版に差が生じる場合があります。'
  return description
}
