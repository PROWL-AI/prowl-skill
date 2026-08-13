#!/usr/bin/env node
'use strict';
// The adapter. Bodies here are the shapes the hosted document describes, and the two
// tool-name spellings are the two Claude Code actually produces.

const assert = require('assert');
const path = require('path');
const { it, report } = require('./_harness.js');

const adapter = require(path.join(__dirname, '..', 'plugins', 'prowl', 'lib', 'prowl.js'));

const pre = (name, id) => ({ hook_event_name: 'PreToolUse', tool_name: name, tool_use_id: id });
const post = (name, id, response) => ({
  hook_event_name: 'PostToolUse', tool_name: name, tool_use_id: id, tool_response: response,
});
const text = (obj) => ({ type: 'text', content: typeof obj === 'string' ? obj : JSON.stringify(obj) });

it('recognises a directly configured server', () => {
  assert.deepStrictEqual(adapter.parseToolName('mcp__prowl__prowl_analyze'),
    { server: 'prowl', tool: 'prowl_analyze' });
});

it('recognises the same server namespaced by the plugin', () => {
  // A plugin-bundled MCP server is exposed as mcp__plugin_<plugin>_<server>__<tool>.
  assert.deepStrictEqual(adapter.parseToolName('mcp__plugin_prowl_prowl__prowl_call_tool'),
    { server: 'plugin_prowl_prowl', tool: 'prowl_call_tool' });
});

it('does not claim somebody else\'s server', () => {
  assert.strictEqual(adapter.parseToolName('mcp__prowl-mirror__prowl_analyze'), null);
  assert.strictEqual(adapter.parseToolName('mcp__lazyweb__lazyweb_search'), null);
  assert.strictEqual(adapter.parseToolName('Bash'), null);
  assert.strictEqual(adapter.parseToolName('mcp__prowl__something_else'), null);
});

it('a non-Prowl payload classifies as nothing at all', () => {
  assert.strictEqual(adapter.classify(post('Bash', 'tu_1', text('{}'))), null);
  assert.strictEqual(adapter.classify(null), null);
  assert.strictEqual(adapter.classify({}), null);
});

it('a call with no tool_use_id is not tracked, because it could never be closed', () => {
  assert.strictEqual(adapter.classify({ hook_event_name: 'PreToolUse', tool_name: 'mcp__prowl__prowl_analyze' }), null);
});

it('PreToolUse opens', () => {
  const r = adapter.classify(pre('mcp__prowl__prowl_analyze', 'tu_1'));
  assert.strictEqual(r.kind, 'open');
  assert.strictEqual(r.short, 'analyze');
});

it('the debited amount is read, and the estimate beside it is not', () => {
  const body = { result: { rows: 3 }, billing: { estimated_cost_usd: 0.5, actual_cost_usd: 0.0125, debited: true } };
  const r = adapter.classify(post('mcp__prowl__prowl_call_tool', 'tu_2', text(body)));
  assert.strictEqual(r.usd, 0.0125);
  assert.strictEqual(r.ok, true);
});

it('a nested envelope still yields the debit', () => {
  const body = { data: { response: { billing: { actual_cost_usd: 0.44 } } } };
  assert.strictEqual(adapter.classify(post('mcp__prowl__prowl_call_tool', 'tu_3', text(body))).usd, 0.44);
});

it('a free tool moves no money', () => {
  const body = { tools: [{ name: 'a' }, { name: 'b' }] };
  assert.strictEqual(adapter.classify(post('mcp__prowl__prowl_list_tools', 'tu_4', text(body))).usd, null);
});

it('a body that is not JSON is not an error and not a zero', () => {
  const r = adapter.classify(post('mcp__prowl__prowl_call_tool', 'tu_5', text('448 tools grouped by category')));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.usd, null, 'an unreadable body must not read as free');
});

it('a progress fraction is taken from a session tool', () => {
  const body = { session_id: 'sess_x', status: 'running', progress: 0.42 };
  const r = adapter.classify(post('mcp__prowl__prowl_session_status', 'tu_6', text(body)));
  assert.strictEqual(r.progress, 0.42);
  assert.strictEqual(r.progress_session, 'sess_x');
});

