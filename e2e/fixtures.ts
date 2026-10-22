import { test as base, expect } from '@playwright/test'

export { expect }
export type { Locator, Page } from '@playwright/test'

/** Every browser scenario also rejects uncaught application errors. */
export const test = base.extend<{ uncaughtErrors: void }>({
  uncaughtErrors: [async ({ page }, use, info) => {
    const errors: string[] = []
    const onError = (error: Error) => errors.push(error.stack ?? error.message)
    page.on('pageerror', onError)
    await use()
    page.off('pageerror', onError)
    if (errors.length) await info.attach('uncaught-errors', {
      body: errors.join('\n\n'), contentType: 'text/plain',
    })
    expect(errors, 'Uncaught browser errors').toEqual([])
  }, { auto: true }],
})
