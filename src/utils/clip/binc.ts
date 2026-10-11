// Format research: animeops/clip-tools and Aodaruma/clipfile-rs (MIT).
import { check, crc32, inflate, Reader } from './binary'

type Value = null | number | string | Value[]
export interface BincNode { name: string; value: Value; attrs: Record<string, string>; children: BincNode[] }

export async function readActionMixer(bytes: Uint8Array): Promise<BincNode> {
  const source = new Reader(bytes, true)
  check(source.u32() === bytes.length - 4, 'タイムラインの圧縮サイズが不正です')
  return readBinc(await inflate(source.take(bytes.length - 4), 16 * 1024 * 1024))
}

export function readBinc(bytes: Uint8Array): BincNode {
  const r = new Reader(bytes, true)
  const magic = r.text(12)
  // Secondary 0110 mixers also have sparse layouts. Do not interpret them as 0100.
  check(magic === 'cmt 0100binc', '未対応のタイムライン形式です（BINC）')
  check(r.u32() === crc32(bytes.subarray(16)), 'タイムラインのCRCが一致しません')
  const count = r.u32()
  check(count <= 65536, 'タイムラインの文字列が多すぎます')
  const strings = Array.from({ length: count }, () => r.text(r.number('u8')))
  function str(): string {
    const index = r.u32()
    if (index === 0xffffffff) return ''
    check(index < strings.length, '文字列の参照が不正です')
    return strings[index]
  }
  function value(type: string): Value {
    if (type === 'null') return null
    if (type === 'String') return str()
    if (type.endsWith('[]')) {
      const count = r.u32()
      check(count <= 1000000, 'タイムラインの配列が大きすぎます')
      return Array.from({ length: count }, () => value(type.slice(0, -2)))
    }
    const scalar = { Byte: 'u8', SByte: 'i8', UInt16: 'u16', Int16: 'i16', UInt32: 'u32', Int32: 'i32', Single: 'f32', Double: 'f64' } as const
    if (type in scalar) return r.number(scalar[type as keyof typeof scalar])
    const size = { Float2: 2, Float3: 3, Double2: 2, Double3: 3, Quat: 4, Matrix44: 16 }[type]
    check(size, `未対応のBINC値です: ${type}`)
    return Array.from({ length: size }, () => r.number(type.startsWith('Double') ? 'f64' : 'f32'))
  }
  let nodes = 0
  function node(depth: number): BincNode {
    check(depth <= 64 && ++nodes <= 100000, 'タイムライン構造が深すぎるか大きすぎます')
    const name = str()
    const v = value(str())
    const attrs: Record<string, string> = Object.create(null)
    const attrCount = r.u32()
    check(attrCount <= 1024, 'BINC属性が多すぎます')
    for (let i = 0; i < attrCount; i++) { const key = str(); attrs[key] = str() }
    const childCount = r.u32()
    check(childCount <= 100000, 'BINC子要素が多すぎます')
    return { name, value: v, attrs, children: Array.from({ length: childCount }, () => node(depth + 1)) }
  }
  const root = node(0)
  check(r.position === bytes.length, 'BINC末尾に未解析のデータがあります')
  return root
}

export function nodesNamed(node: BincNode, name: string): BincNode[] {
  return [...(node.name === name ? [node] : []), ...node.children.flatMap(child => nodesNamed(child, name))]
}

export function field(node: BincNode, name: string): Value | undefined {
  return node.children.find(child => child.name === name)?.value
}
