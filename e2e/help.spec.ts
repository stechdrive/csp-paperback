import { expect, test } from './fixtures'

test('独立したタブから各社テンプレート向けの設定と共有方法を確認できる', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') pageErrors.push(message.text())
  })

  await page.goto('./')
  await page.getByRole('button', { name: 'ヘルプ', exact: true }).click()

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

test('本体と同じレイヤー表示で例を開閉し、読み込み中の作品を維持する', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('./')
  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  await expect(page.getByTestId('tiled-preview')).toHaveAttribute('aria-busy', 'false')
  const source = page.getByTestId('layer-tree')
  const memo = source.locator('[data-layer-id]').filter({ has: page.getByText('memo', { exact: true }) })
  await memo.locator('[data-layer-name]').click()
  const snapshot = () => source.locator('[data-layer-id]').evaluateAll(rows => rows.map(row => ({
    id: row.getAttribute('data-layer-id'), name: row.querySelector('[data-layer-name]')?.textContent,
    visible: row.querySelector('[data-layer-column="visibility"]')?.getAttribute('aria-pressed'),
    expanded: row.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded'),
    selected: row.className.includes('_rowSelected_'),
  })))
  const before = await snapshot()
  const icon = await memo.locator('[data-layer-column="visibility"] svg').evaluate(el => el.outerHTML)
  const nameColor = await memo.locator('[data-layer-name]').evaluate(el => getComputedStyle(el).color)

  await page.getByRole('button', { name: 'ヘルプ', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'CSP Paperback ヘルプ' })
  await dialog.getByRole('tab', { name: /このツールについて/ }).click()
  const example = dialog.getByRole('figure', { name: 'この説明で使うCSPのレイヤー構成' })
  const helpMemo = example.locator('[data-help-layer="memo"]')
  expect(await helpMemo.locator('[data-layer-column="visibility"] svg').evaluate(el => el.outerHTML)).toBe(icon)
  expect(await helpMemo.locator('[data-layer-name]').evaluate(el => getComputedStyle(el).color)).toBe(nameColor)
  await expect(example.getByRole('button', { name: /レイヤーを|個別書き出し/ })).toHaveCount(0)
  await example.getByRole('button', { name: 'LOを折りたたむ', exact: true }).press('Enter')
  await expect(example.getByText('B1_s.jpg', { exact: true })).toHaveCount(0)
  await example.getByRole('button', { name: 'LOを展開する', exact: true }).press('Space')
  await expect(example.getByText('B1_s.jpg', { exact: true })).toBeVisible()
  await example.locator('[data-help-layer="supervisor"]').scrollIntoViewIfNeeded()
  await expect(example.getByText('B1_s.jpg', { exact: true })).toBeInViewport()
  await page.screenshot({ path: info.outputPath('help-layer-overview.png') })
  await dialog.getByRole('button', { name: 'ヘルプを閉じる' }).click()
  expect(await snapshot()).toEqual(before)
})

for (const { width, theme } of [
  { width: 1440, theme: 'midnight' }, { width: 700, theme: 'graphite' }, { width: 390, theme: 'paper' },
]) {
  test.describe(`レイヤー説明 ${width}px / ${theme}`, () => {
    test.use({ viewport: { width, height: 1000 }, hasTouch: width < 800, isMobile: width < 800 })

    test('全構造例で階層・名前・出力名を横にはみ出さずに読める', async ({ page }, info) => {
      await page.addInitScript(theme => {
        localStorage.setItem('csp-paperback:settings', JSON.stringify({ state: { activeTheme: theme }, version: 2 }))
      }, theme)
      await page.goto('./')
      if (await page.getByRole('button', { name: 'ヘルプ', exact: true }).isVisible()) {
        await page.getByRole('button', { name: 'ヘルプ', exact: true }).click()
      } else {
        await page.getByRole('button', { name: 'メニュー', exact: true }).click()
        await page.getByRole('button', { name: '? ヘルプ', exact: true }).click()
      }
      const dialog = page.getByRole('dialog', { name: 'CSP Paperback ヘルプ' })
      for (const tab of [/機能ガイド/, /このツールについて/, /各社テンプレートへの対応/]) {
        await dialog.getByRole('tab', { name: tab }).click()
        const examples = dialog.locator('[data-help-example]')
        expect(await examples.count()).toBeGreaterThan(0)
        const overflows = await examples.evaluateAll(elements => elements.flatMap(example =>
          [example, ...example.querySelectorAll<HTMLElement>('[data-help-layer], [data-layer-name]')]
            .filter(el => el.scrollWidth > el.clientWidth + 1)
            .map(el => el.textContent),
        ))
        expect(overflows).toEqual([])
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
        if (tab.source === '機能ガイド') {
          const process = dialog.locator('[data-help-example="cel-process"]')
          await process.scrollIntoViewIfNeeded()
          await expect(process.getByText('B1_s.jpg', { exact: true })).toBeVisible()
          await process.screenshot({ path: info.outputPath(`help-process-${width}-${theme}.png`) })
        }
      }
    })
  })
}