it('zero progress is a real fraction, and a missing one is absent', () => {
  const zero = adapter.classify(post('mcp__prowl__prowl_session_status', 'tu_7', text({ progress: 0 })));
  assert.strictEqual(zero.progress, 0);
  const none = adapter.classify(post('mcp__prowl__prowl_session_status', 'tu_8', text({ status: 'queued' })));
  assert.strictEqual('progress' in none, false);
});

it('a fraction outside 0..1 is refused rather than clamped', () => {
  const r = adapter.classify(post('mcp__prowl__prowl_session_status', 'tu_9', text({ progress: 42 })));
  assert.strictEqual('progress' in r, false, '42 meant percent somewhere, and guessing which is how a bar lies');
});

it('a running session is not finished, and a completed one is', () => {
  const running = adapter.classify(post('mcp__prowl__prowl_session_status', 'tu_s1', text({ status: 'running', progress: 0.6 })));
  assert.strictEqual(running.finished, false);
  const done = adapter.classify(post('mcp__prowl__prowl_session_status', 'tu_s2', text({ status: 'completed', progress: 1 })));
  assert.strictEqual(done.finished, true);
  const failed = adapter.classify(post('mcp__prowl__prowl_session_status', 'tu_s3', text({ status: 'FAILED' })));
  assert.strictEqual(failed.finished, true, 'a status is matched regardless of case');
});

it('no status reported means the run says nothing about being finished', () => {
  const r = adapter.classify(post('mcp__prowl__prowl_session_status', 'tu_s4', text({ progress: 0.3 })));
  assert.strictEqual('finished' in r, false, 'absent must not read as "still running"');
});

it('progress is not read from a tool that does not report it', () => {
  const r = adapter.classify(post('mcp__prowl__prowl_call_tool', 'tu_10', text({ progress: 0.9 })));
  assert.strictEqual('progress' in r, false);
});

it('an error response is a failed call', () => {
  const r = adapter.classify(post('mcp__prowl__prowl_call_tool', 'tu_11', { type: 'error', content: 'Error: upstream timeout' }));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error.gate, false);
  assert.strictEqual(r.fingerprint, 'prowl_call_tool:error');
});

it('an in-body error counts even when the envelope says text', () => {
  const r = adapter.classify(post('mcp__prowl__prowl_analyze', 'tu_12', text({ error: 'Analysis failed — PlannerError' })));
  assert.strictEqual(r.ok, false);
});

it('a wallet block is recognised by wording', () => {
  const r = adapter.classify(post('mcp__prowl__prowl_call_tool', 'tu_13',
    { type: 'error', content: 'Insufficient balance: top up at MCP Home' }));
  assert.strictEqual(r.error.gate, true);
  assert.strictEqual(r.fingerprint, 'prowl_call_tool:wallet-gate');
});

it('a wallet block is recognised by shape when the wording changes', () => {
  const r = adapter.classify(post('mcp__prowl__prowl_analyze', 'tu_14',
    text({ isError: true, code: 'insufficient_balance', message: 'wallet gate' })));
  assert.strictEqual(r.error.gate, true);
});

it('the fingerprint ignores the volatile part of a message', () => {
  const a = adapter.classify(post('mcp__prowl__prowl_call_tool', 'x', { type: 'error', content: 'timeout req-111' }));
  const b = adapter.classify(post('mcp__prowl__prowl_call_tool', 'y', { type: 'error', content: 'timeout req-222' }));
  assert.strictEqual(a.fingerprint, b.fingerprint, 'a per-request id in the fingerprint says everything once');
});

it('classify never throws, whatever it is handed', () => {
  const nasty = [
    post('mcp__prowl__prowl_call_tool', 'z', { type: 'text', content: '{"a":' }),
    post('mcp__prowl__prowl_call_tool', 'z', { type: 'text' }),
    post('mcp__prowl__prowl_call_tool', 'z', null),
    post('mcp__prowl__prowl_call_tool', 'z', { type: 'text', content: JSON.stringify({ a: { b: { c: { d: { e: { f: { g: 1 } } } } } } }) }),
    { hook_event_name: 'PostToolUse', tool_name: 42, tool_use_id: {} },
  ];
  for (const p of nasty) assert.doesNotThrow(() => adapter.classify(p), JSON.stringify(p).slice(0, 60));
});

report('adapter');
