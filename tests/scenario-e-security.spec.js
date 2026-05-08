const { test, expect } = require('@playwright/test');
const { resetSession } = require('./helpers/firebase');
const { loginAdmin, joinAsParticipant, submitIdea, allocateAndVote } = require('./helpers/browser');

test.describe('Scénario E — Règles métier et sécurité', () => {
  let adminPage, p1Page, p2Page;
  let baseURL;

  test.beforeAll(async ({ browser }) => {
    await resetSession('Session E');

    adminPage = await browser.newPage();
    await loginAdmin(adminPage);
    baseURL = new URL(adminPage.url()).origin +
      new URL(adminPage.url()).pathname.replace('admin.html', '');

    p1Page = await joinAsParticipant(browser, baseURL);
    p2Page = await joinAsParticipant(browser, baseURL);

    // Démarrer la session et ajouter des idées
    await adminPage.click('.big-btn-green');
    await expect(adminPage.locator('#pane-1')).toHaveClass(/active/);

    await submitIdea(p1Page, 'Alice', 'Idée de Alice');
    await submitIdea(p2Page, 'Bob', 'Idée de Bob');

    await adminPage.waitForFunction(
      () => document.getElementById('i-ideas')?.textContent === '2',
      { timeout: 10_000 }
    );
  });

  test.afterAll(async () => {
    for (const p of [adminPage, p1Page, p2Page]) await p?.close();
  });

  test('E1 — P1 ne voit pas Edit/Delete sur l\'idée de P2', async () => {
    // Trouver la carte de P2 (non-mine) chez P1
    const otherCard = p1Page.locator('.idea-card:not(.mine)');
    await expect(otherCard).toBeVisible();
    await expect(otherCard.locator('button:has-text("Edit")')).not.toBeVisible();
    await expect(otherCard.locator('button:has-text("Delete")')).not.toBeVisible();
  });

  test('E2 — confirmer un vote avec budget $0 est bloqué', async () => {
    // Passer en phase vote
    await adminPage.click('.big-btn-orange');
    await expect(adminPage.locator('#pane-2')).toHaveClass(/active/, { timeout: 10_000 });
    await expect(p1Page.locator('#p-vote-phase')).toBeVisible({ timeout: 15_000 });

    // P1 tente de voter sans allouer de budget
    await p1Page.click('button:has-text("Confirm my votes")');
    await expect(p1Page.locator('.toast')).toContainText('Allocate some budget first');
    await expect(p1Page.locator('#already-voted-banner')).not.toBeVisible();
  });

  test('E3 — slider ne peut pas dépasser $100 au total', async () => {
    // Mettre 100$ sur Idée de Alice
    await p1Page.evaluate(() => {
      const ideaId = Object.keys(state.ideas).find(
        id => state.ideas[id].title === 'Idée de Alice'
      );
      document.getElementById('sl-' + ideaId).value = 100;
      updateSlider(ideaId, '100');
    });

    // Tenter de mettre 60$ sur Idée de Bob (devrait être bloqué à 0)
    await p1Page.evaluate(() => {
      const ideaId = Object.keys(state.ideas).find(
        id => state.ideas[id].title === 'Idée de Bob'
      );
      document.getElementById('sl-' + ideaId).value = 60;
      updateSlider(ideaId, '60');
    });

    const budgetLeft = await p1Page.locator('#p-budget-left').textContent();
    expect(parseInt(budgetLeft.replace('$', ''))).toBeGreaterThanOrEqual(0);

    const totalUsed = await p1Page.evaluate(() =>
      Object.values(localAllocations).reduce((s, v) => s + v, 0)
    );
    expect(totalUsed).toBeLessThanOrEqual(100);
  });

  test('E4 — P1 vote, bannière "already voted" immédiate', async () => {
    await allocateAndVote(p1Page, { 'Idée de Alice': 100 });
    await expect(p1Page.locator('#already-voted-banner')).toBeVisible();
    await expect(p1Page.locator('#vote-form')).not.toBeVisible();
  });

  test('E5 — double vote bloqué : rechargement page maintient "already voted"', async () => {
    await p1Page.reload();
    await p1Page.waitForSelector('#p-vote-phase', { state: 'visible', timeout: 15_000 });
    await expect(p1Page.locator('#already-voted-banner')).toBeVisible({ timeout: 10_000 });
    await expect(p1Page.locator('#vote-form')).not.toBeVisible();
  });

});
