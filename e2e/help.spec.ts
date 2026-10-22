import { expect, test, type Locator } from './fixtures'
import { manyOutputs } from './helpers/many-outputs'
import { clickLayerAction } from './helpers/layer-action'

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
    expanded: row.querySelector('[data-layer-column="name"] button[aria-expanded]')?.getAttribute('aria-expanded'),
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

async function operationAppearance(rows: Locator) {
  const result = []
  for (const row of await rows.all()) {
    await row.hover()
    result.push(await row.evaluate(el => {
      const name = el.querySelector('[data-layer-name]')!
      const badges = [...el.querySelectorAll<HTMLElement>('[data-layer-output-role]')]
      for (const badge of badges) {
        if (badge.getBoundingClientRect().right > name.getBoundingClientRect().left) throw new Error('Badge overlaps the layer name')
      }
      return {
        name: name.textContent, color: getComputedStyle(name).color,
        icon: el.querySelector('[data-layer-icon]')!.outerHTML,
        badges: badges.map(badge => ({
          label: badge.getAttribute('aria-label'), role: badge.dataset.layerOutputRole, className: badge.className,
        })),
      }
    }))
  }
  return result.sort((a, b) => a.name!.localeCompare(b.name!))
}

test('手動指定の例が実際の素材ツリーと同じ種類・出力指定表示になり、作品へ影響しない', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('./')
  // PSD only: the folder starts as an ordinary folder, without XDTS recognition.
  await page.locator('input[type=file][multiple]').setInputFiles(manyOutputs(2, 'エフェクト')[0])
  const source = page.getByTestId('layer-tree')
  const folder = source.locator('[data-layer-id]').filter({ has: page.getByText('エフェクト', { exact: true }) })
  await expect(folder).toBeVisible()
  await folder.getByRole('button', { name: 'エフェクトを展開する' }).click()
  await folder.locator('[data-layer-name]').click()
  const actual = []
  for (const state of ['ordinary', 'starred', 'animation', 'restored']) {
    if (state === 'starred') await clickLayerAction(page, folder, 'individual')
    if (state === 'animation' || state === 'restored') await clickLayerAction(page, folder, 'animation')
    actual.push(await operationAppearance(source.locator('[data-layer-id]')))
    await source.screenshot({ path: info.outputPath(`actual-${state}.png`) })
  }
  await page.getByRole('button', { name: 'ヘルプ', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'CSP Paperback ヘルプ' })
  await dialog.getByRole('tab', { name: /機能ガイド/ }).click()
  const example = dialog.locator('[data-help-example="manual-animation"]')
  const exampleFolder = example.locator('[data-help-layer="effect"]')
  for (const [index, state] of ['ordinary', 'starred', 'animation', 'restored'].entries()) {
    if (state === 'starred') await clickLayerAction(page, exampleFolder, 'individual')
    if (state === 'animation' || state === 'restored') await clickLayerAction(page, exampleFolder, 'animation', true)
    expect(await operationAppearance(example.locator('[data-layer-kind]'))).toEqual(actual[index])
    await example.screenshot({ path: info.outputPath(`help-${state}.png`) })
  }
  await dialog.getByRole('button', { name: 'ヘルプを閉じる' }).click()
  expect(await operationAppearance(source.locator('[data-layer-id]'))).toEqual(actual.at(-1))
  // Help actions must not add entries to the document's undo history.
  await source.focus()
  await source.press('Control+z')
  expect(await operationAppearance(source.locator('[data-layer-id]'))).toEqual(actual[2])
})

