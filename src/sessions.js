// In-memory session store. Nothing is written to disk: restarting the server ends all sessions.
import crypto from 'node:crypto';
import { isFace } from '../public/stats.js';

export const MAX_ROLLS = 100;
// Every experiment and all its data are deleted 24 hours after it was started.
export const SESSION_TTL_HOURS = 24;
export const LIMITS = {
  teams: { min: 1, max: 30, default: 20 },
};

const sessions = new Map();

// No 0/o/1/l/i: session codes are sometimes typed in by hand.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function randomCode(len) {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}

function clampInt(value, { min, max, default: def }) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export function isValidSessionId(id) {
  return typeof id === 'string' && /^[a-z0-9]{4,20}$/.test(id);
}

export function createSession(options = {}) {
  const teamCount = clampInt(options.teams, LIMITS.teams);
  let id;
  do id = randomCode(6);
  while (sessions.has(id));

  const now = Date.now();
  const session = {
    id,
    teacherKey: crypto.randomBytes(16).toString('base64url'),
    createdAt: now,
    expiresAt: now + SESSION_TTL_HOURS * 3600 * 1000,
    teams: Array.from({ length: teamCount }, (_, i) => ({
      id: `t${i + 1}`,
      name: `Team ${i + 1}`,
      rolls: new Array(MAX_ROLLS).fill(null),
      lastUpdated: null,
    })),
    clients: new Set(), // open WebSocket connections
    broadcastTimer: null,
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id) {
  if (!isValidSessionId(id)) return null;
  const s = sessions.get(id);
  if (!s) return null;
  if (Date.now() >= s.expiresAt) return null;
  return s;
}

export function getTeam(session, teamId) {
  return session.teams.find((t) => t.id === teamId) || null;
}

/** Removes expired sessions and returns them so the caller can close their connections. */
export function removeExpired(now = Date.now()) {
  const removed = [];
  for (const [id, s] of sessions) {
    if (now >= s.expiresAt) {
      sessions.delete(id);
      removed.push(s);
    }
  }
  return removed;
}

export function sessionCount() {
  return sessions.size;
}

function lastFilledIndex(rolls) {
  for (let i = rolls.length - 1; i >= 0; i--) if (rolls[i] != null) return i;
  return -1;
}

function touched(team) {
  team.lastUpdated = Date.now();
  return { ok: true };
}

// ---- Mutations. Each returns { ok: true } or { error: 'code' }. ----

/** Appends a roll after the last entered one. The server picks the slot, so two
 *  devices of the same team can enter rolls at the same time without overwriting. */
export function addRoll(team, value) {
  if (!isFace(value)) return { error: 'invalid_value' };
  const next = lastFilledIndex(team.rolls) + 1;
  if (next >= MAX_ROLLS) return { error: 'full' };
  team.rolls[next] = value;
  return touched(team);
}

/** Overwrites or clears (value = null) one slot, used for corrections. */
export function setRoll(team, index, value) {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_ROLLS) return { error: 'invalid_index' };
  if (value !== null && !isFace(value)) return { error: 'invalid_value' };
  team.rolls[index] = value;
  return touched(team);
}

/** Removes the most recently entered roll (the last filled slot). */
export function undoRoll(team) {
  const last = lastFilledIndex(team.rolls);
  if (last < 0) return { error: 'empty' };
  team.rolls[last] = null;
  return touched(team);
}

export function clearTeam(team) {
  team.rolls.fill(null);
  return touched(team);
}

/** What clients get to see: no teacher key, no socket objects. */
export function publicState(session) {
  const devices = {};
  for (const ws of session.clients) if (ws.teamId) devices[ws.teamId] = (devices[ws.teamId] || 0) + 1;
  return {
    id: session.id,
    now: Date.now(),
    expiresAt: session.expiresAt,
    maxRolls: MAX_ROLLS,
    teams: session.teams.map((t) => ({
      id: t.id,
      name: t.name,
      rolls: t.rolls,
      lastUpdated: t.lastUpdated,
      devices: devices[t.id] || 0,
    })),
  };
}
