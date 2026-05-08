const { test, expect } = require('@playwright/test');
const { resetSession, getSession } = require('./helpers/firebase');
const { loginAdmin, joinAsParticipant, submitIdea } = require('./helpers/browser');

test.describe('Scénario F — Reset de session', () => {
  let adminPage, p1Page;
  let baseURL;

  test.beforeAll(async ({ browser }) => {
    await resetSession('Session F');

    adminPage = await browser.newPage();
    await loginAdmin(adminPage);
    baseURL = new URL(adminPage.url()).origin +
      new URL(adminPage.url()).pathname.replace('admin.html', '');

    p1Page = await joinAsParticipant(browser, baseURL);

    // Mettre la session dans un état non-vide (idéation avec une idée)
    await adminPage.click('.big-btn-green');
    await submitIdea(p1Page, 'Alice', 'Idée avant reset');
    await adminPage.waitForFunction(
      () => document.getElementById('i-ideas')?.textContent === '1',
      { timeout: 10_000 }
    );
  });

  test.afterAll(async () => {
    for (const p of [adminPage, p1Page]) await p?.close();
  });

  test('F1 — naviguer vers l\'étape Reset', async () => {
    await adminPage.click('#step-4');
    await expect(adminPage.locator('#pane-4')).toHaveClass(/active/);
    await expect(adminPage.locator('#reset-session-name')).toContainText('Session F');
  });

  test('F2 — annuler le reset : rien ne change', async () => {
    await adminPage.click('button:has-text("Reset session")');
    await adminPage.waitForSelector('#reset-modal.open');
    await adminPage.click('button:has-text("Cancel")');

    await expect(adminPage.locator('#reset-modal')).not.toHaveClass(/open/);

    // La session est toujours en phase ideas
    const session = await getSession();
    expect(session.phase).toBe('ideas');
  });

  test('F3 — confirmer le reset : session remise à zéro', async () => {
    await adminPage.click('button:has-text("Reset session")');
    await adminPage.waitForSelector('#reset-modal.open');
    await adminPage.click('#reset-modal button:has-text("Yes, reset")');

    await expect(adminPage.locator('.toast')).toContainText('Session reset', { timeout: 10_000 });

    // Vérifier l'état en base
    const session = await getSession();
    expect(session.phase).toBe('setup');
    expect(session.participants).toBe(0);
    expect(session.votedCount).toBe(0);
    expect(session.ideas).toBeNull();
    expect(session.ballots).toBeNull();
  });

  test('F4 — admin revient à l\'étape Setup', async () => {
    await expect(adminPage.locator('#pane-0')).toHaveClass(/active/, { timeout: 10_000 });
    await expect(adminPage.locator('#step-0')).toHaveClass(/active/);
  });

  test('F5 — participant connecté repasse à l\'écran d\'attente', async () => {
    await expect(p1Page.locator('#p-setup-wait')).toBeVisible({ timeout: 15_000 });
    await expect(p1Page.locator('#p-ideas-phase')).not.toBeVisible();
  });

});
