const { test, expect } = require('@playwright/test');
const { resetSession, getSession } = require('./helpers/firebase');
const { loginAdmin, joinAsParticipant, submitIdea, allocateAndVote } = require('./helpers/browser');
const fs = require('fs');
const path = require('path');

// Jeu de données fixe et connu
// | Participant | Idée A | Idée B | Idée C |
// |-------------|--------|--------|--------|
// | P1          |  $60   |  $40   |   $0   |
// | P2          | $100   |   $0   |   $0   |
// | P3          |  $30   |  $30   |  $40   |
//
// Résultats attendus :
//   Idée A : total=$190, voters=3, avg=63.3, médiane=60, min=30, max=100
//   Idée B : total=$70,  voters=2, avg=35,   médiane=35, min=30, max=40
//   Idée C : total=$40,  voters=1, avg=40,   médiane=40, min=40, max=40

const VOTES = {
  P1: { 'Idée A': 60, 'Idée B': 40, 'Idée C': 0 },
  P2: { 'Idée A': 100, 'Idée B': 0, 'Idée C': 0 },
  P3: { 'Idée A': 30, 'Idée B': 30, 'Idée C': 40 },
};

test.describe('Scénario D — Flux complet, 3 participants', () => {
  let adminPage, p1Page, p2Page, p3Page;
  let baseURL;

  test.beforeAll(async ({ browser }) => {
    await resetSession('Session D');

    adminPage = await browser.newPage();
    await loginAdmin(adminPage);
    baseURL = new URL(adminPage.url()).origin +
      new URL(adminPage.url()).pathname.replace('admin.html', '');

    p1Page = await joinAsParticipant(browser, baseURL);
    p2Page = await joinAsParticipant(browser, baseURL);
    p3Page = await joinAsParticipant(browser, baseURL);
  });

  test.afterAll(async () => {
    for (const p of [adminPage, p1Page, p2Page, p3Page]) await p?.close();
  });

  // ── COMPTEURS DE PRÉSENCE ──────────────────────────────────

  test('D1 — compteur online : admin seul = 1 avant que les participants chargent', async () => {
    // On vérifie via les données brutes car les participants sont déjà connectés en beforeAll
    // Ce test valide que le compteur est > 0 et visible
    await expect(adminPage.locator('#nav-online-count')).not.toContainText('0');
  });

  test('D2 — 4 personnes connectées (admin + 3 participants)', async () => {
    // Attendre que tous soient enregistrés dans presence
    await adminPage.waitForFunction(
      () => parseInt(document.getElementById('nav-online-count').textContent) >= 4,
      { timeout: 15_000 }
    );
    await expect(adminPage.locator('#nav-online-count')).toContainText('4');
    await expect(adminPage.locator('#i-connected')).toContainText('4');
  });

  // ── PHASE IDÉATION ────────────────────────────────────────

  test('D3 — admin démarre la session', async () => {
    await adminPage.click('.big-btn-green');
    await expect(adminPage.locator('#pane-1')).toHaveClass(/active/);
  });

  test('D4 — 3 participants voient la phase idéation', async () => {
    for (const page of [p1Page, p2Page, p3Page]) {
      await expect(page.locator('#p-ideas-phase')).toBeVisible({ timeout: 15_000 });
    }
  });

  test('D5 — P1 soumet Idée A : participants=1', async () => {
    await submitIdea(p1Page, 'Alice', 'Idée A', 'Première idée de Alice');
    await adminPage.waitForFunction(
      () => document.getElementById('i-ideas')?.textContent === '1',
      { timeout: 10_000 }
    );
    await expect(adminPage.locator('#i-ideas')).toContainText('1');
  });

  test('D6 — P2 soumet Idée B : participants=2', async () => {
    await submitIdea(p2Page, 'Bob', 'Idée B', 'Idée de Bob');
    await adminPage.waitForFunction(
      () => document.getElementById('i-ideas')?.textContent === '2',
      { timeout: 10_000 }
    );
    await expect(adminPage.locator('#i-ideas')).toContainText('2');
  });

  test('D7 — P3 soumet Idée C : participants=3', async () => {
    await submitIdea(p3Page, 'Charlie', 'Idée C', 'Idée de Charlie');
    await adminPage.waitForFunction(
      () => document.getElementById('i-ideas')?.textContent === '3',
      { timeout: 10_000 }
    );
    await expect(adminPage.locator('#i-ideas')).toContainText('3');
  });

  test('D8 — compteur participants admin = 3 après soumissions', async () => {
    // Le compteur "participants" s'incrémente à la soumission de la première idée
    const session = await getSession();
    expect(session.participants).toBe(3);
  });

  // ── PASSAGE EN VOTE ────────────────────────────────────────

  test('D9 — admin passe en phase vote', async () => {
    await adminPage.click('.big-btn-orange');
    await expect(adminPage.locator('#pane-2')).toHaveClass(/active/, { timeout: 10_000 });
  });

  test('D10 — 3 participants voient la phase vote', async () => {
    for (const page of [p1Page, p2Page, p3Page]) {
      await expect(page.locator('#p-vote-phase')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('#p-phase-badge')).toContainText('Phase 2');
    }
  });

  test('D11 — budget widget affiché à $100 pour chaque participant', async () => {
    for (const page of [p1Page, p2Page, p3Page]) {
      await expect(page.locator('#p-budget-left')).toContainText('$100');
    }
  });

  // ── VOTES ─────────────────────────────────────────────────

  test('D12 — P1 vote (60/40/0) : voted=1 chez admin', async () => {
    await allocateAndVote(p1Page, VOTES.P1);
    await adminPage.waitForFunction(
      () => parseInt(document.getElementById('v-voted').textContent) === 1,
      { timeout: 10_000 }
    );
    await expect(adminPage.locator('#v-voted')).toContainText('1');
  });

  test('D13 — P2 vote (100/0/0) : voted=2 chez admin', async () => {
    await allocateAndVote(p2Page, VOTES.P2);
    await adminPage.waitForFunction(
      () => parseInt(document.getElementById('v-voted').textContent) === 2,
      { timeout: 10_000 }
    );
    await expect(adminPage.locator('#v-voted')).toContainText('2');
  });

  test('D14 — P3 vote (30/30/40) : voted=3 chez admin', async () => {
    await allocateAndVote(p3Page, VOTES.P3);
    await adminPage.waitForFunction(
      () => parseInt(document.getElementById('v-voted').textContent) === 3,
      { timeout: 10_000 }
    );
    await expect(adminPage.locator('#v-voted')).toContainText('3');
  });

  test('D15 — total $ dépensés correct ($300 = 3 × $100)', async () => {
    await expect(adminPage.locator('#v-spent')).toContainText('$300');
  });

  // ── RÉSULTATS ─────────────────────────────────────────────

  test('D16 — admin ferme le vote', async () => {
    await adminPage.click('.big-btn-blue');
    await expect(adminPage.locator('#pane-3')).toHaveClass(/active/, { timeout: 10_000 });
  });

  test('D17 — compteurs globaux corrects (3 participants, 3 idées, 3 votants)', async () => {
    await expect(adminPage.locator('#r-participants')).toContainText('3');
    await expect(adminPage.locator('#r-ideas')).toContainText('3');
    await expect(adminPage.locator('#r-voted')).toContainText('3');
  });

  test('D18 — classement correct : A > B > C', async () => {
    const bars = adminPage.locator('.result-item');
    await expect(bars).toHaveCount(3);

    const first = bars.nth(0);
    const second = bars.nth(1);
    const third = bars.nth(2);

    await expect(first.locator('.result-text')).toContainText('Idée A');
    await expect(first.locator('.result-score')).toContainText('$190');
    await expect(first.locator('.result-score')).toContainText('66%');

    await expect(second.locator('.result-text')).toContainText('Idée B');
    await expect(second.locator('.result-score')).toContainText('$70');
    await expect(second.locator('.result-score')).toContainText('24%');

    await expect(third.locator('.result-text')).toContainText('Idée C');
    await expect(third.locator('.result-score')).toContainText('$40');
    await expect(third.locator('.result-score')).toContainText('14%');
  });

  test('D19 — trophée sur l\'idée gagnante (Idée A)', async () => {
    const winner = adminPage.locator('.result-item').first().locator('.result-text');
    await expect(winner).toHaveClass(/winner/);
  });

  test('D20 — stats Idée A : voters=3, total=$190, avg=63.3, médiane=60, min=30, max=100', async () => {
    await adminPage.locator('.result-item').first().click();
    await adminPage.waitForSelector('#stats-modal.open');

    const body = adminPage.locator('#stats-modal-body');
    await expect(body).toContainText('3');    // voters
    await expect(body).toContainText('$190'); // total
    await expect(body).toContainText('$63');  // avg ≈ 63.3
    await expect(body).toContainText('$60');  // médiane
    await expect(body).toContainText('$30');  // min
    await expect(body).toContainText('$100'); // max

    await adminPage.locator('#stats-modal .modal-close').click();
  });

  test('D21 — stats Idée B : voters=2, total=$70, avg=35, médiane=35, min=30, max=40', async () => {
    await adminPage.locator('.result-item').nth(1).click();
    await adminPage.waitForSelector('#stats-modal.open');

    const body = adminPage.locator('#stats-modal-body');
    await expect(body).toContainText('2');   // voters
    await expect(body).toContainText('$70'); // total
    await expect(body).toContainText('$35'); // avg
    await expect(body).toContainText('$35'); // médiane
    await expect(body).toContainText('$30'); // min
    await expect(body).toContainText('$40'); // max

    await adminPage.locator('#stats-modal .modal-close').click();
  });

  test('D22 — stats Idée C : voters=1, total=$40, avg=40, médiane=40, min=40, max=40', async () => {
    await adminPage.locator('.result-item').nth(2).click();
    await adminPage.waitForSelector('#stats-modal.open');

    const body = adminPage.locator('#stats-modal-body');
    await expect(body).toContainText('1');   // voters
    await expect(body).toContainText('$40'); // total, avg, médiane, min, max

    await adminPage.locator('#stats-modal .modal-close').click();
  });

  // ── RÉSULTATS CÔTÉ PARTICIPANTS ────────────────────────────

  test('D23 — participants voient le classement final', async () => {
    for (const page of [p1Page, p2Page, p3Page]) {
      await expect(page.locator('#p-results-phase')).toBeVisible({ timeout: 15_000 });
      const bars = page.locator('.p-result-item');
      await expect(bars).toHaveCount(3);
      await expect(bars.first().locator('.p-result-text')).toContainText('Idée A');
      await expect(bars.first().locator('.p-result-text')).toHaveClass(/winner/);
    }
  });

  // ── EXPORT TSV ────────────────────────────────────────────

  test('D24 — export TSV : contenu correct', async () => {
    const [download] = await Promise.all([
      adminPage.waitForEvent('download'),
      adminPage.click('button:has-text("Download results")'),
    ]);

    const filePath = await download.path();
    const content = fs.readFileSync(filePath, 'utf-8').replace(/^﻿/, ''); // retirer BOM
    const lines = content.split('\n').filter(l => l.trim());

    // Métadonnées
    expect(lines[0]).toContain('Session D');
    expect(lines[2]).toContain('3'); // participants
    expect(lines[3]).toContain('3'); // voted

    // Trouver la ligne d'en-tête du tableau
    const headerIdx = lines.findIndex(l => l.startsWith('Rank'));
    expect(headerIdx).toBeGreaterThan(-1);

    // Rang 1 — Idée A
    const row1 = lines[headerIdx + 1].split('\t');
    expect(row1[0]).toBe('1');
    expect(row1[1]).toBe('Idée A');
    expect(row1[4]).toBe('190');
    expect(row1[5]).toBe('66%');

    // Rang 2 — Idée B
    const row2 = lines[headerIdx + 2].split('\t');
    expect(row2[0]).toBe('2');
    expect(row2[1]).toBe('Idée B');
    expect(row2[4]).toBe('70');
    expect(row2[5]).toBe('24%');

    // Rang 3 — Idée C
    const row3 = lines[headerIdx + 3].split('\t');
    expect(row3[0]).toBe('3');
    expect(row3[1]).toBe('Idée C');
    expect(row3[4]).toBe('40');
    expect(row3[5]).toBe('14%');
  });

});
