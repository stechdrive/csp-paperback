import '@testing-library/jest-dom/vitest'
import 'vitest-canvas-mock'
import { vi } from 'vitest'

// jsdom has no layout observers; geometry is covered in browser tests.
globalThis.ResizeObserver = class {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

// jsdom does not implement the native dialog lifecycle. Focus, inertness and
// nested Escape handling are exercised in Playwright against real browsers.
HTMLDialogElement.prototype.showModal = function () { this.open = true }
HTMLDialogElement.prototype.close = function () { this.open = false }
