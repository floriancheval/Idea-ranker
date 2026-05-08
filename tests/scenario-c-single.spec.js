const { test, expect } = require('@playwright/test');
const { resetSession } = require('./helpers/firebase');
const { loginAdmin, joinAsParticipant, submitIdea } = require('./helpers/browser');

test.describe('Scénario C — Flux complet, 1 participant', () => {
  let adminPage;
  let p1Page;

  test.beforeAll(async ({ browser }) => {
    await resetSession('Session C');

    // Admin se connecte
    adminPage = await browser.newPage();
    await loginAdmin(adminPage);

    // Participant rejoint
    const baseURL = adminPage.context()._options.baseURL ||
      'https://floriancheval.github.io/Idea-ranker';
    p1Page = await joinAsParticipant(browser, baseURL);
  });

  test.afterAll(async () => {
    await adminPage?.close();
    await p1Page?.close();
  });

  test('C1 — "Close ideation" bloqué avec 0 idées', async () => {
    // Admin démarre la session
    await adminPage.click('.big-btn-green');
    await expect(adminPage.locator('#pane-1')).toHaveClass(/active/);

    await adminPage.click('.big-btn-orange');
    await expect(adminPage.locator('.toast')).toContainText('Add at least one idea first');
  });

  test('C2 — participant voit la phase idéation après démarrage', async () => {
    await p1Page.waitForSelector('#p-ideas-phase', { state: 'visible', timeout: 15_000 });
    await expect(p1Page.locator('#p-phase-badge')).toContainText('Phase 1');
  });

  test('C3 — participant soumet sa première idée', async () => {
    await submitIdea(p1Page, 'Alice', 'Première idée', 'Description de la première idée');

    await expect(p1Page.locator('#p-ideas-grid')).toContainText('Première idée');
    await expect(p1Page.locator('#p-count')).toContainText('(1)');
    // Sa propre idée a le bandeau bleu (classe "mine")
    await expect(p1Page.locator('.idea-card.mine')).toBeVisible();
  });

  test('C4 — admin voit l\'idée en temps réel', async () => {
    await expect(adminPage.locator('#ideation-list')).toContainText('Première idée', { timeout: 10_000 });
    await expect(adminPage.locator('#i-ideas')).toContainText('1');
  });

  test('C5 — participant soumet une deuxième idée', async () => {
    await submitIdea(p1Page, 'Alice', 'Deuxième idée', '');

    await expect(p1Page.locator('#p-ideas-grid')).toContainText('Deuxième idée');
    await expect(p1Page.locator('#p-count')).toContainText('(2)');
    await expect(p1Page.locator('.idea-card.mine')).toHaveCount(2);
  });

  test('C6 — participant peut éditer sa propre idée', async () => {
    // Trouver le bouton Edit de la première idée
    const firstCard = p1Page.locator('.idea-card.mine').first();
    await firstCard.locator('button:has-text("Edit")').click();

    await p1Page.waitForSelector('#idea-modal.open');
    await p1Page.fill('#p-idea-title', 'Première idée (modifiée)');
    await p1Page.click('#modal-submit-btn');

    await expect(p1Page.locator('#p-ideas-grid')).toContainText('Première idée (modifiée)');
  });

  test('C7 — admin supprime une idée, il en reste une', async () => {
    await expect(adminPage.locator('#i-ideas')).toContainText('2');

    // Cliquer sur la première idée dans la liste admin
    await adminPage.locator('#ideation-list .idea-row').first().click();
    await adminPage.waitForSelector('#admin-idea-modal.open');

    adminPage.on('dialog', dialog => dialog.accept());
    await adminPage.click('#aim-delete-btn');

    await expect(adminPage.locator('#i-ideas')).toContainText('1', { timeout: 10_000 });
  });

  test('C8 — admin ferme l\'ideation (1 idée restante)', async () => {
    await adminPage.click('.big-btn-orange');
    await expect(adminPage.locator('#pane-2')).toHaveClass(/active/, { timeout: 10_000 });
    await expect(adminPage.locator('#step-2')).toHaveClass(/active/);
  });

  test('C9 — participant passe en phase vote', async () => {
    await expect(p1Page.locator('#p-vote-phase')).toBeVisible({ timeout: 10_000 });
    await expect(p1Page.locator('#p-phase-badge')).toContainText('Phase 2');
  });

  test('C10 — admin ferme le vote', async () => {
    await adminPage.click('.big-btn-blue');
    await expect(adminPage.locator('#pane-3')).toHaveClass(/active/, { timeout: 10_000 });
  });

  test('C11 — résultats affichés avec 0 votes', async () => {
    // Personne n'a voté — résultats doivent indiquer "no votes"
    await expect(adminPage.locator('#results-bars')).toContainText('No votes');
    await expect(adminPage.locator('#r-voted')).toContainText('0');
  });

  test('C12 — participant voit la page résultats', async () => {
    await expect(p1Page.locator('#p-results-phase')).toBeVisible({ timeout: 10_000 });
    await expect(p1Page.locator('#p-phase-badge')).toContainText('Final');
  });

});
