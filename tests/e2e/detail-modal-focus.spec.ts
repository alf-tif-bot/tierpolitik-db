import { expect, test } from '@playwright/test'

test.describe('Detail modal focus management', () => {
  test('focus starts in modal, traps, closes on ESC and returns to row', async ({ page }) => {
    await page.goto('/')

    const firstRow = page.locator('[data-testid="table-row"]').first()
    await expect(firstRow).toBeVisible()
    await firstRow.focus()
    await firstRow.click()

    const modal = page.getByTestId('modal')
    const closeButton = page.getByTestId('close-button')

    await expect(modal).toBeVisible()
    await expect(closeButton).toBeFocused()

    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    await expect(modal).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()
    await expect(firstRow).toBeFocused()
  })

  test('deep-link hash opens modal automatically', async ({ page }) => {
    await page.goto('/')
    const firstRow = page.locator('[data-testid="table-row"]').first()
    const rowId = await firstRow.getAttribute('data-row-id')
    expect(rowId).toBeTruthy()

    await page.goto(`/#${rowId}`)
    await expect(page.getByTestId('modal')).toBeVisible()
    await expect(page.getByTestId('close-button')).toBeFocused()
  })
})
