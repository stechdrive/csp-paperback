// Native format implementation is provided by the local celcodec package.
import * as native from 'celcodec/material'
import type { ClipDiagnostic as NativeDiagnostic } from 'celcodec'
import type { ClipLayer, ClipDiagnostic, ClipDocument } from './types'
import { num, str, type ClipRow } from './records'
import { layerRenderingDiagnostics } from './rendering-status'
import { codecCall, codecFunction, codecMessage } from './celcodec'
export type { MaterialTables } from 'celcodec/material'
export const materialOffscreen=codecFunction(native.materialOffscreen)
export const readMaterialQuad=codecFunction(native.readMaterialQuad)
export function readMaterialEffects(row:ClipRow,report?:(message:string,code:string)=>void){return codecCall(()=>native.readMaterialEffects(row,report?code=>report(codecMessage(code),code):undefined))}
const renderingCodes=new Set(['APPROXIMATE_VECTOR','APPROXIMATE_TEXT','UNSUPPORTED_3D','APPROXIMATE_WATERCOLOR','UNSUPPORTED_WATERCOLOR_STYLE','UNSUPPORTED_TONE'])
export function createMaterialDecoder(t:native.MaterialTables,width:number,height:number,dpi:number,diagnostics:ClipDiagnostic[],compatibility?:ClipDocument['compatibility']) {
 const result:NativeDiagnostic[]=[]
 const decode=native.createMaterialDecoder(t,width,height,dpi,result,compatibility,{})
 return async (layer:ClipLayer,row:ClipRow) => {
  result.length=0
  if (!layer.pixels && !layer.isFolder && layer.kind === 'vector') {
   const vector = t.vectors?.get(num(row, 'VectorNormalStrokeIndex'))
    ?? [...(t.vectors?.values() ?? [])].find(v => num(v, 'LayerId') === num(row, 'MainId'))
   const raw = vector && t.external.get(str(vector.VectorData))
   // An existing zero-byte stream is an empty layer, not missing geometry.
   // Supply its exact transparent fallback; the decoder still tries saved
   // images and reads masks/effects. Missing or malformed streams never qualify.
   if (raw?.byteLength === 0) {
    layer.pixels = { width: 1, height: 1, left: 0, top: 0, rgba: new Uint8ClampedArray(4) }
    layer.materialSource = 'vector'
    delete layer.vectorRendering
   }
  }
  await codecCall(()=>decode(layer,row))
  for (const d of result) {
   if (renderingCodes.has(d.code) || (d.code === 'MISSING_VECTOR_DATA' && layer.vectorRendering === 'unavailable')) continue
   // celcodec 0.2 forwards Set.forEach's extra arguments to its diagnostic
   // callback for vector reports. Normalize those at the application boundary.
   const part = ['material', 'effect', 'mask', 'placement', 'blend'].includes(d.part ?? '') ? d.part as ClipDiagnostic['part'] : 'material'
   const outcome = ['MISSING_VECTOR_STROKE', 'MISSING_VECTOR_REMAINDER'].includes(d.code) ? 'missing-content'
    : typeof d.outcome === 'string' ? d.outcome : 'approximate'
   diagnostics.push({ scope: 'raster', layerId: layer.id, code: d.code, part, outcome,
    materialKind: part === 'material' && layer.kind === 'vector' ? 'vector'
     : ['vector', 'text', '3d'].includes(d.materialKind ?? '') ? d.materialKind as ClipDiagnostic['materialKind'] : undefined,
    message: '「' + layer.name + '」: ' + codecMessage(d.code, d.data) })
  }
  diagnostics.push(...layerRenderingDiagnostics(layer,compatibility))
 }
}
