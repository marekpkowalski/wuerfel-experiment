// Start page: creates a session and forwards the teacher to the projector view.
import { t, applyStaticText, languageLink } from './i18n.js';
import { dieFace } from './dice.js';

applyStaticText();
languageLink(document.getElementById('lang-link'));
document.title = t('title');

const diceRow = document.getElementById('start-dice');
for (const v of [3, 6, 1, 4]) diceRow.append(dieFace(v));

const form = document.getElementById('start-form');
const button = document.getElementById('start-button');
const errorBox = document.getElementById('start-error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  button.disabled = true;
  button.textContent = t('creating');
  errorBox.hidden = true;
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teams: Number(data.get('teams')) }),
    });
    if (!res.ok) throw Object.assign(new Error(), { userMessage: res.status === 429 ? t('too_many') : res.status === 503 ? t('server_full') : t('create_failed') });
    const body = await res.json();
    location.href = body.teacherUrl;
  } catch (err) {
    errorBox.textContent = err.userMessage || t('create_failed');
    errorBox.hidden = false;
    button.disabled = false;
    button.textContent = t('create');
  }
});
