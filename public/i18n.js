// All user-facing text. German is the default; add ?lang=en to any URL for English.
// The choice is remembered on the device.

const de = {
  title: 'Würfel-Experiment',
  start_lead:
    'Jedes Team würfelt 100-mal und tippt jeden Wurf ein. Alle Ergebnisse erscheinen sofort in gemeinsamen Diagrammen – für jedes Team und für die ganze Klasse.',
  teams_label: 'Anzahl Teams',
  create: 'Experiment starten',
  creating: 'Experiment wird gestartet …',
  create_failed: 'Das Experiment konnte nicht gestartet werden. Läuft der Server noch?',
  too_many: 'Zu viele neue Experimente in kurzer Zeit. Bitte eine Minute warten.',
  server_full: 'Auf dem Server laufen gerade zu viele Experimente. Bitte später noch einmal versuchen.',
  session_full: 'In diesem Experiment sind schon sehr viele Geräte. Neuer Versuch in 15 Sekunden …',
  start_note: 'Danach erscheint der QR-Code, den die Klasse scannt.',
  retention_note: 'Alle Daten eines Experiments werden 24 Stunden nach dem Start automatisch gelöscht. Sie liegen nur im Arbeitsspeicher des Servers und werden nicht dauerhaft gespeichert. Namen oder andere persönliche Angaben werden nicht erfasst.',
  imprint: 'Impressum',
  privacy: 'Datenschutz',
  join_heading: 'Mitmachen',
  join_hint: 'QR-Code scannen oder Adresse eingeben:',
  lan_warning:
    'Diese Adresse zeigt auf den eigenen Rechner (localhost). Andere Geräte erreichen sie nicht – siehe README, Abschnitt „Im Klassenraum“.',
  pick_team: 'Wählt euer Team',
  pick_team_hint: 'Beide im Team wählen dasselbe Team – dann seht ihr dieselbe Tabelle.',
  close: 'Schließen',
  devices: (n) => (n === 1 ? '1 Gerät' : `${n} Geräte`),
  view: 'Ansicht',
  my_team: (name) => `Mein Team (${name})`,
  all_teams: 'Alle Teams',
  change_team: 'Team wechseln',
  teacher: 'Lehrkraft',
  rolls: 'Würfe',
  enter_hint: 'Würfeln, dann die Augenzahl antippen. Auf der Tastatur gehen auch 1–6.',
  edit_hint: (i) => `Wurf ${i} wird korrigiert: neue Augenzahl antippen oder Feld leeren.`,
  readonly_hint: (name) => `Würfe von ${name} (nur ansehen)`,
  full: 'Alle 100 Würfe sind eingetragen.',
  undo: 'Letzten Wurf löschen',
  clear_cell: 'Feld leeren',
  cancel_edit: 'Abbrechen',
  clear_team: 'Alle Würfe löschen',
  confirm_clear: (name) => `Wirklich alle Würfe von ${name} löschen? Das lässt sich nicht rückgängig machen.`,
  pad_label: 'Augenzahl eintragen',
  log_label: 'Eingetragene Würfe',
  enter_face: (v) => `${v} eintragen`,
  roll_cell: (i, v) => (v ? `Wurf ${i}: ${v}` : `Wurf ${i}: leer`),
  entered: (i, v) => `Wurf ${i}: ${v}`,
  removed: (i) => `Wurf ${i} gelöscht`,
  freq_title: (name) => `${name}: Wie oft kam welche Zahl?`,
  freq_title_all: 'Ganze Klasse: Wie oft kam welche Zahl?',
  runs_title: (name) => `${name}: Serien gleicher Zahlen`,
  runs_title_all: 'Ganze Klasse: Serien gleicher Zahlen',
  percent: 'in Prozent',
  face_axis: 'Augenzahl',
  count_axis: 'Anzahl',
  percent_axis: 'Anteil in %',
  run_axis: 'Länge der Serie',
  runs_axis: 'Anzahl Serien',
  observed: 'Beobachtet',
  expected: 'Erwartet bei fairem Würfel',
  no_data: 'Noch keine Würfe',
  help_summary: 'Was zeigt das?',
  help_freq:
    'Jeder Kreis zeigt, wie oft eine Zahl kam. Bei einem fairen Würfel erwartet man jede Zahl in einem Sechstel der Würfe (gestrichelte Linie). Rein durch Zufall weichen die Kreise davon ab. Der Fehlerbalken zeigt die typische Zufallsschwankung (±1σ): Etwa zwei Drittel der Fehlerbalken sollten die gestrichelte Linie berühren. Liegt ein Kreis mehr als zwei Balkenlängen daneben, lohnt sich ein genauerer Blick auf den Würfel.',
  help_runs:
    'Eine Serie ist eine Folge gleicher Zahlen direkt hintereinander: 3, 3, 3 ist eine Serie der Länge 3. Die Chance, dass der nächste Wurf die Serie verlängert, ist jedes Mal 1 zu 6. Darum werden lange Serien schnell seltener – aber sie kommen vor. Die Rauten zeigen, wie viele Serien man bei einem fairen Würfel erwartet.',
  teams_heading: 'Teams',
  col_team: 'Team',
  col_progress: 'Würfe',
  col_active: 'Zuletzt',
  col_devices: 'Geräte',
  never: '–',
  ago: (s) => (s < 60 ? 'gerade eben' : s < 3600 ? `vor ${Math.floor(s / 60)} min` : `vor ${Math.floor(s / 3600)} h`),
  clear: 'Löschen',
  export_csv: 'Daten als CSV speichern',
  ends_in: (h, m) => (h > 0 ? `Endet in ${h} h ${m} min` : `Endet in ${m} min`),
  connecting: 'Verbinde …',
  online: 'Verbunden',
  offline: 'Keine Verbindung',
  offline_banner: 'Keine Verbindung zum Server. Neue Würfe werden gesendet, sobald die Verbindung wieder steht.',
  expired: 'Dieses Experiment ist beendet.',
  not_found: 'Dieses Experiment gibt es nicht (mehr).',
  ended_hint: 'Fragt eure Lehrkraft nach dem neuen QR-Code.',
  bad_key:
    'Diese Seite wurde ohne Lehrkraft-Schlüssel geöffnet. Anzeigen geht, Löschen nicht. Den vollständigen Link bekommt man nur beim Start des Experiments.',
  err_full: 'Alle 100 Würfe sind schon eingetragen.',
  err_no_team: 'Bitte zuerst ein Team wählen.',
  err_rate_limited: 'Etwas langsamer tippen, bitte.',
  err_generic: 'Das hat nicht geklappt. Bitte noch einmal versuchen.',
  language_switch: 'English',
};

