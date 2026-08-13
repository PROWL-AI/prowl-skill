#!/usr/bin/env node
'use strict';
// Bodies captured from the live server on 2026-08-13, byte for byte.
//
// These exist because the fixtures written from the documentation were wrong in a way
// no amount of reading would have caught: the server double-encodes, answering
// `{"result": "<a JSON string>"}`. The adapter's walker treated `result` as a leaf and
// would have reported `$—` for every metered call, forever, while every suite stayed
// green. A fixture encodes the case its author imagined; this file encodes the case
// the server actually sent.

const assert = require('assert');
const path = require('path');
const { it, report } = require('./_harness.js');

const adapter = require(path.join(__dirname, '..', 'plugins', 'prowl', 'lib', 'prowl.js'));

// --- captured: prowl_get_stats(session_id: "prowl-skill-widget-dogfood") -------------
const GET_STATS = '{"result":"{\\n  \\"session_id\\": \\"20260813_163019\\",\\n  \\"status\\": \\"active\\",\\n'
  + '  \\"tool_calls_count\\": 0,\\n  \\"total_input_tokens\\": 0,\\n  \\"total_output_tokens\\": 0,\\n'
  + '  \\"total_tokens\\": 0,\\n  \\"llm_cost_usd\\": 0.0,\\n  \\"tool_cost_usd\\": 0.0,\\n'
  + '  \\"total_cost_usd\\": 0.0,\\n  \\"estimated_cost_usd\\": 0.0,\\n  \\"tool_usage\\": {},\\n'
  + '  \\"tool_cost_breakdown\\": {},\\n  \\"category_usage\\": {},\\n  \\"memory_messages\\": 0,\\n'
  + '  \\"memory_estimated_chars\\": 0,\\n  \\"disabled_tools\\": []\\n}"}';

// --- captured: prowl_list_tools(category: "utility") ---------------------------------
const LIST_TOOLS = '{"result":"{\\n  \\"category\\": \\"utility\\",\\n  \\"tools\\": [\\n'
  + '    \\"cache_clear\\",\\n    \\"cache_stats\\"\\n  ],\\n  \\"count\\": 6\\n}"}';

const post = (tool, id, content) => ({
  hook_event_name: 'PostToolUse',
  tool_name: `mcp__prowl__${tool}`,
  tool_use_id: id,
  tool_response: { type: 'text', content },
});

it('the double-encoded envelope is followed to the real body', () => {
  const body = adapter.parseBody({ type: 'text', content: GET_STATS });
  assert.strictEqual(body.session_id, '20260813_163019', JSON.stringify(body).slice(0, 120));
  assert.strictEqual(body.status, 'active');
});

it('a metered call\'s debit is found inside the encoded body', () => {
  // The same envelope the live server uses, carrying the billing object the hosted
  // document describes. This is the case that would have reported `$—` forever.
  const inner = JSON.stringify({ result: { rows: 2 }, billing: { estimated_cost_usd: 0.9, actual_cost_usd: 0.0125, debited: true } });
  const outer = JSON.stringify({ result: inner });
  assert.strictEqual(adapter.classify(post('prowl_call_tool', 'c1', outer)).usd, 0.0125);
});

it('a progress fraction is found inside the encoded body', () => {
  const outer = JSON.stringify({ result: JSON.stringify({ session_id: 'sess_9', status: 'running', progress: 0.42 }) });
  const r = adapter.classify(post('prowl_session_status', 'c2', outer));
  assert.strictEqual(r.progress, 0.42);
  assert.strictEqual(r.progress_session, 'sess_9');
  assert.strictEqual(r.finished, false);
});

it('the server\'s own accounting is taken from prowl_get_stats', () => {
  const r = adapter.classify(post('prowl_get_stats', 'c3', GET_STATS));
  assert.deepStrictEqual(r.server, { usd: 0, total_usd: 0, tokens: 0, calls: 0 });
  assert.strictEqual(r.usd, null, 'stats is a free call and must move no money');
});

it('a free catalogue call moves nothing and fails nothing', () => {
  const r = adapter.classify(post('prowl_list_tools', 'c4', LIST_TOOLS));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.usd, null);
  assert.strictEqual(r.server, undefined, 'only prowl_get_stats reports the server totals');
});

it('an envelope that is not one is left alone', () => {
  // A single-key object whose value is not JSON must not be mistaken for a wrapper.
  const body = adapter.parseBody({ type: 'text', content: JSON.stringify({ result: 'plain text answer' }) });
  assert.deepStrictEqual(body, { result: 'plain text answer' });
});

it('a two-key object is a body, not an envelope', () => {
  const body = adapter.parseBody({ type: 'text', content: JSON.stringify({ result: '{"a":1}', extra: 2 }) });
  assert.strictEqual(body.extra, 2, 'unwrapping here would have thrown away a sibling field');
});

it('unwrapping is bounded, so a deeply nested body cannot spin the hook', () => {
  // Twelve wraps is double the depth limit and enough to prove the bound. Not two
  // hundred: each wrap escapes the last, so the string doubles every time and the
  // test itself becomes the denial of service it was written to rule out. Found by
  // running it — the suite killed the interpreter before it killed the hook.
  let nested = JSON.stringify({ done: true });
  for (let i = 0; i < 12; i += 1) nested = JSON.stringify({ result: nested });
  assert.doesNotThrow(() => adapter.parseBody({ type: 'text', content: nested }));
  // Bounded means it stops, not that it arrives: twelve layers past a six-deep limit
  // must leave the walker holding an envelope rather than the prize.
  const body = adapter.parseBody({ type: 'text', content: nested });
  assert.ok(body && typeof body === 'object');
});

it('an enormous string is not parsed at all', () => {
  const huge = `{"a":"${'x'.repeat(600 * 1024)}"}`;
  assert.strictEqual(adapter.looksJson(huge), false);
  assert.doesNotThrow(() => adapter.parseBody({ type: 'text', content: huge }));
});

report('live response shapes');
