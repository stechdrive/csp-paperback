import { expect, test } from '@playwright/test'

test('独立したタブから各社テンプレート向けの設定と共有方法を確認できる', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') pageErrors.push(message.text())
  })

  await page.goto('./')
  await page.getByRole('button', { name: '?', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'CSP Paperback ヘルプ' })
  await expect(dialog).toBeVisible()

  const templateTab = dialog.getByRole('tab', {
    name: /各社テンプレートへの対応/,
  })
  await templateTab.click()
  await expect(templateTab).toHaveAttribute('aria-selected', 'true')

  await expect(dialog.getByRole('tab', {
    name: /クイックガイド/,
  })).toHaveAttribute('aria-selected', 'false')
  await expect(dialog.getByRole('tab', {
    name: /各社テンプレートに対応するには/,
  })).toHaveCount(0)

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

  test('4つのタブと各社テンプレートの内容が横にはみ出さない', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: 'メニュー', exact: true }).click()
    await page.getByRole('button', { name: '? ヘルプ', exact: true }).click()

    const dialog = page.getByRole('dialog', { name: 'CSP Paperback ヘルプ' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('tab', { name: /各社テンプレートへの対応/ }).click()

    await expect(
      dialog.getByRole('heading', { name: '各社テンプレートに対応するには' }),
    ).toBeVisible()
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  })
})
