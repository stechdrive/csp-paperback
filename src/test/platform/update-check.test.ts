import { describe, expect, it } from 'vitest'
import { compareSemver } from '../../platform/update-check'

describe('compareSemver', () => {
  it('compares equal versions', () => {
    expect(compareSemver('1.2.3', 'v1.2.3')).toBe(0)
  })

  it('compares patch, minor, and major versions', () => {
    expect(compareSemver('1.2.4', '1.2.3')).toBe(1)
    expect(compareSemver('1.3.0', '1.2.99')).toBe(1)
    expect(compareSemver('2.0.0', '1.99.99')).toBe(1)
    expect(compareSemver('1.2.3', '1.2.4')).toBe(-1)
  })

  it('rejects non plain semver values', () => {
    expect(() => compareSemver('1.2', '1.2.0')).toThrow()
    expect(() => compareSemver('1.2.3-beta.1', '1.2.0')).toThrow()
  })
})
