'use strict';
/**
 * What this session has asked Prowl to do, kept where the next hook can read it.
 *
 * `PreToolUse` sees a call start; `PostToolUse` sees it finish several seconds later,
 * in a different process; the status line renders it in a third. Nothing in a hook
 * payload carries state between them, so it goes through a file keyed by session.
 *
 * **`~/.prowl/` and not the project tree.** The token file already lives there — this
 * plugin has one home on the machine. A file under the repository would be committed
 * by someone eventually, and a file under `/tmp` would vanish mid-session.
 *
 * **Keyed by `session_id`.** Not by pid: the status-line reference is explicit that a
 * pid changes on every invocation and defeats exactly this kind of cache.
 *
 * Nothing here throws. A hook that raises breaks the operator's turn for a widget,
 * which is a bad trade in every direction; an unreadable file is an empty state, and
 * a write that cannot happen is a widget that says less rather than a turn that dies.
 */

const fs = require('fs');
const path = require('path');

/** Where a session's file lives, relative to home. */
const DIR = ['.prowl', 'status'];

/** How many finished calls the ticker remembers. The array IS the display rule. */
const RECENT = 5;

/** How long a lock may be held before it is assumed dead. Hooks are short. */
const LOCK_STALE_MS = 5000;

/** The canonical empty state. Every absent field is absent, never zero. */
function empty(sessionId) {
  return {
    session_id: sessionId || null,
    updated_at: null,
    open: {},
    recent: [],
    totals: { calls: 0, ok: 0, failed: 0, usd: null },
    progress: null,
    server: null,
    spoken: [],
  };
}

/**
 * A session id becomes a filename, so nothing in it may be a path.
 *
 * Separators first, then every run of dots: while they are still separators, `..` is
 * still recognisable as a traversal.
 */
function fileFor(home, sessionId) {
  const key = String(sessionId || 'unknown')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/^[._]+/, '')
    .slice(0, 80);
  return path.join(home, ...DIR, `${key || 'unknown'}.json`);
}

/** The recorded state, or an empty one. An unparsable file is an empty one. */
function read(home, sessionId) {
  try {
    const raw = fs.readFileSync(fileFor(home, sessionId), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return empty(sessionId);
    // A file written by an older shape must not make today's renderer throw.
    return Object.assign(empty(sessionId), parsed);
  } catch (e) {
    return empty(sessionId);
  }
}

/**
 * Write, atomically.
 *
 * A temporary file in the same directory and then `rename`, because a reader that
 * arrives mid-write must see the old document or the new one and never half of
 * either. The temp name carries the pid so two writers cannot collide on it.
 */
function writeAtomic(file, state) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state), 'utf8');
    fs.renameSync(tmp, file);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Run `fn(state)` under a lock and persist what it returns.
 *
 * `rename` alone stops a torn document; it does not stop a lost update, and two calls
 * finishing in the same instant is the normal case for an agent that batches tool
 * calls. `mkdir` is the atomic primitive available everywhere, so it is the lock.
 *
 * **The lock is never allowed to cost a turn.** After roughly fifty milliseconds the
 * update proceeds unlocked: a widget that occasionally loses one record is better
 * than a hook that hangs, and a stale lock left by a killed process is cleared by age
 * rather than by an operator.
 */
function update(home, sessionId, fn) {
  const file = fileFor(home, sessionId);
  const lock = `${file}.lock`;
  let held = false;
  for (let i = 0; i < 50; i += 1) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.mkdirSync(lock);
      held = true;
      break;
    } catch (e) {
      try {
        const age = Date.now() - fs.statSync(lock).mtimeMs;
        if (age > LOCK_STALE_MS) { fs.rmdirSync(lock); continue; }
      } catch (e2) { /* it went away between the two calls, which is fine */ }
      // Busy-wait one millisecond. `Atomics.wait` is the only synchronous sleep a
      // hook can use, and a hook is synchronous by construction.
      try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1); } catch (e3) { /* no SAB */ }
    }
  }
  let next;
  try {
    next = fn(read(home, sessionId));
  } catch (e) {
    next = null;
  }
  let ok = false;
  if (next) {
    next.updated_at = next.updated_at || new Date().toISOString();
    ok = writeAtomic(file, next);
  }
  if (held) { try { fs.rmdirSync(lock); } catch (e) { /* already gone */ } }
  return ok ? next : null;
}

