#!/usr/bin/env node
'use strict';
/**
 * The bottom line — where a Prowl call is, without asking.
 *
 * **Opt-in, and it has to be.** `statusLine` is not a field any plugin manifest can
 * declare, so a plugin cannot ship one; the operator wires this script themselves,
 * with one command, and can unwire it with one. That is a worse installation story
 * than the hooks have and a better one than writing into somebody's settings
 * uninvited.
 *
 * It reads two things and prints one line:
 *
 * - the session file, found by the `session_id` in its own payload. The status-line
 *   reference prescribes exactly this: a pid changes on every invocation and defeats
 *   any cache keyed by it.
 * - `cost` and `context_window` from that payload, which exist in **no** hook event.
 *   This is the only component that can show what the session has spent on the model
 *   and how much of the window it has eaten, which is why they are shown here and
 *   nowhere else rather than estimated somewhere convenient.
 *
 * It runs on every render, so it does the least possible: read one small JSON file,
 * format, write. Nothing is computed that was not already recorded, and nothing is
 * written at all.
 *
 * Prints nothing when there is nothing to say. An empty status line is the honest
 * rendering of "this session has not called Prowl", and better than a line that says
 * `0 calls` in a repository where the plugin was never used.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

/**
 * Where `lib/` is, from wherever this file was run.
 *
 * Beside the plugin it is one directory up. But the documented installation copies
 * this single file somewhere stable — because a plugin's cache path carries its
 * version, and a status line wired to it breaks on the next update — and from there
 * `../lib` is somebody's home directory. So the sibling is tried, then an explicit
 * override, then the plugin is looked up where plugins live.
 *
 * Returns `null` rather than throwing. A status line that cannot find its library
 * prints nothing, which is the same thing it prints when there is no Prowl call to
 * report — and far better than a stack trace under the prompt.
 */
function resolveLib() {
  const candidates = [
    path.join(__dirname, '..', 'lib'),
    process.env.PROWL_LIB || '',
  ].filter(Boolean);

  const plugins = path.join(os.homedir(), '.claude', 'plugins');
  // Bounded, breadth-first, and it stops at the first hit: a full walk of a plugin
  // cache on every status-line render would be a widget that costs a frame.
  const roots = [path.join(plugins, 'cache'), path.join(plugins, 'marketplaces')];
  for (const root of roots) {
    try {
      for (const owner of fs.readdirSync(root)) {
        for (const name of fs.readdirSync(path.join(root, owner))) {
          if (!/prowl/i.test(name) && !/prowl/i.test(owner)) continue;
          const dir = path.join(root, owner, name);
          for (const version of fs.readdirSync(dir)) {
            candidates.push(path.join(dir, version, 'lib'));
          }
        }
      }
    } catch (e) { /* no such directory is the normal case on most machines */ }
  }

  for (const c of candidates) {
    try {
      if (fs.existsSync(path.join(c, 'state.js')) && fs.existsSync(path.join(c, 'render.js'))) return c;
    } catch (e) { /* keep looking */ }
  }
  return null;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  try {
    const data = raw.trim().startsWith('{') ? JSON.parse(raw) : {};

    const LIB = resolveLib();
    if (!LIB) return process.exit(0);

    const state = require(path.join(LIB, 'state.js'));
    const render = require(path.join(LIB, 'render.js'));

    const line = render.line(state.read(os.homedir(), data.session_id), {
      now: Date.now(),
      cost: data.cost,
      context: data.context_window,
      // Claude Code sets COLUMNS before running the script; `tput cols` cannot work
      // here because the output is captured rather than attached to the terminal.
      columns: Number(process.env.COLUMNS) || null,
    });

    if (line) process.stdout.write(`${line}\n`);
  } catch (e) {
    /* A status line that throws would paint a stack trace under the prompt. */
  }
  process.exit(0);
});
