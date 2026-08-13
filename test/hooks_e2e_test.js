#!/usr/bin/env node
'use strict';
// End-to-end fixtures for the hook SCRIPTS and the status line.
//
// Purity is what makes `lib/` easy to test; the layer that actually runs is a process
// fed JSON on stdin by somebody else's program. So everything here runs the real
// scripts, with the real payload shapes, against a real temporary HOME — including
// the payloads nobody designs for: empty, malformed, and absent.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { it, report } = require('./_harness.js');

const PLUGIN = path.join(__dirname, '..', 'plugins', 'prowl');
const HOOKS = path.join(PLUGIN, 'hooks');
const state = require(path.join(PLUGIN, 'lib', 'state.js'));

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'prowl-e2e-'));
const ENV = Object.assign({}, process.env, { HOME, USERPROFILE: HOME });

/** Run a script the way Claude Code runs it: JSON on stdin, JSON or nothing on stdout. */
function run(script, payload, extraEnv) {
  const file = script.endsWith('statusline')
    ? path.join(PLUGIN, 'statusline', 'prowl-statusline.js')
    : path.join(HOOKS, `${script}.js`);
  const r = spawnSync(process.execPath, [file], {
    input: payload === undefined ? '' : (typeof payload === 'string' ? payload : JSON.stringify(payload)),
    encoding: 'utf8',
    env: Object.assign({}, ENV, extraEnv || {}),
  });
  assert.strictEqual(r.status, 0, `${script} exited ${r.status}: ${r.stderr}`);
  assert.strictEqual((r.stderr || '').trim(), '', `${script} wrote to stderr: ${r.stderr}`);
  return (r.stdout || '').trim();
}

const SESSION = 'e2e-session';
const pre = (tool, id) => ({
  hook_event_name: 'PreToolUse', session_id: SESSION, tool_name: tool, tool_use_id: id, cwd: HOME,
});
const post = (tool, id, response) => ({
  hook_event_name: 'PostToolUse', session_id: SESSION, tool_name: tool, tool_use_id: id,
  tool_response: response, cwd: HOME,
});
const text = (obj) => ({ type: 'text', content: JSON.stringify(obj) });

// ---------------------------------------------------------------- nothing breaks

it('no payload at all: every script exits 0 and says nothing', () => {
  for (const s of ['pre-tool-use', 'post-tool-use', 'session-start', 'statusline']) {
    assert.strictEqual(run(s, undefined), '', s);
  }
});

it('a malformed payload: every script exits 0 and says nothing', () => {
  for (const s of ['pre-tool-use', 'post-tool-use', 'session-start', 'statusline']) {
    assert.strictEqual(run(s, '{ not json at all'), '', s);
  }
});

it('an empty object: every script exits 0 and says nothing', () => {
  for (const s of ['pre-tool-use', 'post-tool-use', 'session-start', 'statusline']) {
    assert.strictEqual(run(s, {}), '', s);
  }
});

it('another server\'s tool is not this plugin\'s business', () => {
  assert.strictEqual(run('pre-tool-use', pre('mcp__lazyweb__lazyweb_search', 'x1')), '');
  assert.strictEqual(run('post-tool-use', post('Bash', 'x2', text({ billing: { actual_cost_usd: 9.99 } }))), '');
  assert.strictEqual(state.read(HOME, SESSION).totals.calls, 0, 'somebody else\'s call was recorded');
});

// ------------------------------------------------------------------ the mechanism

it('a call opens, closes, and lands in the session file with its cost', () => {
  assert.strictEqual(run('pre-tool-use', pre('mcp__prowl__prowl_call_tool', 'tu_1')), '');
  const out = run('post-tool-use', post('mcp__prowl__prowl_call_tool', 'tu_1',
    text({ result: {}, billing: { estimated_cost_usd: 0.9, actual_cost_usd: 0.0125, debited: true } })));
  assert.strictEqual(out, '', 'a successful call must not interrupt anyone');

  const s = state.read(HOME, SESSION);
  assert.strictEqual(s.totals.calls, 1);
  assert.strictEqual(s.totals.ok, 1);
  assert.strictEqual(s.totals.usd, 0.0125);
  assert.deepStrictEqual(Object.keys(s.open), [], 'the call is still marked in flight');
  assert.ok(s.recent[0].ms !== null, 'the duration was not computed from the open record');
});

it('the plugin-namespaced spelling works the same way', () => {
  run('pre-tool-use', pre('mcp__plugin_prowl_prowl__prowl_list_tools', 'tu_2'));
  run('post-tool-use', post('mcp__plugin_prowl_prowl__prowl_list_tools', 'tu_2', text({ tools: [] })));
  const s = state.read(HOME, SESSION);
  assert.strictEqual(s.totals.calls, 2);
  assert.strictEqual(s.totals.usd, 0.0125, 'a free tool moved the total');
});

it('a reported fraction becomes a taskbar bar', () => {
  const out = run('post-tool-use', post('mcp__prowl__prowl_session_status', 'tu_3',
    text({ session_id: 'sess_x', status: 'running', progress: 0.42 })));
  const parsed = JSON.parse(out);
  assert.strictEqual(parsed.terminalSequence, '\u001b]9;4;1;42\u0007');
  assert.strictEqual(parsed.systemMessage, undefined, 'progress is not worth a chat message');
});

it('a finished session takes the bar down and forgets the fraction', () => {
  const out = run('post-tool-use', post('mcp__prowl__prowl_session_status', 'tu_4',
    text({ session_id: 'sess_x', status: 'completed', progress: 1 })));
  assert.strictEqual(JSON.parse(out).terminalSequence, '\u001b]9;4;0;\u0007');
  assert.strictEqual(state.read(HOME, SESSION).progress, null);
});

