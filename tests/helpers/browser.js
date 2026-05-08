// Actions browser réutilisables dans tous les scénarios

const ADMIN_EMAIL = 'test-admin@votrix.dev';

async function waitForFirebase(page) {
  await page.waitForFunction(
    () => typeof firebase !== 'undefined' && typeof firebase.auth === 'function',
    { timeout: 15_000 }
  );
}

async function loginAdmin(page) {
  await page.goto('/admin.html');
  await waitForFirebase(page);
  await page.evaluate(
    async ({ email, password }) => {
      await firebase.auth().signInWithEmailAndPassword(email, password);
    },
    { email: ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD }
  );
  await page.waitForFunction(
    () => document.getElementById('auth-overlay').style.display === 'none',
    { timeout: 10_000 }
  );
}

async function joinAsParticipant(browser, baseURL) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(baseURL + '/index.html');
  await waitForFirebase(page);
  // Attendre que l'auth anonyme soit établie et le contenu chargé
  await page.waitForSelector('#p-content', { state: 'visible', timeout: 15_000 });
  return page;
}

async function submitIdea(page, name, title, desc = '') {
  await page.click('.add-idea-btn');
  const nameField = page.locator('#p-name');
  if (await nameField.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await nameField.fill(name);
  }
  await page.fill('#p-idea-title', title);
  if (desc) await page.fill('#p-idea-desc', desc);
  await page.click('#modal-submit-btn');
  // Attendre fermeture de la modale
  await page.waitForSelector('#idea-modal:not(.open)', { timeout: 5_000 });
}

async function allocateAndVote(page, allocations) {
  // allocations: { [ideaTitle]: amount }
  for (const [title, amount] of Object.entries(allocations)) {
    await page.evaluate(
      ({ title, amount }) => {
        const ideaId = Object.keys(state.ideas).find(
          id => state.ideas[id].title === title
        );
        if (!ideaId) throw new Error('Idea not found: ' + title);
        const slider = document.getElementById('sl-' + ideaId);
        slider.value = amount;
        updateSlider(ideaId, String(amount));
      },
      { title, amount }
    );
  }
  await page.click('button:has-text("Confirm my votes")');
  await page.waitForSelector('#already-voted-banner', { state: 'visible', timeout: 10_000 });
}

async function adminGoToStep(page, stepIndex) {
  await page.click(`#step-${stepIndex}`);
  await page.waitForSelector(`#pane-${stepIndex}.active`, { timeout: 5_000 });
}

module.exports = { waitForFirebase, loginAdmin, joinAsParticipant, submitIdea, allocateAndVote, adminGoToStep };
