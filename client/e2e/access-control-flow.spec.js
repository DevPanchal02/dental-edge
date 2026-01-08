// FILE: client/e2e/access-control-flow.spec.js
import { test, expect } from '@playwright/test';

// Use Environment Variables
const FREE_USER = { 
  email: process.env.E2E_USER_FREE_EMAIL, 
  password: process.env.E2E_USER_FREE_PASSWORD 
};
const PRO_USER = { 
  email: process.env.E2E_USER_PRO_EMAIL, 
  password: process.env.E2E_USER_PRO_PASSWORD 
};

test.describe('Flow 3: Access Control & Monetization (RBAC)', () => {

  test.setTimeout(90000);

  // --- TEST 1: VERIFY BLOCKING ---
  test('Free user is blocked from premium content', async ({ page }) => {
    if (!FREE_USER.email || !FREE_USER.password) throw new Error("E2E Credentials missing");

    // 1. Login as Free User
    await page.goto('/login');
    await page.fill('input[type="email"]', FREE_USER.email);
    await page.fill('input[type="password"]', FREE_USER.password);
    await page.getByRole('button', { name: 'Sign-In' }).click();
    await expect(page).toHaveURL(/\/app/, { timeout: 30000 });

    // 2. Navigate to Biology
    await page.getByRole('link', { name: 'Biology' }).click();
    
    // 3. Attempt to Access Locked Practice Test (Test 2)
    const lockedTest = page.locator('.list-item').filter({ has: page.getByText('Test 2', { exact: true }) });
    await expect(lockedTest).toBeVisible({ timeout: 30000 });
    
    await lockedTest.click();
    
    // 4. Verify Upgrade Modal
    await expect(page.getByText('Upgrade to Edge Plus')).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Plans' })).toBeVisible();
    
    // Close Modal
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText('Upgrade to Edge Plus')).not.toBeVisible();

    // 5. Attempt to Access Locked Question Bank
    await page.getByRole('button', { name: 'Question Banks' }).click();
    
    const lockedQB = page.locator('.list-item').filter({ hasText: 'Cells' }).first();
    await lockedQB.click();

    await expect(page.getByText('Upgrade to Edge Plus')).toBeVisible();
  });


  // --- TEST 2: VERIFY GRANTING ---
  test('Pro user is granted access to premium content', async ({ page }) => {
    if (!PRO_USER.email || !PRO_USER.password) throw new Error("E2E Credentials missing");

    // 1. Login as Pro User
    await page.goto('/login');
    await page.fill('input[type="email"]', PRO_USER.email);
    await page.fill('input[type="password"]', PRO_USER.password);
    await page.getByRole('button', { name: 'Sign-In' }).click();
    await expect(page).toHaveURL(/\/app/, { timeout: 30000 });

    // 2. Navigate to Biology
    await page.getByRole('link', { name: 'Biology' }).click();

    // 3. Access Test 2 (Should be Unlocked)
    const unlockedTest = page.locator('.list-item').filter({ has: page.getByText('Test 2', { exact: true }) });
    await expect(unlockedTest).toBeVisible({ timeout: 30000 });
    
    await unlockedTest.dblclick();

    // 4. Verify Quiz Loads
    await expect(page.getByText('What is pinocytosis?')).toBeVisible({ timeout: 30000 });
    
    // Go Back
    await page.getByRole('link', { name: 'Back to Biology' }).click();

    // 5. Access Question Bank
    await page.getByRole('button', { name: 'Question Banks' }).click();
    const unlockedQB = page.locator('.list-item').filter({ hasText: 'Cells' }).first();
    await unlockedQB.dblclick();

    // 6. Verify QB Loads
    await expect(page.getByText('phospholipid membrane')).toBeVisible({ timeout: 30000 });
  });

});