for (const { width, theme } of [
  { width: 1440, theme: 'midnight' }, { width: 700, theme: 'graphite' }, { width: 390, theme: 'paper' },
]) {
  test.describe(`レイヤー説明 ${width}px / ${theme}`, () => {
    test.use({ viewport: { width, height: 1000 }, hasTouch: width < 800, isMobile: width < 800 })

    test('全構造例のアイコンと文字が重ならず、画面画像と赤枠を読める', async ({ page }, info) => {
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
      const capturedImages = new Set<string>()
      for (const tab of [/クイックガイド/, /機能ガイド/, /このツールについて/, /各社テンプレートへの対応/]) {
        await dialog.getByRole('tab', { name: tab }).click()
        const examples = dialog.locator('[data-help-example]')
        if (tab.source !== 'クイックガイド') expect(await examples.count()).toBeGreaterThan(0)
        const overflows = await examples.evaluateAll(elements => elements.flatMap(example =>
          [example, ...example.querySelectorAll<HTMLElement>('[data-help-layer], [data-layer-name]')]
            .filter(el => el.scrollWidth > el.clientWidth + 1)
            .map(el => el.textContent),
        ))
        expect(overflows).toEqual([])
        // Measure glyphs, not just element boxes: emoji can paint beyond a fixed-width slot.
        const collisions = await examples.locator('[data-help-layer]').evaluateAll(rows => rows.flatMap(row => {
          const icon = row.querySelector('[data-layer-icon]')!
          const name = row.querySelector('[data-layer-name]')!
          const range = document.createRange()
          range.selectNodeContents(icon)
          const glyph = range.getBoundingClientRect()
          const slot = icon.getBoundingClientRect()
          range.selectNodeContents(name)
          const text = range.getBoundingClientRect()
          const gap = text.left - glyph.right
          return gap < 3 || glyph.left < slot.left - 0.5 || glyph.right > slot.right + 0.5
            ? [{ name: name.textContent, gap, glyphWidth: glyph.width, slotWidth: slot.width }] : []
        }))
        expect(collisions).toEqual([])
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)

        for (const example of await examples.all()) {
          await example.scrollIntoViewIfNeeded()
          await example.screenshot({ path: info.outputPath(`${await example.getAttribute('data-help-example')}-${width}-${theme}.png`) })
        }

        if (tab.source === '機能ガイド') {
          const example = dialog.locator('[data-help-example="manual-animation"]')
          const folder = example.locator('[data-help-layer="effect"]')
          await clickLayerAction(page, folder, 'animation')
          await expect(folder.locator('[data-layer-output-role]')).toHaveAttribute('data-layer-output-role', 'animation')
          await expect(folder.locator('[data-layer-icon]')).toHaveAttribute('data-layer-icon', 'folder')
          await operationAppearance(example.locator('[data-layer-kind]'))
          await example.screenshot({ path: info.outputPath(`manual-animation-active-${width}-${theme}.png`) })
          await clickLayerAction(page, folder, 'animation')
          await expect(folder.locator('[data-layer-output-role]')).toHaveCount(0)
        }

        for (const image of await dialog.locator('img[src*="/help/"]').all()) {
          await image.scrollIntoViewIfNeeded()
          await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
          const src = (await image.getAttribute('src'))!
          expect(src).toMatch(/\?v=[a-f0-9]{12}$/)
          const figure = image.locator('xpath=ancestor::figure')
          const imageBox = (await image.boundingBox())!
          const captionBox = (await figure.locator('figcaption').boundingBox())!
          expect(captionBox.y).toBeGreaterThanOrEqual(imageBox.y + imageBox.height)
          for (const highlight of await figure.locator('[data-help-highlight]').all()) {
            const box = (await highlight.boundingBox())!
            expect(box.x).toBeGreaterThanOrEqual(imageBox.x - 1)
            expect(box.y).toBeGreaterThanOrEqual(imageBox.y - 1)
            expect(box.x + box.width).toBeLessThanOrEqual(imageBox.x + imageBox.width + 1)
            expect(box.y + box.height).toBeLessThanOrEqual(imageBox.y + imageBox.height + 1)
          }
          if (!capturedImages.has(src)) {
            const file = src.split('/').at(-1)!.split('?')[0]
            await figure.screenshot({ path: info.outputPath(`figure-${width}-${theme}-${file}`) })
            capturedImages.add(src)
          }
        }
      }
      expect(capturedImages.size).toBe(6)
    })
  })
}
