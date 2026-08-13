#!/usr/bin/env node
'use strict';
// The renderer and the sequences. The cases that matter are the ones where a zero and
// an absence would look alike, and the one where a fraction becomes a bar.

const assert = require('assert');
const path = require('path');
const { it, report } = require('./_harness.js');

const LIB = path.join(__dirname, '..', 'plugins', 'prowl', 'lib');
const render = require(path.join(LIB, 'render.js'));
const osc = require(path.join(LIB, 'osc.js'));
const state = require(path.join(LIB, 'state.js'));

const NOW = Date.parse('2026-08-13T10:01:12.000Z');

function seeded(patch) {
  return Object.assign(state.empty('s'), patch);
}

it('a session that never called Prowl renders nothing', () => {
  assert.strictEqual(render.line(state.empty('s'), { now: NOW }), '');
  assert.strictEqual(render.line(null, {}), '');
  assert.strictEqual(render.line(undefined, undefined), '');
});

it('a call in flight is named, with how long it has been running', () => {
  const s = seeded({ open: { tu_1: { tool: 'prowl_analyze', at: '2026-08-13T10:00:00.000Z' } } });
  assert.strictEqual(render.line(s, { now: NOW }), 'prowl · ⟳ analyze 1:12');
});

it('more than one in flight says so without listing them all', () => {
  const s = seeded({
    open: {
      tu_1: { tool: 'prowl_analyze', at: '2026-08-13T10:00:00.000Z' },
      tu_2: { tool: 'prowl_call_tool', at: '2026-08-13T10:00:30.000Z' },
    },
  });
  assert.strictEqual(render.line(s, { now: NOW }), 'prowl · ⟳ analyze 1:12 +1');
});

it('no charge reported is not the same as charged nothing', () => {
  const unbilled = seeded({ totals: { calls: 2, ok: 2, failed: 0, usd: null }, recent: [] });
  const free = seeded({ totals: { calls: 2, ok: 2, failed: 0, usd: 0 }, recent: [] });
  assert.ok(render.line(unbilled, { now: NOW }).includes('$—'), render.line(unbilled, { now: NOW }));
  assert.ok(render.line(free, { now: NOW }).includes('$0.00'), render.line(free, { now: NOW }));
});

it('a sub-cent debit is not rounded away to zero', () => {
  assert.strictEqual(render.money(0.0025), '$0.0025');
  assert.strictEqual(render.money(0.31), '$0.31');
  assert.strictEqual(render.money(0), '$0.00');
  assert.strictEqual(render.money(null), null);
});

it('failures are shown, and a clean run is not padded with a zero', () => {
  const clean = seeded({ totals: { calls: 3, ok: 3, failed: 0, usd: 0.1 } });
  const dirty = seeded({ totals: { calls: 3, ok: 2, failed: 1, usd: 0.1 } });
  assert.ok(render.line(clean, { now: NOW }).includes('3 calls 3✓'));
  assert.ok(!render.line(clean, { now: NOW }).includes('✗'));
  assert.ok(render.line(dirty, { now: NOW }).includes('3 calls 2✓ 1✗'));
});

it('the ticker shows the newest first', () => {
  const s = seeded({
    totals: { calls: 3, ok: 2, failed: 1, usd: 0.1 },
    recent: [
      { tool: 'prowl_search_tools', ok: true },
      { tool: 'prowl_call_tool', ok: false },
      { tool: 'prowl_tool_info', ok: true },
    ],
  });
  assert.strictEqual(render.ticker(s), 'tool_info✓ call_tool✗ search_tools✓');
});

it('tokens appear only when the payload carried them', () => {
  const s = seeded({ totals: { calls: 1, ok: 1, failed: 0, usd: 0.1 } });
  assert.ok(!render.line(s, { now: NOW }).includes('ctx'));
  assert.ok(render.line(s, { now: NOW, context: { used_percentage: 42.4 } }).includes('ctx 42%'));
});

it('the two costs are never confused for each other', () => {
  const s = seeded({ totals: { calls: 1, ok: 1, failed: 0, usd: 0.31 } });
  const out = render.line(s, { now: NOW, cost: { total_cost_usd: 1.2 } });
  assert.ok(out.includes('$0.31'), out);
  assert.ok(out.includes('claude $1.20'), out);
});

