import { expect, test } from '@playwright/test'

test('最短ガイドから各社テンプレート向けの設定と共有方法を確認できる', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') pageErrors.push(message.text())
  })

  await page.goto('./')
  await page.getByRole('button', { name: '?', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'CSP Paperback ヘルプ' })
  await expect(dialog).toBeVisible()

  const toc = dialog.getByRole('navigation', { name: '章の目次' })
  const templateChapter = toc.getByRole('button', {
    name: /各社テンプレートに対応するには/,
  })
  await templateChapter.click()

  await expect(
    dialog.getByRole('heading', { name: '各社テンプレートに対応するには' }),
  ).toBeVisible()
  await expect(dialog.getByText('A1_en.jpg', { exact: true })).toBeVisible()
  await expect(dialog.getByText('A1_l.jpg', { exact: true })).toBeVisible()
  await expect(dialog.getByText('設定JSONを共有', { exact: true })).toBeVisible()
  await expect(dialog.locator('[data-help-highlight="工程設定"]')).toBeVisible()

  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(pageErrors).toEqual([])
})

test.describe('狭幅のヘルプ', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 700, height: 900 },
  })

  test('各社テンプレート章の目次と内容が横にはみ出さない', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: 'メニュー', exact: true }).click()
    await page.getByRole('button', { name: '? ヘルプ', exact: true }).click()

    const dialog = page.getByRole('dialog', { name: 'CSP Paperback ヘルプ' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: /各社テンプレートに対応するには/ }).click()

    await expect(
      dialog.getByRole('heading', { name: '各社テンプレートに対応するには' }),
    ).toBeVisible()
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  })
})
