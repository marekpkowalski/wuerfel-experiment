// Session page. The same page serves two roles:
//   /session/<id>  student: pick a team, enter rolls, see charts
//   /teacher/<id>  teacher (projector): QR code, class charts, team overview, delete, CSV export
import { t, applyStaticText, languageLink } from './i18n.js';
import { connect } from './net.js';
import { dieFace } from './dice.js';
import * as S from './stats.js';
import { frequencyChart, runChart } from './plots.js';

const $ = (id) => document.getElementById(id);

const [routeRole, rawId] = location.pathname.split('/').filter(Boolean);
const isTeacher = routeRole === 'teacher';
const sessionId = decodeURIComponent(rawId || '');
const TEAM_STORE = `wx-team:${sessionId}`;
const KEY_STORE = `wx-key:${sessionId}`;

function load(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function save(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

// The teacher key arrives in the URL fragment. Store it and remove it from the
// address bar so it is not readable on the projected screen.
let teacherKey = null;
if (isTeacher) {
  const m = location.hash.match(/key=([\w-]+)/);
  if (m) {
    save(KEY_STORE, m[1]);
    history.replaceState(null, '', location.pathname + location.search);
  }
  teacherKey = load(KEY_STORE);
}

// ------------------------------------------------------------------ state

let state = null; // latest session state from the server
let clockOffset = 0; // server time minus local time
let role = 'student'; // confirmed by the server
let myTeamId = isTeacher ? null : load(TEAM_STORE);
let view = isTeacher ? 'all' : 'mine'; // 'mine' | 'all' | a team id
let selected = null; // index of the log cell being corrected
let percent = false;
let ended = false;

const team = (id) => state?.teams.find((tm) => tm.id === id) || null;
const shownTeamId = () => (view === 'all' ? null : view === 'mine' ? myTeamId : view);
const canEdit = () => !isTeacher && !!myTeamId && shownTeamId() === myTeamId && !ended;
const lastFilled = (rolls) => {
  for (let i = rolls.length - 1; i >= 0; i--) if (rolls[i] != null) return i;
  return -1;
};

// ------------------------------------------------------------------ connection

const net = connect(sessionId, {
  onOpen() {
    net.send({ type: 'hello', role: isTeacher ? 'teacher' : 'student', key: teacherKey || undefined });
    if (myTeamId) net.send({ type: 'join_team', teamId: myTeamId });
  },
  onMessage(msg) {
    if (msg.type === 'state') {
      state = msg.session;
      clockOffset = state.now - Date.now();
      if (!isTeacher && (!myTeamId || !team(myTeamId))) {
        myTeamId = null;
        openPicker();
      }
      scheduleRender();
    } else if (msg.type === 'welcome') {
      role = msg.role;
      scheduleRender();
    } else if (msg.type === 'error') {
      handleError(msg.code);
    }
  },
  onStatus(status) {
    const conn = $('conn');
    conn.dataset.status = status;
    conn.textContent = t(status === 'online' ? 'online' : status === 'connecting' ? 'connecting' : 'offline');
    if (status === 'offline') showBanner(t('offline_banner'));
    else if (status === 'full') showBanner(t('session_full'));
    else if (status === 'online') hideBanner();
    if (status === 'not_found' || status === 'expired') endSession(status);
  },
});

function handleError(code) {
  if (code === 'bad_key') {
    showBanner(t('bad_key'));
  } else if (code === 'no_team') {
    myTeamId = null;
    openPicker();
  } else if (code === 'full') {
    announce(t('err_full'));
  } else if (code === 'rate_limited') {
    announce(t('err_rate_limited'));
  } else {
    announce(t('err_generic'));
  }
}

function endSession(status) {
  ended = true;
  document.body.classList.remove('is-loading');
  $('main').hidden = true;
  $('picker').hidden = true;
  $('ended').hidden = false;
  $('ended-title').textContent = t(status === 'expired' ? 'expired' : 'not_found');
}

// ------------------------------------------------------------------ actions

function sendRoll(value) {
  if (!canEdit()) return;
  const tm = team(myTeamId);
  if (selected != null) {
    tm.rolls[selected] = value; // optimistic; the server state follows within ~150 ms
    net.send({ type: 'set_roll', index: selected, value });
    announce(t('entered', selected + 1, value));
    selected = null;
  } else {
    const next = lastFilled(tm.rolls) + 1;
    if (next >= 100) return announce(t('err_full'));
    tm.rolls[next] = value;
    net.send({ type: 'add_roll', value });
    announce(t('entered', next + 1, value));
  }
  pulse(value);
  render();
}

function undoLast() {
  if (!canEdit()) return;
  const tm = team(myTeamId);
  const last = lastFilled(tm.rolls);
  if (last < 0) return;
  tm.rolls[last] = null;
  net.send({ type: 'undo' });
  announce(t('removed', last + 1));
  selected = null;
  render();
}

function clearSelected() {
  if (!canEdit() || selected == null) return;
  team(myTeamId).rolls[selected] = null;
  net.send({ type: 'set_roll', index: selected, value: null });
  announce(t('removed', selected + 1));
  selected = null;
  render();
}

function clearTeam(teamId) {
  const tm = team(teamId);
  if (!tm || !confirm(t('confirm_clear', tm.name))) return;
  net.send({ type: 'clear_team', teamId: isTeacher ? teamId : undefined });
  tm.rolls.fill(null);
  selected = null;
  render();
}

function chooseTeam(teamId) {
  myTeamId = teamId;
  save(TEAM_STORE, teamId);
  net.send({ type: 'join_team', teamId });
  view = 'mine';
  selected = null;
  $('picker').hidden = true;
  render();
  $('pad').querySelector('button')?.focus();
}

function exportCsv() {
  const lines = ['team,roll,value'];
  for (const tm of state.teams) {
    tm.rolls.forEach((v, i) => {
      if (v != null) lines.push(`${tm.name},${i + 1},${v}`);
    });
  }
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `wuerfel-${sessionId}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ------------------------------------------------------------------ static UI setup

applyStaticText();
languageLink($('lang-link'));
document.title = t('title');

// Six dice buttons for entering a roll
$('pad').setAttribute('aria-label', t('pad_label'));
for (const v of S.FACES) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pad-key';
  b.dataset.face = v;
  b.setAttribute('aria-label', t('enter_face', v));
  b.append(dieFace(v));
  const digit = document.createElement('span');
  digit.className = 'pad-digit';
  digit.textContent = v;
  digit.setAttribute('aria-hidden', 'true');
  b.append(digit);
  b.addEventListener('click', () => sendRoll(v));
  $('pad').append(b);
}

function pulse(v) {
  const key = $('pad').querySelector(`[data-face="${v}"]`);
  if (!key || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  key.classList.remove('pressed');
  void key.offsetWidth; // restart the animation
  key.classList.add('pressed');
}

// 100 log cells, built once
$('log').setAttribute('aria-label', t('log_label'));
const cells = [];
for (let i = 0; i < 100; i++) {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'cell';
  b.dataset.index = i;
  li.append(b);
  $('log').append(li);
  cells.push({ li, b });
}
$('log').addEventListener('click', (e) => {
  const b = e.target.closest('.cell');
  if (!b || !canEdit()) return;
  const i = Number(b.dataset.index);
  const rolls = team(myTeamId).rolls;
  if (rolls[i] == null) {
    selected = null; // tapping the next empty cell just means "continue here"
  } else {
    selected = selected === i ? null : i;
  }
  render();
});

$('undo').addEventListener('click', undoLast);
$('clear-cell').addEventListener('click', clearSelected);
$('cancel-edit').addEventListener('click', () => { selected = null; render(); });
$('clear-team').addEventListener('click', () => clearTeam(shownTeamId()));
$('change-team').addEventListener('click', openPicker);
$('picker-close').addEventListener('click', () => { $('picker').hidden = true; });
$('export').addEventListener('click', exportCsv);
$('percent').addEventListener('change', (e) => { percent = e.target.checked; render(); });
$('view').addEventListener('change', (e) => { view = e.target.value; selected = null; render(); });

// Keyboard: 1–6 enter a roll, Backspace deletes, arrows move the correction cursor
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const inField = e.target instanceof Element && e.target.closest('input, select, textarea, summary');
  if (inField || !$('picker').hidden) {
    if (e.key === 'Escape' && !$('picker').hidden && myTeamId) $('picker').hidden = true;
    return;
  }
  if (!canEdit()) return;
  const rolls = team(myTeamId).rolls;
  if (/^[1-6]$/.test(e.key)) {
    e.preventDefault();
    sendRoll(Number(e.key));
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    selected != null ? clearSelected() : undoLast();
  } else if (e.key === 'Escape') {
    selected = null;
    render();
  } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    const last = lastFilled(rolls);
    if (last < 0) return;
    e.preventDefault();
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -10, ArrowDown: 10 }[e.key];
    const from = selected ?? last + (step > 0 ? -step : 0);
    selected = Math.min(last, Math.max(0, from + step));
    render();
  }
});

// ------------------------------------------------------------------ rendering

let renderTimer = null;
function scheduleRender() {
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    render();
  }, 60);
}

function render() {
  if (!state || ended) return;
  document.body.classList.remove('is-loading');

  const mode = view === 'all' ? 'all' : 'team';
  const shown = team(shownTeamId());
  if (mode === 'team' && !shown) {
    view = isTeacher || !myTeamId ? 'all' : 'mine'; // no team chosen yet: show the class view behind the picker
    return render();
  }
  $('main').dataset.mode = mode;
  document.body.classList.toggle('teacher', isTeacher);

  renderHeader();
  $('entry').hidden = mode !== 'team';
  $('qr-panel').hidden = !(isTeacher && mode === 'all');
  $('teams').hidden = mode !== 'all';

  if (mode === 'team') renderEntry(shown);
  else renderTeams();
  renderCharts(mode, shown);
  renderTimer_();
}

function renderHeader() {
  const mine = team(myTeamId);
  $('team-name').textContent = isTeacher ? t('teacher') : mine ? mine.name : '';
  $('change-team').hidden = isTeacher || !mine;

  const sel = $('view');
  const options = [];
  if (!isTeacher && mine) options.push(['mine', t('my_team', mine.name)]);
  options.push(['all', t('all_teams')]);
  for (const tm of state.teams) if (isTeacher || tm.id !== myTeamId) options.push([tm.id, tm.name]);
  const signature = options.map((o) => o.join('=')).join('|');
  if (sel.dataset.signature !== signature) {
    sel.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
    sel.dataset.signature = signature;
  }
  sel.value = view;
}

function renderEntry(tm) {
  const editable = canEdit();
  const rolls = tm.rolls;
  const n = S.countRolls(rolls);
  const last = lastFilled(rolls);
  const next = last + 1;
  if (selected != null && (selected > last || rolls[selected] == null)) selected = null;

  $('count').textContent = n;
  $('progress-fill').style.width = `${n}%`;

  $('pad').hidden = !editable;
  $('entry-actions').hidden = !editable;
  $('undo').hidden = selected != null;
  $('undo').disabled = last < 0;
  $('clear-cell').hidden = selected == null;
  $('cancel-edit').hidden = selected == null;
  $('clear-team').hidden = !(editable || (isTeacher && role === 'teacher'));
  $('clear-team').disabled = n === 0;

  const full = next >= 100 && n === 100;
  for (const key of $('pad').children) key.disabled = full && selected == null;
  $('entry-hint').textContent = !editable
    ? t('readonly_hint', tm.name)
    : selected != null
      ? t('edit_hint', selected + 1)
      : full ? t('full') : t('enter_hint');
  $('entry-hint').classList.toggle('editing', selected != null);

  // Show rows up to the one holding the next empty slot (grows 10 at a time).
  const visible = Math.min(100, Math.max(10, Math.ceil((next + 1) / 10) * 10));
  cells.forEach(({ li, b }, i) => {
    li.hidden = i >= visible;
    if (li.hidden) return;
    const v = rolls[i];
    b.textContent = v ?? '';
    b.dataset.face = v ?? '';
    b.classList.toggle('next', editable && i === next && selected == null);
    b.classList.toggle('selected', i === selected);
    b.disabled = !editable || (v == null && i !== next);
    b.setAttribute('aria-label', t('roll_cell', i + 1, v));
    b.title = `#${i + 1}`;
  });
}

