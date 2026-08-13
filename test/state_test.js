#!/usr/bin/env node
'use strict';
// The session file. Everything here runs against a real temporary HOME, because the
// failures worth catching — a torn document, a lost update, a leaked in-flight record
// — only exist on a filesystem.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { it, report } = require('./_harness.js');

const LIB = path.join(__dirname, '..', 'plugins', 'prowl', 'lib');
const state = require(path.join(LIB, 'state.js'));

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'prowl-state-'));
const S = 'sess-1';

it('an absent file reads as an empty state, not as an error', () => {
  const s = state.read(HOME, 'never-written');
  assert.deepStrictEqual(s.open, {});
  assert.deepStrictEqual(s.recent, []);
  assert.strictEqual(s.totals.usd, null, 'absent money must not read as zero');
});

it('a corrupt file reads as an empty state', () => {
  const f = state.fileFor(HOME, 'corrupt');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, '{ this is not json', 'utf8');
  assert.deepStrictEqual(state.read(HOME, 'corrupt').recent, []);
});

it('a session id cannot escape the status directory', () => {
  const f = state.fileFor(HOME, '../../../etc/passwd');
  assert.ok(f.startsWith(path.join(HOME, '.prowl', 'status')), f);
  assert.ok(!f.includes('..'), f);
});

it('an open call is counted by its tool_use_id', () => {
  state.openCall(HOME, S, { id: 'tu_1', tool: 'prowl_analyze', at: '2026-08-13T10:00:00.000Z' });
  state.openCall(HOME, S, { id: 'tu_2', tool: 'prowl_call_tool', at: '2026-08-13T10:00:01.000Z' });
  assert.strictEqual(Object.keys(state.read(HOME, S).open).length, 2);
});

it('closing computes the duration from the start it actually saw', () => {
  state.closeCall(HOME, S, { id: 'tu_1', ok: true, at: '2026-08-13T10:00:12.000Z' });
  const s = state.read(HOME, S);
  assert.strictEqual(Object.keys(s.open).length, 1, 'the closed call left `open`');
  assert.strictEqual(s.recent[0].ms, 12000);
  assert.strictEqual(s.recent[0].tool, 'prowl_analyze', 'the tool name came from the open record');
});

it('a close with no open records an absent duration, never a zero', () => {
  state.closeCall(HOME, S, { id: 'tu_orphan', tool: 'prowl_get_stats', ok: true });
  const last = state.read(HOME, S).recent.slice(-1)[0];
  assert.strictEqual(last.ms, null);
});

it('only money the server reported is added', () => {
  const before = state.read(HOME, S).totals.usd;
  assert.strictEqual(before, null, 'nothing billed yet must stay absent');
  state.closeCall(HOME, S, { id: 'tu_3', tool: 'prowl_call_tool', ok: true, usd: 0.0125 });
  state.closeCall(HOME, S, { id: 'tu_4', tool: 'prowl_list_tools', ok: true }); // free: no billing
  state.closeCall(HOME, S, { id: 'tu_5', tool: 'prowl_call_tool', ok: true, usd: 0.02 });
  assert.strictEqual(Number(state.read(HOME, S).totals.usd.toFixed(4)), 0.0325);
});

it('a failed call is counted as failed and kept in the ticker', () => {
  state.closeCall(HOME, S, { id: 'tu_6', tool: 'prowl_call_tool', ok: false });
  const s = state.read(HOME, S);
  assert.strictEqual(s.totals.failed, 1);
  assert.strictEqual(s.recent.slice(-1)[0].ok, false);
});

it('the ticker keeps five and drops the oldest', () => {
  const K = 'sess-trim';
  for (let i = 1; i <= 6; i += 1) {
    state.openCall(K === K ? HOME : HOME, K, { id: `t${i}`, tool: `tool_${i}` });
    state.closeCall(HOME, K, { id: `t${i}`, tool: `tool_${i}`, ok: true });
  }
  const s = state.read(HOME, K);
  assert.strictEqual(s.recent.length, 5);
  assert.strictEqual(s.recent[0].tool, 'tool_2', 'the oldest was dropped, not the newest');
  assert.strictEqual(s.totals.calls, 6, 'the ticker is trimmed; the count is not');
});

it('a progress fraction is stored only when one was reported', () => {
  const K = 'sess-progress';
  state.closeCall(HOME, K, { id: 'p1', tool: 'prowl_session_status', ok: true });
  assert.strictEqual(state.read(HOME, K).progress, null);
  state.closeCall(HOME, K, { id: 'p2', tool: 'prowl_session_status', ok: true, progress: 0.42, progress_session: 'sess_x' });
  assert.strictEqual(state.read(HOME, K).progress.value, 0.42);
});

it('the same thing is said once', () => {
  const K = 'sess-speech';
  assert.strictEqual(state.claimSpeech(HOME, K, 'err:insufficient'), true);
  assert.strictEqual(state.claimSpeech(HOME, K, 'err:insufficient'), false);
  assert.strictEqual(state.claimSpeech(HOME, K, 'err:other'), true);
});

it('concurrent writers both survive — the lost update is what the lock is for', () => {
  const K = 'sess-race';
  const N = 8;
  const script = `
    const state = require(${JSON.stringify(path.join(LIB, 'state.js'))});
    const i = process.argv[2];
    state.closeCall(${JSON.stringify(HOME)}, ${JSON.stringify(K)}, { id: 'r' + i, tool: 'prowl_call_tool', ok: true, usd: 0.01 });
  `;
  for (let i = 0; i < N; i += 1) {
    require('child_process').spawn(process.execPath, ['-e', script, String(i)], {
      stdio: 'ignore', detached: true,
    }).unref();
  }

  // Wait for the RESULT, not for the processes. A child of a blocked parent is a
  // zombie, and `kill(pid, 0)` answers "alive" for a zombie — so a pid-based join
  // waits out its whole deadline every run and adds fifteen seconds to the suite.
  const deadline = Date.now() + 15000;
  let s = state.read(HOME, K);
  while (s.totals.calls < N && Date.now() < deadline) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    s = state.read(HOME, K);
  }
  assert.strictEqual(s.totals.calls, N, `expected ${N} calls, got ${s.totals.calls} — an update was lost`);
  assert.strictEqual(Number(s.totals.usd.toFixed(4)), Number((0.01 * N).toFixed(4)));
});

it('old sessions are pruned and current ones are not', () => {
  const old = state.fileFor(HOME, 'ancient');
  fs.mkdirSync(path.dirname(old), { recursive: true });
  fs.writeFileSync(old, '{}', 'utf8');
  const past = Date.now() - 1000 * 60 * 60 * 24 * 30;
  fs.utimesSync(old, past / 1000, past / 1000);
  const removed = state.prune(HOME, Date.now(), 1000 * 60 * 60 * 24 * 7);
  assert.ok(removed >= 1, 'the ancient file survived the sweep');
  assert.ok(!fs.existsSync(old));
  assert.ok(fs.existsSync(state.fileFor(HOME, S)), 'a current session was pruned');
});

report('state');