it('a narrow terminal sheds the ticker before it sheds the counts', () => {
  const s = seeded({
    totals: { calls: 3, ok: 3, failed: 0, usd: 0.31 },
    recent: [{ tool: 'prowl_call_tool', ok: true }, { tool: 'prowl_tool_info', ok: true }],
  });
  const wide = render.line(s, { now: NOW, columns: 200 });
  const narrow = render.line(s, { now: NOW, columns: 30 });
  assert.ok(wide.includes('▸'), wide);
  assert.ok(!narrow.includes('▸'), narrow);
  assert.ok(narrow.includes('3 calls'), narrow);
});

it('the server\'s own figure wins, and says that it is the server\'s', () => {
  const s = seeded({
    totals: { calls: 4, ok: 4, failed: 0, usd: 0.02 },
    server: { usd: 0.0325, total_usd: 0.0325, tokens: 1200, calls: 4 },
  });
  const out = render.line(s, { now: NOW });
  assert.ok(out.includes('$0.0325 billed'), out);
  assert.ok(!out.includes('$0.02'), `the observed sum was shown as if it were authoritative: ${out}`);
});

it('with no server figure the observed sum is shown plainly', () => {
  const s = seeded({ totals: { calls: 4, ok: 4, failed: 0, usd: 0.02 } });
  const out = render.line(s, { now: NOW });
  assert.ok(out.includes('$0.02'), out);
  assert.ok(!out.includes('billed'), `an observed sum must not claim to be billed: ${out}`);
});

it('a reported fraction is shown as progress', () => {
  const s = seeded({ totals: { calls: 1, ok: 1, failed: 0, usd: null }, progress: { value: 0.42 } });
  assert.ok(render.line(s, { now: NOW }).includes('42% done'));
});

it('a fraction becomes a taskbar bar, and no fraction becomes no sequence', () => {
  assert.strictEqual(osc.progress(0.42), '\u001b]9;4;1;42\u0007');
  assert.strictEqual(osc.progress(0), '\u001b]9;4;1;0\u0007');
  assert.strictEqual(osc.progress(42), '', 'a value outside 0..1 must be refused, not clamped');
  assert.strictEqual(osc.progress(null), '');
  assert.strictEqual(osc.progress(undefined), '');
});

it('a sequence outside the allowlist is refused rather than emitted', () => {
  assert.strictEqual(osc.isAllowed('\u001b]9;4;1;42\u0007'), true);
  assert.strictEqual(osc.isAllowed('\u001b]8;;https://example.com\u0007'), false, 'OSC 8 is dropped by Claude Code');
  assert.strictEqual(osc.isAllowed(''), false);
  // Concatenation: every sequence is validated, not the first.
  assert.strictEqual(osc.isAllowed('\u001b]9;4;1;42\u0007\u001b]8;;x\u0007'), false);
  assert.strictEqual(osc.isAllowed(osc.progress(0.5) + osc.notify('Prowl', 'x')), true);
});

it('server text cannot break out of a notification', () => {
  const seq = osc.notify('Prowl', 'balance is 0; \u001b]0;pwned\u0007 top up');
  assert.ok(!seq.includes('pwned;'), seq);
  assert.strictEqual((seq.match(/\u0007/g) || []).length, 1, 'the payload closed the sequence early');
  assert.ok(osc.isAllowed(seq));
});

it('the chat notice fires for a failure and stays silent for success', () => {
  assert.strictEqual(render.block({ ok: true, tool: 'prowl_call_tool' }), '');
  assert.strictEqual(render.block(null), '');
  const failed = render.block({ ok: false, tool: 'prowl_call_tool', error: { gate: false, message: 'upstream timeout' } });
  assert.ok(failed.includes('`call_tool` failed: upstream timeout'), failed);
});

it('the wallet gate names the remedy and says nothing was charged', () => {
  const gate = render.block({ ok: false, tool: 'prowl_analyze', error: { gate: true, message: 'Insufficient balance' } });
  assert.ok(gate.includes('Nothing was charged'), gate);
  assert.ok(gate.includes('prowl.chat'), gate);
  assert.ok(gate.includes('prowl_list_tools'), gate);
});

report('render + osc');
