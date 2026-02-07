import { test, expect } from '@playwright/test';

// Use Environment Variables with Type Assertion
const FREE_USER = { 
  email: process.env.E2E_USER_FREE_EMAIL as string, 
  password: process.env.E2E_USER_FREE_PASSWORD as string
};
const PRO_USER = { 
  email: process.env.E2E_USER_PRO_EMAIL as string, 
  password: process.env.E2E_USER_PRO_PASSWORD as string
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

    // --- HANDLE MODALS (Practice Test) ---
    // FIX: Using exact: true for 'Start' to avoid matching 'Start Over' in the Resume Modal
    const startButton = page.getByRole('button', { name: 'Start', exact: true });
    const resumeButton = page.getByRole('button', { name: 'Yes, Resume' });
    const questionCard = page.locator('.question-card');

    // Wait for any of the expected UI states
    await expect(startButton.or(resumeButton).or(questionCard)).toBeVisible({ timeout: 15000 });

    if (await startButton.isVisible()) {
        await startButton.click();
    } else if (await resumeButton.isVisible()) {
        await resumeButton.click();
    }

    // 4. Verify Quiz Loads
    await expect(page.getByText('What is pinocytosis?')).toBeVisible({ timeout: 30000 });
    
    // Go Back
    await page.getByRole('link', { name: 'Back to Biology' }).click();

    // 5. Access Question Bank
    await page.getByRole('button', { name: 'Question Banks' }).click();
    const unlockedQB = page.locator('.list-item').filter({ hasText: 'Cells' }).first();
    await unlockedQB.dblclick();

    // --- HANDLE MODALS (Question Bank) ---
    const qbResumeButton = page.getByRole('button', { name: 'Yes, Resume' });
    const qbContent = page.getByText('phospholipid membrane');
    
    await expect(qbContent.or(qbResumeButton)).toBeVisible({ timeout: 15000 });

    if (await qbResumeButton.isVisible()) {
        await qbResumeButton.click();
    }

    // 6. Verify QB Loads
    await expect(page.getByText('phospholipid membrane')).toBeVisible({ timeout: 30000 });
  });

});