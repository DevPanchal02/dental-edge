import { test, expect } from '@playwright/test';

// Use Environment Variables with Type Assertion
const FREE_USER = {
  email: process.env.E2E_USER_FREE_EMAIL as string,
  password: process.env.E2E_USER_FREE_PASSWORD as string
};

test.describe('Flow 2: Free User Experience', () => {

  test.setTimeout(120000);

  test('Free user can login, complete Biology Test 1, and view results', async ({ page }) => {
    
    // Guard clause for type safety
    if (!FREE_USER.email || !FREE_USER.password) {
      throw new Error("E2E Credentials missing. Check .env.local");
    }

    // --- STEP 1: LOGIN ---
    await page.goto('/login');
    await page.fill('input[type="email"]', FREE_USER.email);
    await page.fill('input[type="password"]', FREE_USER.password);
    await page.getByRole('button', { name: 'Sign-In' }).click();

    await expect(page).toHaveURL(/\/app/, { timeout: 30000 });
    
    // FIX: Use specific role to avoid "Strict Mode" violation (Sidebar vs Header)
    await expect(page.getByRole('heading', { name: 'Biology' })).toBeVisible({ timeout: 30000 });


    // --- STEP 2: NAVIGATE TO QUIZ ---
    await page.getByRole('link', { name: 'Biology' }).click();
    
    const testItem = page.locator('.list-item').filter({ 
        has: page.getByText('Test 1', { exact: true }) 
    });
    
    await expect(testItem).toBeVisible({ timeout: 30000 });
    await testItem.locator('.item-indicator').click();

    await expect(page).toHaveURL(/.*quiz\/biology\/practice\/test-1/, { timeout: 30000 });

    // --- HANDLE OPTIONS MODAL ---
    // Wait for the modal container first to ensure stability
    await expect(page.locator('.pto-modal-container')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Start' }).click();

    // --- STEP 3: TAKE QUIZ ---
    // Now we wait for the actual question content
    await expect(page.getByText('red blood cell is placed in a dish')).toBeVisible({ timeout: 30000 });

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
    await expect(endQuizBtn).toBeVisible({ timeout: 30000 });
    
    await endQuizBtn.click();


    // --- STEP 5: VERIFY RESULTS ---
    await expect(page).toHaveURL(/.*results/, { timeout: 30000 });
    await expect(page.getByText('Your Score')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to Topic List' })).toBeVisible();
  });

});