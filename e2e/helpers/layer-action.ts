import type { Locator, Page } from '@playwright/test'

/** Use the same context menu at every tree width. */
export async function clickLayerAction(page: Page, row: Locator, column: 'animation' | 'individual', keyboard = false) {
  row = await row.getAttribute('data-layer-kind') ? row : row.locator('[data-layer-kind]').first()
  if (keyboard) {
    await row.locator('[data-layer-name]').click()
    const focus = row.locator('xpath=ancestor::*[@data-layer-tree-focus][1]')
    await focus.focus()
    await focus.press('Shift+F10')
  } else await row.click({ button: 'right' })
  const action = page.getByRole('menu', { name: /の操作$/ }).getByRole('menuitemcheckbox', {
    name: column === 'animation' ? /アニメーションフォルダ/ : /別画像として|個別書き出しを解除/,
  })
  if (keyboard) await action.press('Enter')
  else await action.click()
}