function relativeTime(ts) {
  if (!ts) return t('never');
  const seconds = Math.max(0, Math.round((Date.now() + clockOffset - ts) / 1000));
  return t('ago', seconds);
}

function renderTeams() {
  const teacherControls = isTeacher && role === 'teacher';
  $('export').hidden = !isTeacher;
  document.querySelector('.team-table').classList.toggle('with-actions', teacherControls);
  const rows = state.teams.map((tm) => {
    const n = S.countRolls(tm.rolls);
    const tr = document.createElement('tr');
    if (tm.id === myTeamId) tr.className = 'mine';

    const name = document.createElement('td');
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'text-button';
    link.textContent = tm.name;
    link.addEventListener('click', () => { view = tm.id === myTeamId ? 'mine' : tm.id; render(); });
    name.append(link);

    const prog = document.createElement('td');
    prog.innerHTML = `<span class="mini-track"><span class="mini-fill" style="width:${n}%"></span></span><span class="mini-count">${n}</span>`;

    const active = document.createElement('td');
    active.textContent = relativeTime(tm.lastUpdated);
    const devices = document.createElement('td');
    devices.textContent = tm.devices;

    tr.append(name, prog, active, devices);
    if (teacherControls) {
      const act = document.createElement('td');
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger-button small';
      del.textContent = t('clear');
      del.disabled = n === 0;
      del.setAttribute('aria-label', `${t('clear')}: ${tm.name}`);
      del.addEventListener('click', () => clearTeam(tm.id));
      act.append(del);
      tr.append(act);
    }
    return tr;
  });
  $('team-rows').replaceChildren(...rows);
}

