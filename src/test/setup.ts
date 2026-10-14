import '@testing-library/jest-dom'
import 'vitest-canvas-mock'
import { vi } from 'vitest'

// jsdom has no layout observers; geometry is covered in browser tests.
globalThis.ResizeObserver = class {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
