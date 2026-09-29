// Würfel-Experiment server: Express for pages and the REST API, `ws` for live updates.
// HTTP and WebSocket share one port; WebSockets live under the path /ws.
import express from 'express';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import helmet from 'helmet';
import proxyaddr from 'proxy-addr';
import * as S from './sessions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PLOTLY_FILE = createRequire(import.meta.url).resolve('plotly.js-strict-dist-min/plotly-strict.min.js');
// The "strict" Plotly bundle works without eval(), so the Content-Security-Policy can forbid it.

const PORT = Number(process.env.PORT) || 3000;
// Set PUBLIC_URL when the app runs behind a hosting service or reverse proxy,
// e.g. PUBLIC_URL=https://wuerfel.example.org — it is used for the join link and QR code.
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');

// Behind a reverse proxy or hosting platform, set TRUST_PROXY to the number of proxies
// in front of the app (usually 1). Only then are X-Forwarded-For / -Proto headers used;
// otherwise any client could fake its IP address and get around the rate limits.
const TRUST_PROXY = parseTrustProxy(process.env.TRUST_PROXY);

// HTTPS is enforced when the public address is https:// and the proxy is trusted
// (without a trusted proxy the app cannot tell whether a request came in over HTTPS).
const FORCE_HTTPS = PUBLIC_URL.startsWith('https://') && TRUST_PROXY !== false;

function envInt(name, def) {
  const v = Number.parseInt(process.env[name], 10);
  return Number.isFinite(v) && v > 0 ? v : def;
}

// Resource limits. Note that a whole school often shares one public IP address,
// so the per-IP limits must be generous.
const LIMITS = {
  sessions: envInt('MAX_SESSIONS', 200), // experiments running at the same time
  connections: envInt('MAX_CONNECTIONS', 3000), // WebSocket connections in total
  perSession: envInt('MAX_CONNECTIONS_PER_SESSION', 150),
  perIp: envInt('MAX_CONNECTIONS_PER_IP', 300),
  createPerMin: envInt('CREATE_LIMIT_PER_MIN', 10), // new experiments per IP and minute
};

const BROADCAST_DELAY_MS = 150; // updates are batched, never dropped
const MSG_LIMIT_PER_SEC = 30;

function parseTrustProxy(value) {
  const v = (value || '').trim();
  if (!v || v === 'false' || v === '0') return false;
  if (/^\d+$/.test(v)) return Number(v);
  if (v === 'true') {
    console.warn('TRUST_PROXY=true would trust any client-supplied header; using 1 (one proxy) instead.');
    return 1;
  }
  return v; // e.g. "loopback" or a list of proxy IP addresses
}

// ---------------------------------------------------------------- helpers

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address);
    }
  }
  return out;
}

const LOCAL_HOST = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::(\d+))?$/i;

/** Base URL that students' devices can reach. A teacher who opened the app via
 *  localhost would otherwise get a QR code pointing at localhost, which phones can't reach. */
function baseUrl(req) {
  if (PUBLIC_URL) return PUBLIC_URL;
  const host = req.get('host') || `localhost:${PORT}`;
  const m = host.match(LOCAL_HOST);
  if (m) {
    const lan = lanAddresses()[0];
    if (lan) return `http://${lan}:${m[2] || PORT}`;
  }
  return `${req.protocol}://${host}`;
}

function joinUrl(req, session) {
  return `${baseUrl(req)}/session/${session.id}`;
}

const createLog = new Map(); // ip -> timestamps of recent session creations
function allowCreate(ip) {
  const now = Date.now();
  const recent = (createLog.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= LIMITS.createPerMin) {
    createLog.set(ip, recent);
    return false;
  }
  recent.push(now);
  createLog.set(ip, recent);
  return true;
}