function renderCharts(mode, shown) {
  if (mode === 'team') {
    const rolls = shown.rolls;
    $('freq-title').textContent = t('freq_title', shown.name);
    $('runs-title').textContent = t('runs_title', shown.name);
    frequencyChart($('chart-freq'), S.frequencies(rolls), { percent });
    runChart($('chart-runs'), S.runLengths(rolls), S.expectedRuns(S.segmentLengths(rolls)));
    return;
  }

  $('freq-title').textContent = t('freq_title_all');
  $('runs-title').textContent = t('runs_title_all');
  const total = S.sumFrequencies(state.teams.map((tm) => S.frequencies(tm.rolls)));
  frequencyChart($('chart-freq'), total, { percent });
  // Runs are counted per team and then added: runs never cross from one team into another.
  runChart(
    $('chart-runs'),
    S.mergeCounts(state.teams.map((tm) => S.runLengths(tm.rolls))),
    S.expectedRuns(state.teams.flatMap((tm) => S.segmentLengths(tm.rolls))),
  );

}

function renderTimer_() {
  const left = state.expiresAt - (Date.now() + clockOffset);
  const minutes = Math.max(0, Math.floor(left / 60000));
  const el = $('timer');
  el.textContent = t('ends_in', Math.floor(minutes / 60), minutes % 60);
  el.classList.toggle('soon', left < 3600 * 1000);
}

