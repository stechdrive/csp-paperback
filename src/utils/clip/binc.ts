import * as native from 'celcodec/read'
import { codecFunction } from './celcodec'
export type { BincValueNode as BincNode } from 'celcodec/read'
export const readBinc=codecFunction(native.readBinc)
export const readActionMixer=codecFunction(native.readActionMixer)
export const nodesNamed=native.nodesNamed
export const field=native.field
