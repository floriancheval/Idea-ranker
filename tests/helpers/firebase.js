// Appels directs à l'API REST Firebase — pas de browser, utilisé pour setup/teardown

const FIREBASE_API_KEY = 'AIzaSyBrvrdhIBm0Q9PmPar5BaVpvaCUV9cgH6c';
const DB_URL = 'https://feature-ranker-default-rtdb.firebaseio.com';

async function getIdToken() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-admin@votrix.dev',
        password: process.env.TEST_ADMIN_PASSWORD,
        returnSecureToken: true,
      }),
    }
  );
  const data = await res.json();
  if (!data.idToken) throw new Error('Firebase auth failed: ' + JSON.stringify(data));
  return data.idToken;
}

async function resetSession(sessionName = 'Test Session') {
  const token = await getIdToken();
  const sessionId = 's_test_' + Date.now().toString(36);

  await fetch(`${DB_URL}/session.json?auth=${token}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: sessionName,
      phase: 'setup',
      ideas: null,
      participants: 0,
      votedCount: 0,
      sessionId,
      shortUrl: '',
      ballots: null,
    }),
  });

  await fetch(`${DB_URL}/presence.json?auth=${token}`, { method: 'DELETE' });
}

async function setPhase(phase) {
  const token = await getIdToken();
  await fetch(`${DB_URL}/session/phase.json?auth=${token}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(phase),
  });
}

async function getSession() {
  const token = await getIdToken();
  const res = await fetch(`${DB_URL}/session.json?auth=${token}`);
  return res.json();
}

module.exports = { getIdToken, resetSession, setPhase, getSession };
