import { readCelFrames as native } from 'celcodec/read'
import { codecFunction } from './celcodec'
export const readCelFrames=codecFunction(native)
