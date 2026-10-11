import { describe, expect, it } from 'vitest'
import { filterQuickExportLaunchPaths } from '../../platform/launch'

describe('filterQuickExportLaunchPaths', () => {
  it('CLIP/PSD/XDTSを起動引数から拾う', () => {
    expect(filterQuickExportLaunchPaths([
      '--some-dev-flag',
      String.raw`C:\work\cut001\cut001.CLIP`,
      String.raw`C:\work\cut001\cut001.PSD`,
      String.raw`C:\work\cut001\cut001.xdts`,
      String.raw`C:\work\cut001\memo.txt`,
    ])).toEqual([
      String.raw`C:\work\cut001\cut001.CLIP`,
      String.raw`C:\work\cut001\cut001.PSD`,
      String.raw`C:\work\cut001\cut001.xdts`,
    ])
  })
})