setInterval(() => {
  if (!state || ended) return;
  renderTimer_();
  if (view === 'all') renderTeams();
}, 20_000);

// ------------------------------------------------------------------ team picker

function openPicker() {
  if (isTeacher || !state) return;
  const grid = $('picker-grid');
  grid.replaceChildren(
    ...state.teams.map((tm) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      if (tm.id === myTeamId) b.classList.add('current');
      const n = S.countRolls(tm.rolls);
      b.innerHTML = `<strong></strong><span>${n} / 100</span><span>${t('devices', tm.devices)}</span>`;
      b.querySelector('strong').textContent = tm.name;
      b.addEventListener('click', () => chooseTeam(tm.id));
      return b;
    }),
  );
  $('picker-close').hidden = !myTeamId;
  $('picker').hidden = false;
  document.body.classList.remove('is-loading');
  grid.querySelector('button')?.focus();
}

// ------------------------------------------------------------------ teacher: QR code

async function loadJoinInfo() {
  try {
    const [info, svg] = await Promise.all([
      fetch(`/api/sessions/${sessionId}`).then((r) => r.json()),
      fetch(`/api/sessions/${sessionId}/qr.svg`).then((r) => r.text()),
    ]);
    $('qr').innerHTML = svg; // generated by our own server
    $('join-url').textContent = info.joinUrl.replace(/^https?:\/\//, '');
    $('lan-warning').hidden = !/\/\/(localhost|127\.|\[::1\])/.test(info.joinUrl);
  } catch {
    /* the connection status already reports problems */
  }
}
if (isTeacher) loadJoinInfo();

// ------------------------------------------------------------------ misc

function showBanner(text) {
  $('banner').textContent = text;
  $('banner').hidden = false;
}
function hideBanner() {
  const text = $('banner').textContent;
  if (text === t('offline_banner') || text === t('session_full')) $('banner').hidden = true;
}

let liveTimer = null;
function announce(text) {
  $('live').textContent = text;
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => ($('live').textContent = ''), 3000);
}