function notFoundPage(res) {
  res.status(404).type('html').send(`<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Würfel-Experiment</title>
<link rel="stylesheet" href="/style.css"></head><body><main class="notice">
<h1>Dieses Experiment gibt es nicht (mehr).</h1>
<p>Es ist abgelaufen oder der Server wurde neu gestartet. Scannt den aktuellen QR-Code oder fragt eure Lehrkraft nach dem neuen Link.</p>
<p lang="en">This experiment has ended or does not exist. Scan the current QR code or ask your teacher for the new link.</p>
<p><a href="/">Neues Experiment starten</a></p></main>
<footer class="site-footer"><a href="/impressum.html">Impressum</a> · <a href="/datenschutz.html">Datenschutz</a></footer></body></html>`);
}

// ---------------------------------------------------------------- HTTP

const app = express();
app.set('trust proxy', TRUST_PROXY);

// Redirect plain HTTP to HTTPS on a public server (health checks excepted).
if (FORCE_HTTPS) {
  app.use((req, res, next) => {
    if (req.secure || req.path === '/health') return next();
    res.redirect(308, PUBLIC_URL + req.originalUrl);
  });
}

const SAFE_HOST = /^[a-z0-9.-]+(:\d+)?$|^\[[0-9a-f:]+\](:\d+)?$/i;

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"], // Plotly sets inline styles
        'img-src': ["'self'", 'data:'],
        'font-src': ["'self'"],
        'connect-src': [
          "'self'",
          // explicit ws:/wss: for older Safari versions, where 'self' does not cover WebSockets
          (req) => {
            const host = req.get('host') || '';
            return SAFE_HOST.test(host) ? `${req.secure ? 'wss' : 'ws'}://${host}` : "'self'";
          },
        ],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        // Only on HTTPS: on a classroom network over plain HTTP this would break the page.
        'upgrade-insecure-requests': FORCE_HTTPS ? [] : null,
      },
    },
    strictTransportSecurity: FORCE_HTTPS ? { maxAge: 180 * 24 * 3600, includeSubDomains: false } : false,
  }),
);
app.use(express.json({ limit: '2kb' }));

// Plotly is served locally, so the app works on a network without internet access.
app.get('/vendor/plotly.min.js', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.sendFile(PLOTLY_FILE);
});

app.use(
  express.static(PUBLIC_DIR, {
    setHeaders: (res) => res.set('Cache-Control', 'no-cache'),
  }),
);

app.post('/api/sessions', async (req, res) => {
  if (!allowCreate(req.ip)) {
    return res.status(429).json({ error: 'too_many_requests' });
  }
  endExpiredSessions();
  if (S.sessionCount() >= LIMITS.sessions) {
    return res.status(503).json({ error: 'server_full' });
  }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const session = S.createSession({ teams: body.teams });
  res.status(201).json({
    sessionId: session.id,
    joinUrl: joinUrl(req, session),
    // The key is put in the URL fragment (#...), which browsers never send to the server.
    teacherUrl: `/teacher/${session.id}#key=${session.teacherKey}`,
    expiresAt: new Date(session.expiresAt).toISOString(),
  });
});

app.get('/api/sessions/:id', (req, res) => {
  const session = S.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'not_found' });
  res.set('Cache-Control', 'no-cache');
  res.json({
    sessionId: session.id,
    joinUrl: joinUrl(req, session),
    expiresAt: new Date(session.expiresAt).toISOString(),
    teams: session.teams.length,
  });
});

app.get('/api/sessions/:id/qr.svg', async (req, res) => {
  const session = S.getSession(req.params.id);
  if (!session) return res.status(404).end();
  const svg = await QRCode.toString(joinUrl(req, session), {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#1e2b4f', light: '#ffffff' },
  });
  res.set('Cache-Control', 'no-cache').type('image/svg+xml').send(svg);
});

for (const route of ['/session/:id', '/teacher/:id']) {
  app.get(route, (req, res) => {
    if (!S.getSession(req.params.id)) return notFoundPage(res);
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(PUBLIC_DIR, 'session.html'));
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()), sessions: S.sessionCount() });
});

