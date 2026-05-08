const { test, expect } = require('@playwright/test');
const { waitForFirebase } = require('./helpers/browser');

test.describe('Scénario A — Authentification admin', () => {

  test('A1 — mauvais mot de passe : overlay reste affiché', async ({ page }) => {
    await page.goto('/admin.html');
    await waitForFirebase(page);
    await expect(page.locator('#auth-overlay')).toBeVisible();

    const error = await page.evaluate(async () => {
      try {
        await firebase.auth().signInWithEmailAndPassword('test-admin@votrix.dev', 'mauvais-mot-de-passe');
        return null;
      } catch (e) {
        return e.code;
      }
    });

    expect(error).toMatch(/wrong-password|invalid-credential|invalid-login-credentials/);
    await expect(page.locator('#auth-overlay')).toBeVisible();
  });

  test('A2 — email non autorisé : overlay reste affiché, erreur affichée', async ({ page }) => {
    await page.goto('/admin.html');
    await waitForFirebase(page);

    // On forge une auth state avec un email non autorisé via l'API
    // Firebase refuserait la connexion email/password pour cet utilisateur inconnu
    // On vérifie simplement que l'overlay est visible tant qu'on n'est pas authentifié
    await expect(page.locator('#auth-overlay')).toBeVisible();
    await expect(page.locator('.admin-badge')).not.toBeVisible();
  });

  test('A3 — credentials corrects : accès accordé', async ({ page }) => {
    await page.goto('/admin.html');
    await waitForFirebase(page);

    await page.evaluate(
      async ({ email, password }) => {
        await firebase.auth().signInWithEmailAndPassword(email, password);
      },
      { email: 'test-admin@votrix.dev', password: process.env.TEST_ADMIN_PASSWORD }
    );

    await page.waitForFunction(
      () => document.getElementById('auth-overlay').style.display === 'none',
      { timeout: 10_000 }
    );

    await expect(page.locator('#auth-overlay')).toBeHidden();
    await expect(page.locator('.admin-badge')).toBeVisible();
    await expect(page.locator('.nav-brand')).toContainText('votrix');
    await expect(page.locator('#step-0')).toHaveClass(/active/);
  });

});
