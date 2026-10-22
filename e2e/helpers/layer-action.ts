import type { Locator, Page } from '@playwright/test'

/** Exercise either the inline action or the compact tree's visible menu. */
export async function clickLayerAction(page: Page, row: Locator, column: 'animation' | 'individual', keyboard = false) {
  const inline = row.locator(`[data-layer-column="${column}"] button`)
  if (await inline.isVisible()) {
    if (keyboard) await inline.press('Enter')
    else await inline.click()
    return
  }
  const label = (await inline.getAttribute('aria-label'))!
  const trigger = row.locator('[data-layer-column="actions"] button')
  if (keyboard) await trigger.press('Enter')
  else await trigger.click()
  const action = page.getByRole('dialog', { name: /の補助操作$/ }).getByRole('button', { name: label, exact: true })
  if (keyboard) await action.press('Enter')
  else await action.click()
}