// ---------------------------------------------------------------- WebSocket

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
const connectionsPerIp = new Map();

/** Client IP and HTTPS status of an upgrade request, using the same proxy rules as Express. */
function upgradeInfo(req) {
  const trust = app.get('trust proxy fn');
  const ip = proxyaddr(req, trust);
  let secure = Boolean(req.socket.encrypted);
  if (!secure && trust(req.socket.remoteAddress, 0)) {
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    secure = proto === 'https' || proto === 'wss';
  }
  return { ip, secure };
}

/** Browsers send an Origin header; only accept our own pages, so other websites
 *  cannot open connections through their visitors' browsers. */
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // not a browser; the connection limits still apply
  let o;
  try {
    o = new URL(origin);
  } catch {
    return false;
  }
  if (PUBLIC_URL && o.origin === new URL(PUBLIC_URL).origin) return true;
  return o.host === req.headers.host;
}

server.on('upgrade', (req, socket, head) => {
  const reject = (status, text) => {
    socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  };
  socket.on('error', () => {});
  let url;
  try {
    url = new URL(req.url, 'http://placeholder');
  } catch {
    return reject(400, 'Bad Request');
  }
  if (url.pathname !== '/ws') return reject(404, 'Not Found');

  const { ip, secure } = upgradeInfo(req);
  if (FORCE_HTTPS && !secure) return reject(403, 'Forbidden');
  if (!originAllowed(req)) return reject(403, 'Forbidden');
  if (wss.clients.size >= LIMITS.connections || (connectionsPerIp.get(ip) || 0) >= LIMITS.perIp) {
    return reject(503, 'Service Unavailable');
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.ip = ip;
    connectionsPerIp.set(ip, (connectionsPerIp.get(ip) || 0) + 1);
    ws.on('close', () => {
      const n = (connectionsPerIp.get(ip) || 1) - 1;
      if (n > 0) connectionsPerIp.set(ip, n);
      else connectionsPerIp.delete(ip);
    });
    wss.emit('connection', ws, req, S.getSession(url.searchParams.get('session')));
  });
});

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function scheduleBroadcast(session) {
  if (session.broadcastTimer) return;
  session.broadcastTimer = setTimeout(() => {
    session.broadcastTimer = null;
    const payload = JSON.stringify({ type: 'state', session: S.publicState(session) });
    for (const ws of session.clients) if (ws.readyState === ws.OPEN) ws.send(payload);
  }, BROADCAST_DELAY_MS);
}

