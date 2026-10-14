/** Identity must not depend on filenames or the first visible process alias. */
export function cellOutputId(animId: string, cellId: string, suffix?: string): string {
  return JSON.stringify(['cell', animId, cellId, suffix === undefined ? 'body' : 'process', suffix ?? ''])
}
export function layerOutputId(id: string): string { return JSON.stringify(['layer', id]) }
export function virtualOutputId(id: string): string { return JSON.stringify(['virtual', id]) }