/** A call started. Keyed by `tool_use_id`, so the in-flight count counts calls. */
function openCall(home, sessionId, rec) {
  if (!rec || !rec.id) return null;
  return update(home, sessionId, (s) => {
    s.session_id = s.session_id || sessionId || null;
    s.open[rec.id] = { tool: rec.tool || null, at: rec.at || new Date().toISOString() };
    s.updated_at = rec.at || new Date().toISOString();
    return s;
  });
}

/**
 * A call finished.
 *
 * `ms` is computed only when the start was seen. A plugin installed mid-session, or a
 * session resumed across a restart, produces a close with no open — and the duration
 * is then **absent**, never zero. `usd` is added only when the response carried one;
 * a free tool must not drag the total to a number the server never said.
 */
function closeCall(home, sessionId, rec) {
  if (!rec || !rec.id) return null;
  return update(home, sessionId, (s) => {
    const started = s.open[rec.id];
    delete s.open[rec.id];
    const at = rec.at || new Date().toISOString();
    const ms = started && started.at ? Math.max(0, Date.parse(at) - Date.parse(started.at)) : null;
    const entry = {
      tool: rec.tool || (started && started.tool) || null,
      ok: rec.ok !== false,
      ms: Number.isFinite(ms) ? ms : null,
      usd: typeof rec.usd === 'number' && Number.isFinite(rec.usd) ? rec.usd : null,
      at,
    };
    s.recent.push(entry);
    while (s.recent.length > RECENT) s.recent.shift();
    s.totals.calls += 1;
    if (entry.ok) s.totals.ok += 1; else s.totals.failed += 1;
    if (entry.usd !== null) s.totals.usd = (s.totals.usd === null ? 0 : s.totals.usd) + entry.usd;
    if (typeof rec.progress === 'number') {
      s.progress = { session_id: rec.progress_session || null, value: rec.progress, at };
    }
    // The server's own accounting, when it volunteered it. Kept beside the sum rather
    // than folded into it: two figures that disagree are a fact worth keeping.
    if (rec.server && typeof rec.server === 'object') s.server = Object.assign({ at }, rec.server);
    s.updated_at = at;
    return s;
  });
}

/**
 * Has this exact thing already been said?
 *
 * Returns `true` the first time a fingerprint is seen and `false` afterwards, so a
 * failing call that the agent retries five times interrupts once. The fingerprint is
 * recorded by the same write that answers, because two hooks asking at once must not
 * both be told "first".
 */
function claimSpeech(home, sessionId, fingerprint) {
  if (!fingerprint) return false;
  let first = false;
  update(home, sessionId, (s) => {
    if (s.spoken.includes(fingerprint)) return s;
    first = true;
    s.spoken.push(fingerprint);
    while (s.spoken.length > 50) s.spoken.shift();
    return s;
  });
  return first;
}

/**
 * Delete session files older than `maxAgeMs`.
 *
 * Without it this directory grows one small file per session forever — the kind of
 * litter nobody notices until it is thousands of files.
 */
function prune(home, nowMs, maxAgeMs) {
  const dir = path.join(home, ...DIR);
  let removed = 0;
  try {
    for (const name of fs.readdirSync(dir)) {
      const f = path.join(dir, name);
      try {
        if (nowMs - fs.statSync(f).mtimeMs > maxAgeMs) {
          if (fs.statSync(f).isDirectory()) fs.rmdirSync(f); else fs.unlinkSync(f);
          removed += 1;
        }
      } catch (e) { /* a file that vanished mid-sweep needed no pruning */ }
    }
  } catch (e) { /* nothing to prune is the normal case */ }
  return removed;
}

module.exports = {
  empty, fileFor, read, update, openCall, closeCall, claimSpeech, prune,
  DIR, RECENT, LOCK_STALE_MS,
};
