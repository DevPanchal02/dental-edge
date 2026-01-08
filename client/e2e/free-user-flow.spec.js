// FILE: client/e2e/free-user-flow.spec.js
import { test, expect } from '@playwright/test';

const FREE_USER = {
  email: 'test-student@dentaledge.com',
  password: 'Testing123!'
};

test.describe('Flow 2: Free User Experience', () => {

  test.setTimeout(60000);

  test('Free user can login, complete Biology Test 1, and view results', async ({ page }) => {
    
    // --- STEP 1: LOGIN ---
    await page.goto('/login');
    await page.fill('input[type="email"]', FREE_USER.email);
    await page.fill('input[type="password"]', FREE_USER.password);
    await page.getByRole('button', { name: 'Sign-In' }).click();

    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    await expect(page.getByText('Biology')).toBeVisible({ timeout: 15000 });


    // --- STEP 2: NAVIGATE TO QUIZ ---
    await page.getByRole('link', { name: 'Biology' }).click();
    
    // FIX: Use specific filtering to avoid matching "Test 10", "Test 11", etc.
    // We look for a list item that contains an element with EXACTLY "Test 1"
    const testItem = page.locator('.list-item').filter({ 
        has: page.getByText('Test 1', { exact: true }) 
    });
    
    await expect(testItem).toBeVisible({ timeout: 15000 });
    
    // Click the arrow indicator
    await testItem.locator('.item-indicator').click();

    // Verify URL update
    await expect(page).toHaveURL(/.*quiz\/biology\/practice\/test-1/, { timeout: 15000 });


    // --- STEP 3: TAKE QUIZ ---
    await expect(page.getByText('red blood cell is placed in a dish')).toBeVisible({ timeout: 15000 });

    // Answer Q1
    const optionBurst = page.locator('.option-label').filter({ hasText: 'Burst' });
    await optionBurst.click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Answer Q2
    await expect(page.getByText('hormone causes ovulation')).toBeVisible();
    const optionLH = page.locator('.option-label').filter({ hasText: 'LH' });
    await optionLH.click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Answer Q3
    await expect(page.locator('.question-number')).toContainText('Question 3');
    await page.locator('.option-label').first().click();


    // --- STEP 4: SUBMIT ---
    await page.getByRole('button', { name: 'Review' }).click();
    
    const endQuizBtn = page.getByRole('button', { name: 'End Quiz' });
    await expect(endQuizBtn).toBeVisible({ timeout: 15000 });
    
    await endQuizBtn.click();


    // --- STEP 5: VERIFY RESULTS ---
    await expect(page).toHaveURL(/.*results/, { timeout: 15000 });
    await expect(page.getByText('Your Score')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to Topic List' })).toBeVisible();
  });

});