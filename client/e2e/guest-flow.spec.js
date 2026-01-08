// FILE: client/e2e/guest-flow.spec.js
import { test, expect } from '@playwright/test';

test.describe('Flow 1: Guest Experience', () => {
  
  test('Guest can view landing page, start preview, but is blocked by registration wall', async ({ page }) => {
    // 1. Visit Landing Page
    await page.goto('/');
    await expect(page.getByText('Gain the Edge')).toBeVisible();

    // 2. Enter Preview Mode
    await page.getByRole('link', { name: 'Get Started' }).click();
    await expect(page).toHaveURL(/.*preview\/quiz\/biology\/practice\/test-1/);
    
    // Wait for the modal (with cold start timeout)
    await expect(page.getByText('Dental Aptitude Test 1')).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: 'Start' }).click();

    // --- QUESTION 1 ---
    await expect(page.locator('.question-number')).toContainText('Question 1');
    const optionQ1 = page.locator('.option-label').first();
    await optionQ1.click();
    await expect(optionQ1).toHaveClass(/selected/);
    
    await page.getByRole('button', { name: 'Next' }).click();

    // --- QUESTION 2 ---
    await expect(page.locator('.question-number')).toContainText('Question 2');
    const optionQ2 = page.locator('.option-label').first();
    await optionQ2.click();
    await expect(optionQ2).toHaveClass(/selected/);

    // Click Next AGAIN -> Trigger Wall
    await page.getByRole('button', { name: 'Next' }).click();

    // --- REGISTRATION WALL ---
    // 7. Verify Registration Modal
    await expect(page.getByText('Create an account to continue')).toBeVisible();
    
    // 8. Verify Navigation Blocked
    await expect(page.locator('.question-number')).not.toBeVisible();
  });

});