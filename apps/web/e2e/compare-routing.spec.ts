import { test, expect } from '@playwright/test';

test.describe('Compare Routing', () => {
  test('renders MISSING_IDS when no params are provided', async ({ page }) => {
    // Assert no catalog API calls
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/v1/products') || url.includes('/api/v1/categories')) {
        expect(false).toBeTruthy(); // Fail if catalog request is made
      }
    });

    await page.goto('/compare');
    await expect(page.locator('app-error-state')).toBeVisible();
    await expect(page.getByText('Missing Products')).toBeVisible();
  });

  test('renders MISSING_IDS when one param is missing', async ({ page }) => {
    await page.goto('/compare?left=5f9b3b3b3b3b3b3b3b3b3b3b');
    await expect(page.locator('app-error-state')).toBeVisible();
    await expect(page.getByText('Missing Products')).toBeVisible();
  });

  test('renders MALFORMED_LEFT when left ID is invalid', async ({ page }) => {
    await page.goto('/compare?left=invalid_id_length&right=5f9b3b3b3b3b3b3b3b3b3b3b');
    await expect(page.locator('app-error-state')).toBeVisible();
    await expect(page.getByText('Invalid Left Product')).toBeVisible();
  });

  test('renders MALFORMED_RIGHT when right ID is invalid', async ({ page }) => {
    await page.goto('/compare?left=5f9b3b3b3b3b3b3b3b3b3b3b&right=short');
    await expect(page.locator('app-error-state')).toBeVisible();
    await expect(page.getByText('Invalid Right Product')).toBeVisible();
  });

  test('renders DUPLICATE_IDS when both IDs are identical (same case)', async ({ page }) => {
    await page.goto('/compare?left=5f9b3b3b3b3b3b3b3b3b3b3b&right=5f9b3b3b3b3b3b3b3b3b3b3b');
    await expect(page.locator('app-error-state')).toBeVisible();
    await expect(page.getByText('Duplicate Products')).toBeVisible();
  });

  test('renders DUPLICATE_IDS when both IDs are identical (different case)', async ({ page }) => {
    await page.goto('/compare?left=64ABCDEF1234567890ABCDEF&right=64abcdef1234567890abcdef');
    await expect(page.locator('app-error-state')).toBeVisible();
    await expect(page.getByText('Duplicate Products')).toBeVisible();
  });

  test('renders VALID deferred state and makes no API requests', async ({ page }) => {
    let apiCallMade = false;
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/v1/products') || url.includes('/api/v1/categories')) {
        apiCallMade = true;
      }
    });

    await page.goto('/compare?left=5f9b3b3b3b3b3b3b3b3b3b3b&right=5f9b3b3b3b3b3b3b3b3b3b3c');
    
    // Check placeholder UI
    const placeholder = page.locator('[data-testid="valid-compare-placeholder"]');
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toContainText('Comparison presentation for 5f9b3b3b3b3b3b3b3b3b3b3b and 5f9b3b3b3b3b3b3b3b3b3b3c will be implemented in Stage 6');

    // Confirm no API request occurred
    expect(apiCallMade).toBe(false);
  });
});