const en = {
  title: 'Dice experiment',
  start_lead:
    'Every team rolls a die 100 times and enters each roll. All results appear instantly in shared charts, for each team and for the whole class.',
  teams_label: 'Number of teams',
  create: 'Start experiment',
  creating: 'Starting experiment …',
  create_failed: 'The experiment could not be started. Is the server still running?',
  too_many: 'Too many new experiments in a short time. Please wait a minute.',
  server_full: 'Too many experiments are running on the server right now. Please try again later.',
  session_full: 'This experiment already has a great many devices. Trying again in 15 seconds …',
  start_note: 'Next you will see the QR code for the class to scan.',
  retention_note: 'All data of an experiment is deleted automatically 24 hours after it was started. It is kept only in the server’s memory and never stored permanently. No names or other personal details are collected.',
  imprint: 'Legal notice (Impressum)',
  privacy: 'Privacy (Datenschutz)',
  join_heading: 'Join in',
  join_hint: 'Scan the QR code or type the address:',
  lan_warning:
    'This address points to this computer itself (localhost). Other devices cannot reach it – see the README, section “In the classroom”.',
  pick_team: 'Choose your team',
  pick_team_hint: 'Both of you pick the same team, so you share one table.',
  close: 'Close',
  devices: (n) => (n === 1 ? '1 device' : `${n} devices`),
  view: 'View',
  my_team: (name) => `My team (${name})`,
  all_teams: 'All teams',
  change_team: 'Change team',
  teacher: 'Teacher',
  rolls: 'rolls',
  enter_hint: 'Roll the die, then tap the number. Keys 1–6 work too.',
  edit_hint: (i) => `Correcting roll ${i}: tap the new number or clear the cell.`,
  readonly_hint: (name) => `Rolls of ${name} (view only)`,
  full: 'All 100 rolls are entered.',
  undo: 'Delete last roll',
  clear_cell: 'Clear cell',
  cancel_edit: 'Cancel',
  clear_team: 'Delete all rolls',
  confirm_clear: (name) => `Really delete all rolls of ${name}? This cannot be undone.`,
  pad_label: 'Enter a roll',
  log_label: 'Entered rolls',
  enter_face: (v) => `Enter ${v}`,
  roll_cell: (i, v) => (v ? `Roll ${i}: ${v}` : `Roll ${i}: empty`),
  entered: (i, v) => `Roll ${i}: ${v}`,
  removed: (i) => `Roll ${i} deleted`,
  freq_title: (name) => `${name}: How often did each number come up?`,
  freq_title_all: 'Whole class: How often did each number come up?',
  runs_title: (name) => `${name}: Runs of the same number`,
  runs_title_all: 'Whole class: Runs of the same number',
  percent: 'as percent',
  face_axis: 'Number rolled',
  count_axis: 'Count',
  percent_axis: 'Share in %',
  run_axis: 'Run length',
  runs_axis: 'Number of runs',
  observed: 'Observed',
  expected: 'Expected for a fair die',
  no_data: 'No rolls yet',
  help_summary: 'What does this show?',
  help_freq:
    'Each circle shows how often a number came up. For a fair die, each number should come up in one sixth of the rolls (dashed line). By pure chance the circles differ from that. The error bar shows the typical chance fluctuation (±1σ): about two thirds of the error bars should reach the dashed line. A circle more than two bar lengths away deserves a closer look at the die.',
  help_runs:
    'A run is a sequence of the same number in a row: 3, 3, 3 is a run of length 3. Each time, the chance that the next roll extends the run is 1 in 6. So long runs get rare quickly, but they do happen. The diamonds show how many runs a fair die should give.',
  teams_heading: 'Teams',
  col_team: 'Team',
  col_progress: 'Rolls',
  col_active: 'Last',
  col_devices: 'Devices',
  never: '–',
  ago: (s) => (s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} h ago`),
  clear: 'Delete',
  export_csv: 'Save data as CSV',
  ends_in: (h, m) => (h > 0 ? `Ends in ${h} h ${m} min` : `Ends in ${m} min`),
  connecting: 'Connecting …',
  online: 'Connected',
  offline: 'No connection',
  offline_banner: 'No connection to the server. New rolls will be sent once the connection is back.',
  expired: 'This experiment has ended.',
  not_found: 'This experiment does not exist (any more).',
  ended_hint: 'Ask your teacher for the new QR code.',
  bad_key:
    'This page was opened without the teacher key. Viewing works, deleting does not. The full link is only shown when the experiment is started.',
  err_full: 'All 100 rolls are already entered.',
  err_no_team: 'Please choose a team first.',
  err_rate_limited: 'A little slower, please.',
  err_generic: 'That did not work. Please try again.',
  language_switch: 'Deutsch',
};

const FACE_PLURAL = {
  de: ['Einsen', 'Zweien', 'Dreien', 'Vieren', 'Fünfen', 'Sechsen'],
  en: ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'],
};

function detectLang() {
  const param = new URLSearchParams(location.search).get('lang');
  try {
    if (param === 'de' || param === 'en') {
      localStorage.setItem('wx-lang', param);
      return param;
    }
    const saved = localStorage.getItem('wx-lang');
    if (saved === 'de' || saved === 'en') return saved;
  } catch {
    /* storage may be blocked */
  }
  return 'de';
}

export const lang = detectLang();
const dict = lang === 'en' ? en : de;
document.documentElement.lang = lang;

export function t(key, ...args) {
  const v = dict[key] ?? de[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}

/** Fills every element that has a data-t attribute with its text. */
export function applyStaticText(root = document) {
  for (const el of root.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
}

/** Link that reloads the page in the other language. */
export function languageLink(el) {
  const other = lang === 'de' ? 'en' : 'de';
  const url = new URL(location.href);
  url.searchParams.set('lang', other);
  el.href = url.pathname + url.search + url.hash;
  el.textContent = t('language_switch');
  el.lang = other;
}