it('a failed call is said once, to the operator and to the agent', () => {
  const payload = post('mcp__prowl__prowl_call_tool', 'tu_5', { type: 'error', content: 'Error: upstream timeout' });
  const first = JSON.parse(run('post-tool-use', payload));
  assert.ok(first.systemMessage.includes('failed: Error: upstream timeout'), first.systemMessage);
  assert.strictEqual(first.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.ok(first.hookSpecificOutput.additionalContext.length > 0);

  const second = run('post-tool-use', post('mcp__prowl__prowl_call_tool', 'tu_6',
    { type: 'error', content: 'Error: upstream timeout' }));
  assert.strictEqual(second, '', 'the same failure interrupted twice');
  assert.strictEqual(state.read(HOME, SESSION).totals.failed, 2, 'the second failure was not counted');
});

it('a wallet gate also pings the desktop, once', () => {
  const out = JSON.parse(run('post-tool-use', post('mcp__prowl__prowl_analyze', 'tu_7',
    { type: 'error', content: 'Insufficient balance: top up at MCP Home' })));
  assert.ok(out.systemMessage.includes('Nothing was charged'), out.systemMessage);
  assert.ok(out.terminalSequence.startsWith('\u001b]777;notify;Prowl;'), out.terminalSequence);
});

// ------------------------------------------------------------------ the status line

it('the status line renders the session, and the payload\'s own numbers', () => {
  const line = run('statusline', {
    session_id: SESSION,
    workspace: { current_dir: HOME },
    cost: { total_cost_usd: 1.2 },
    context_window: { used_percentage: 42.4 },
  }, { COLUMNS: '200' });
  assert.ok(line.startsWith('prowl'), line);
  assert.ok(line.includes('calls'), line);
  assert.ok(line.includes('claude $1.20'), line);
  assert.ok(line.includes('ctx 42%'), line);
  assert.ok(line.includes('▸'), line);
});

it('a session that never called Prowl gets no line', () => {
  assert.strictEqual(run('statusline', { session_id: 'a-session-with-no-calls' }), '');
});

it('the status line writes nothing — it only reads', () => {
  const file = state.fileFor(HOME, SESSION);
  const before = fs.readFileSync(file, 'utf8');
  run('statusline', { session_id: SESSION }, { COLUMNS: '120' });
  assert.strictEqual(fs.readFileSync(file, 'utf8'), before);
});

it('a narrow terminal still gets a line, just a shorter one', () => {
  const narrow = run('statusline', { session_id: SESSION }, { COLUMNS: '40' });
  assert.ok(narrow.length > 0);
  assert.ok(Array.from(narrow).length <= 40, `${Array.from(narrow).length} chars: ${narrow}`);
});

it('copied out of the plugin, the status line still finds its library', () => {
  // The documented installation copies this one file to a stable path, because a
  // plugin cache path carries its version and a line wired to it breaks on update.
  const copied = path.join(HOME, 'prowl-statusline.js');
  fs.copyFileSync(path.join(PLUGIN, 'statusline', 'prowl-statusline.js'), copied);
  const r = spawnSync(process.execPath, [copied], {
    input: JSON.stringify({ session_id: SESSION }),
    encoding: 'utf8',
    env: Object.assign({}, ENV, { COLUMNS: '200', PROWL_LIB: path.join(PLUGIN, 'lib') }),
  });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.trim().startsWith('prowl'), `copied script printed: ${JSON.stringify(r.stdout)}`);
});

it('with no library anywhere it prints nothing rather than a stack trace', () => {
  const orphan = path.join(HOME, 'orphan-statusline.js');
  fs.copyFileSync(path.join(PLUGIN, 'statusline', 'prowl-statusline.js'), orphan);
  const r = spawnSync(process.execPath, [orphan], {
    input: JSON.stringify({ session_id: SESSION }),
    encoding: 'utf8',
    // A HOME with no plugin cache and no override: nothing to find.
    env: { PATH: process.env.PATH, HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'prowl-empty-')) },
  });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout.trim(), '');
  assert.strictEqual((r.stderr || '').trim(), '');
});

// ----------------------------------------------------------------------- the sweep

it('SessionStart prunes what is old and keeps what is current', () => {
  const old = state.fileFor(HOME, 'ancient-session');
  fs.writeFileSync(old, '{}', 'utf8');
  const past = (Date.now() - 1000 * 60 * 60 * 24 * 30) / 1000;
  fs.utimesSync(old, past, past);

  run('session-start', { hook_event_name: 'SessionStart', session_id: 'new', startup_reason: 'startup' });

  assert.ok(!fs.existsSync(old), 'the ancient file survived');
  assert.ok(fs.existsSync(state.fileFor(HOME, SESSION)), 'a live session was pruned');
});

it('the wiring names files that exist, and nothing it cannot run', () => {
  const wiring = JSON.parse(fs.readFileSync(path.join(HOOKS, 'hooks.json'), 'utf8'));
  const events = Object.keys(wiring.hooks);
  assert.deepStrictEqual(events.sort(), ['PostToolUse', 'PreToolUse', 'SessionStart']);
  for (const event of events) {
    for (const group of wiring.hooks[event]) {
      for (const h of group.hooks) {
        const m = /\$\{CLAUDE_PLUGIN_ROOT\}\/(.*?)"/.exec(h.command);
        assert.ok(m, `${event}: command does not resolve from the plugin root: ${h.command}`);
        assert.ok(fs.existsSync(path.join(PLUGIN, m[1])), `${event}: ${m[1]} does not exist`);
        assert.ok(h.timeout > 0, `${event}: no timeout`);
      }
      // A gate would be a different kind of component. This plugin only observes.
      assert.strictEqual(group.blocking, undefined);
    }
  }
});

report('hooks e2e');