function sameKey(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Handles one client message. Returns a result: { changed } or { error }. */
function handleMessage(ws, session, msg) {
  switch (msg.type) {
    case 'hello': {
      if (msg.role === 'teacher') {
        if (!sameKey(msg.key, session.teacherKey)) return { error: 'bad_key' };
        ws.role = 'teacher';
      }
      send(ws, { type: 'welcome', role: ws.role });
      return {};
    }
    case 'join_team': {
      if (!S.getTeam(session, msg.teamId)) return { error: 'no_team' };
      ws.teamId = msg.teamId;
      send(ws, { type: 'joined', teamId: ws.teamId });
      return { changed: true }; // device counts changed
    }
    case 'add_roll':
    case 'set_roll':
    case 'undo': {
      const team = ws.teamId && S.getTeam(session, ws.teamId);
      if (!team) return { error: 'no_team' };
      if (msg.type === 'add_roll') return result(S.addRoll(team, msg.value));
      if (msg.type === 'set_roll') return result(S.setRoll(team, msg.index, msg.value ?? null));
      return result(S.undoRoll(team));
    }
    case 'clear_team': {
      // Students clear their own team; the teacher can clear any team.
      const teamId = ws.role === 'teacher' && msg.teamId ? msg.teamId : ws.teamId;
      const team = teamId && S.getTeam(session, teamId);
      if (!team) return { error: 'no_team' };
      return result(S.clearTeam(team));
    }
    default:
      return { error: 'unknown_type' };
  }
}

function result(r) {
  return r.error ? r : { changed: true };
}

wss.on('connection', (ws, req, session) => {
  if (!session) {
    ws.close(4404, 'session_not_found');
    return;
  }
  if (session.clients.size >= LIMITS.perSession) {
    ws.close(4429, 'session_full');
    return;
  }

  ws.role = 'student';
  ws.teamId = null;
  ws.isAlive = true;
  ws.msgWindow = { start: Date.now(), count: 0 };
  session.clients.add(ws);
  send(ws, { type: 'state', session: S.publicState(session) });

  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', (data, isBinary) => {
    // simple per-connection rate limit
    const now = Date.now();
    if (now - ws.msgWindow.start > 1000) ws.msgWindow = { start: now, count: 0 };
    if (++ws.msgWindow.count > MSG_LIMIT_PER_SEC) return send(ws, { type: 'error', code: 'rate_limited' });

    if (isBinary) return send(ws, { type: 'error', code: 'bad_message' });
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return send(ws, { type: 'error', code: 'bad_message' });
    }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.type !== 'string') {
      return send(ws, { type: 'error', code: 'bad_message' });
    }
    if (!S.getSession(session.id)) return ws.close(4410, 'session_expired');

    const r = handleMessage(ws, session, msg);
    if (r.error) send(ws, { type: 'error', code: r.error, request: msg.type });
    if (r.changed) scheduleBroadcast(session);
  });

  ws.on('close', () => {
    session.clients.delete(ws);
    if (ws.teamId) scheduleBroadcast(session);
  });
  ws.on('error', () => {}); // 'close' follows; nothing else to do
});

// Drop connections that stopped answering (e.g. a phone that went to sleep).
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);

function endExpiredSessions() {
  for (const s of S.removeExpired()) {
    clearTimeout(s.broadcastTimer);
    for (const ws of s.clients) ws.close(4410, 'session_expired');
  }
}

// End expired sessions.
const cleanup = setInterval(() => {
  endExpiredSessions();
  for (const [ip, times] of createLog) if (times.every((t) => Date.now() - t > 60_000)) createLog.delete(ip);
}, 60_000);

wss.on('close', () => {
  clearInterval(heartbeat);
  clearInterval(cleanup);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} ist schon belegt – läuft der Server bereits in einem anderen Fenster?`);
    console.error(`Port ${PORT} is already in use – is the server already running in another window?`);
    console.error(`Beenden mit Ctrl+C in jenem Fenster, oder / stop it with Ctrl+C there, or: PORT=${PORT + 1} npm start`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`Würfel-Experiment läuft / is running.`);
  console.log(`  Auf diesem Rechner / on this computer:  http://localhost:${PORT}`);
  const lan = lanAddresses();
  if (PUBLIC_URL) console.log(`  Öffentliche Adresse / public URL:       ${PUBLIC_URL}`);
  for (const ip of lan) console.log(`  Im Netzwerk / on the network:           http://${ip}:${PORT}`);
  if (PUBLIC_URL.startsWith('https://') && !FORCE_HTTPS) {
    console.warn('  Warnung: PUBLIC_URL ist https://, aber TRUST_PROXY ist nicht gesetzt – HTTPS wird nicht erzwungen.');
    console.warn('  Warning: PUBLIC_URL is https:// but TRUST_PROXY is not set – HTTPS is not enforced.');
  }
  if (!lan.length && !PUBLIC_URL) {
    console.log('  Keine Netzwerkadresse gefunden – Handys können diesen Rechner nicht erreichen.');
    console.log('  No network address found – phones will not be able to reach this computer.');
  }
});

// Clean shutdown on Ctrl+C
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    wss.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  });
}
