import { expect, test, type Page } from './fixtures'

const api = 'https://api.github.com/repos/stechdrive/csp-paperback/releases/latest'
const settingsKey = 'csp-paperback:desktop-updates'

async function desktop(page: Page) {
  await page.addInitScript(() => {
    const host = window as unknown as Record<string, unknown>
    host.isTauri = true
    host.__openedReleases = [] as string[]
    host.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      transformCallback: () => 1,
      unregisterCallback: () => {},
      invoke: async (command: string, args?: { url?: string }) => {
        if (command === 'get_launch_args') return []
        if (command === 'plugin:opener|open_url') {
          (host.__openedReleases as string[]).push(args!.url!)
          return
        }
        if (command === 'plugin:event|listen') return 1
        if (command === 'plugin:event|unlisten') return
        throw new Error(`Unexpected desktop command: ${command}`)
      },
    }
    host.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} }
  })
}

async function openSettings(page: Page) {
  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  await page.getByRole('button', { name: '詳細設定…', exact: true }).click()
  return page.getByRole('dialog', { name: '書き出し詳細設定', exact: true })
}

test('desktop checks wait for dialogs, remember frequency and open the release link only on request', async ({ page }, testInfo) => {
  await desktop(page)
  await page.clock.install()
  let count = 0
  let respond!: () => void
  const responseReady = new Promise<void>(resolve => { respond = resolve })
  await page.route(api, async route => {
    count++
    await responseReady
    await route.fulfill({ json: { tag_name: 'v999.1.2' } })
  })
  await page.goto('./')
  const settings = await openSettings(page)
  await expect(settings.getByRole('radio', { name: '1週間ごと（初期設定）' })).toBeChecked()
  await expect.poll(() => count).toBe(1)
  respond()
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').state?.lastCheckedAt ?? null, settingsKey)).not.toBeNull()
  const notification = page.getByRole('dialog', { name: '新しいバージョンがあります' })
  await expect(notification).toHaveCount(0)
  await settings.getByRole('button', { name: '完了', exact: true }).click()
  await expect(notification).toBeVisible()
  await expect(notification).toContainText('v999.1.2')
  await expect(notification).toContainText('ダウンロード・インストールは自動で行いません')
  expect(await page.evaluate(() => (window as unknown as { __openedReleases: string[] }).__openedReleases)).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('update-notification.png') })
  await notification.getByRole('button', { name: 'GitHub Releases をブラウザで開く' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __openedReleases: string[] }).__openedReleases))
    .toEqual(['https://github.com/stechdrive/csp-paperback/releases'])
  await notification.getByRole('button', { name: '閉じる', exact: true }).click()

  const preferences = await openSettings(page)
  await preferences.getByRole('radio', { name: '起動するたび', exact: true }).check()
  await page.screenshot({ path: testInfo.outputPath('update-preferences.png') })
  await preferences.getByRole('button', { name: '完了', exact: true }).click()
  await page.reload()
  await expect.poll(() => count).toBe(2)
  await expect(notification).toHaveCount(0)
  const afterRestart = await openSettings(page)
  await expect(afterRestart.getByRole('radio', { name: '起動するたび', exact: true })).toBeChecked()
  await afterRestart.getByRole('radio', { name: 'オフ（手動のみ）' }).check()
  await afterRestart.getByRole('button', { name: '完了', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: '書き出し設定', exact: true })).toBeVisible()
  await page.clock.runFor(2000)
  expect(count).toBe(2)
  await expect(notification).toHaveCount(0)

  await page.getByRole('button', { name: 'メニュー', exact: true }).click()
  await page.getByRole('button', { name: '更新確認', exact: true }).click()
  const manual = page.getByRole('dialog', { name: '更新確認', exact: true })
  await expect(manual).toContainText('v999.1.2')
  expect(count).toBe(3)
  await manual.getByRole('button', { name: '閉じる', exact: true }).click()
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).state.frequency, settingsKey)).toBe('off')
})

test('web does not expose desktop preferences or contact the release API', async ({ page }) => {
  await page.clock.install()
  let requests = 0
  await page.route(api, route => { requests++; return route.fulfill({ json: { tag_name: 'v999.1.2' } }) })
  await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({ state: { frequency: 'startup' }, version: 0 })), settingsKey)
  await page.goto('./')
  const settings = await openSettings(page)
  await expect(settings.getByText('デスクトップ版の更新確認', { exact: true })).toHaveCount(0)
  await settings.getByRole('button', { name: '完了', exact: true }).click()
  await page.clock.runFor(61_000)
  expect(requests).toBe(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
