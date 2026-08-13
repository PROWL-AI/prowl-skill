#!/usr/bin/env node
'use strict';
/**
 * `PostToolUse` — the call finished, and this is the only moment its cost, its
 * verdict and its progress are all knowable.
 *
 * Three channels, each used for exactly one thing:
 *
 * - **the record** — closed in the session file, which is what the status line reads.
 *   This happens on every call, and is the whole widget.
 * - **`terminalSequence`** — the dock/taskbar bar, but only from a fraction a
 *   response actually carried, and taken down when the session reports a terminal
 *   status rather than when a poll happens to end. A bar driven by elapsed time
 *   would be a guess wearing a progress bar's clothes.
 * - **`systemMessage` + `additionalContext`** — the two events worth interrupting
 *   for: a failed call and a wallet gate. Once per fingerprint, because an agent that
 *   retries a failing call five times must not produce five notices. The agent gets
 *   the context so it stops retrying; the operator gets the message.
 *
 * `tool_response` arrives as `{type, content}` with `content` a **string**, so every
 * number here is parsed out of text by `lib/prowl.js` and is absent when the text did
 * not contain it. Absent is never zero.
 *
 * Fails silent, always exits 0.
 */

const path = require('path');
const os = require('os');

const LIB = path.join(__dirname, '..', 'lib');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  try {
    if (!raw.trim().startsWith('{')) return process.exit(0);
    const data = JSON.parse(raw);

    const prowl = require(path.join(LIB, 'prowl.js'));
    const rec = prowl.classify(data);
    if (!rec || rec.kind !== 'close') return process.exit(0);

    const state = require(path.join(LIB, 'state.js'));
    const render = require(path.join(LIB, 'render.js'));
    const osc = require(path.join(LIB, 'osc.js'));

    const home = os.homedir();
    const session = data.session_id;

    state.closeCall(home, session, {
      id: rec.id,
      tool: rec.tool,
      ok: rec.ok,
      usd: rec.usd,
      progress: typeof rec.progress === 'number' ? rec.progress : undefined,
      progress_session: rec.progress_session,
      at: new Date().toISOString(),
    });

    const out = {};
    const sequences = [];

    if (rec.finished === true) {
      sequences.push(osc.progressClear());
      // The fraction described a session that has ended; keeping it would leave the
      // status line reporting progress for something finished.
      state.update(home, session, (s) => { s.progress = null; return s; });
    } else if (typeof rec.progress === 'number') {
      sequences.push(osc.progress(rec.progress));
    }

    if (!rec.ok && rec.error) {
      // Once per fingerprint, and the claim is taken in the same write that answers,
      // so two calls failing at once cannot both be told they are the first.
      if (state.claimSpeech(home, session, rec.fingerprint)) {
        const notice = render.block(rec);
        if (notice) {
          out.systemMessage = notice;
          out.hookSpecificOutput = { hookEventName: 'PostToolUse', additionalContext: notice };
        }
        if (rec.error.gate) sequences.push(osc.notify('Prowl', rec.error.message));
      }
    }

    const seq = sequences.filter(Boolean).join('');
    if (seq && osc.isAllowed(seq)) out.terminalSequence = seq;

    if (Object.keys(out).length) process.stdout.write(`${JSON.stringify(out)}\n`);
  } catch (e) {
    /* Silence, deliberately. */
  }
  process.exit(0);
});
