#!/usr/bin/env node
'use strict';
/**
 * `PreToolUse` — a Prowl call started, and now something knows it.
 *
 * This hook decides nothing. It never returns a permission decision, never blocks a
 * call and never prints: an observer that can refuse is an observer somebody
 * eventually turns off. It opens one record keyed by `tool_use_id` and exits.
 *
 * The matcher in `hooks.json` is a coarse filter and is documented to be
 * best-effort; the precise question — *is this one of Prowl's tools, under either of
 * the two names it can have* — is answered by `lib/prowl.js`, which is pure and
 * fixtured. Nothing here rests on the filter being exact.
 *
 * Fails silent, always exits 0. A widget is never worth costing someone their turn.
 */

const path = require('path');
const os = require('os');

const LIB = path.join(__dirname, '..', 'lib');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  try {
    // Assert the input arrived before acting on it. A hook that received nothing has
    // observed nothing, and writing a record for it would invent one.
    if (!raw.trim().startsWith('{')) return process.exit(0);
    const data = JSON.parse(raw);

    const rec = require(path.join(LIB, 'prowl.js')).classify(data);
    if (!rec || rec.kind !== 'open') return process.exit(0);

    require(path.join(LIB, 'state.js')).openCall(os.homedir(), data.session_id, {
      id: rec.id,
      tool: rec.tool,
      at: new Date().toISOString(),
    });
  } catch (e) {
    /* Silence, deliberately: the turn matters more than the widget. */
  }
  process.exit(0);
});
