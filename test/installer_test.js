#!/usr/bin/env node
'use strict';
// The installer CLI. The parts that decide are pure and fixtured here; the parts that
// touch a machine are exercised through --dry-run, which must change nothing.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { it, report } = require('./_harness.js');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'bin', 'prowl-skill.js');
const cli = require(CLI);

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'prowl-cli-'));

function run(args, env) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { HOME, USERPROFILE: HOME }, env || {}),
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

it('--version prints the package version, and --help the verbs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.strictEqual(run(['--version']).out.trim(), pkg.version);
  const help = run(['--help']).out;
  for (const verb of ['install', 'update', 'statusline', 'token', 'status', 'plain']) {
    assert.ok(help.includes(verb), `--help omits ${verb}`);
  }
});

it('the default verb is install', () => {
  assert.strictEqual(cli.parse([]).verb, 'install');
  assert.strictEqual(cli.parse(['--dry-run']).verb, 'install');
  assert.strictEqual(cli.parse(['update']).verb, 'update');
  assert.strictEqual(cli.parse(['plain', '--force']).opts.force, true);
});

it('an unknown verb fails loudly instead of installing something', () => {
  const r = run(['instal']);
  assert.strictEqual(r.code, 2);
  assert.ok(r.out.includes('unknown command'), r.out);
});

it('a status line set by somebody else is never silently replaced', () => {
  const theirs = { statusLine: { type: 'command', command: 'node /somewhere/else.js' } };
  const plan = cli.planStatusLine(theirs, '/home/x/.prowl/prowl-statusline.js', false);
  assert.strictEqual(plan.changed, false);
  assert.ok(plan.conflict.includes('/somewhere/else.js'));
  assert.deepStrictEqual(plan.settings.statusLine, theirs.statusLine, 'the other line was modified anyway');
});

it('--force replaces it, because that is a decision somebody made out loud', () => {
  const theirs = { statusLine: { type: 'command', command: 'node /somewhere/else.js' } };
  const plan = cli.planStatusLine(theirs, '/home/x/.prowl/prowl-statusline.js', true);
  assert.strictEqual(plan.conflict, null);
  assert.ok(plan.settings.statusLine.command.includes('prowl-statusline'));
});

it('our own line is refreshed in place, and everything else is preserved', () => {
  const before = {
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node /somebody/else.js' }] }] },
    statusLine: { type: 'command', command: 'node /old/path/prowl-statusline.js' },
    env: { KEEP: 'me' },
  };
  const plan = cli.planStatusLine(before, '/new/prowl-statusline.js', false);
  assert.strictEqual(plan.conflict, null);
  assert.strictEqual(plan.changed, true);
  assert.deepStrictEqual(plan.settings.hooks, before.hooks, 'somebody else\'s hooks were touched');
  assert.deepStrictEqual(plan.settings.env, { KEEP: 'me' });
});

it('the wired line carries a refreshInterval, because the timer freezes without it', () => {
  const b = cli.statusLineBlock('/x/prowl-statusline.js');
  assert.strictEqual(b.type, 'command');
  assert.ok(b.refreshInterval >= 1, 'status-line updates go quiet while the session waits');
});

it('the key is looked for where the MCP config actually looks', () => {
  assert.strictEqual(cli.tokenSource(HOME, {}), null);
  assert.ok(cli.tokenSource(HOME, { PROWL_MCP_TOKEN: 'prowl_x' }).includes('PROWL_MCP_TOKEN'));

  const f = path.join(HOME, ...cli.TOKEN_FILE);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, 'prowl_deadbeefdeadbeefdeadbeefdeadbeef', 'utf8');
  const found = cli.tokenSource(HOME, {});
  assert.ok(found.includes(f), found);
  assert.ok(!found.includes('deadbeef'), 'the key itself was printed');
});

it('an empty token file is not a token', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'prowl-empty-'));
  const f = path.join(empty, ...cli.TOKEN_FILE);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, '   \n', 'utf8');
  assert.strictEqual(cli.tokenSource(empty, {}), null);
});

it('a malformed key is refused before it is stored', () => {
  const r = run(['token'], { PROWL_API_KEY: 'not-a-prowl-key' });
  assert.strictEqual(r.code, 2);
  assert.ok(r.out.includes('does not look like a Prowl key'), r.out);
  assert.ok(!fs.existsSync(path.join(HOME, '.prowl', 'prowl_mcp_token.bad')));
});

it('a stored key is written 600 and never echoed', () => {
  const home2 = fs.mkdtempSync(path.join(os.tmpdir(), 'prowl-tok-'));
  const key = `prowl_${'a'.repeat(32)}`;
  const r = spawnSync(process.execPath, [CLI, 'token'], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { HOME: home2, USERPROFILE: home2, PROWL_API_KEY: key }),
  });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(!`${r.stdout}${r.stderr}`.includes(key), 'the key was printed back');
  const f = path.join(home2, '.prowl', 'prowl_mcp_token');
  assert.strictEqual(fs.readFileSync(f, 'utf8'), key);
  assert.strictEqual(fs.statSync(f).mode & 0o777, 0o600);
});

it('a backup that cannot be verified is not a backup', () => {
  const f = path.join(HOME, 'settings-sample.json');
  fs.writeFileSync(f, '{"a":1}', 'utf8');
  const b = cli.backup(f);
  assert.strictEqual(b.ok, true);
  assert.strictEqual(fs.readFileSync(b.path, 'utf8'), '{"a":1}');
  // A file that does not exist needs no copy, and that is a success, not a failure.
  assert.deepStrictEqual(cli.backup(path.join(HOME, 'nothing-here.json')), { ok: true, path: null });
});

it('--dry-run changes nothing on the machine', () => {
  const before = JSON.stringify(fs.readdirSync(HOME).sort());
  const install = run(['install', '--dry-run']);
  assert.ok(install.out.includes('would run: claude plugin marketplace add'), install.out);
  const sl = run(['statusline', '--dry-run']);
  assert.ok(sl.out.includes('would set statusLine'), sl.out);
  assert.strictEqual(JSON.stringify(fs.readdirSync(HOME).sort()), before, 'a dry run touched the home directory');
});

it('plain refuses to shadow an installed plugin', () => {
  const home3 = fs.mkdtempSync(path.join(os.tmpdir(), 'prowl-shadow-'));
  fs.mkdirSync(path.join(home3, '.claude', 'plugins', 'marketplaces', cli.MARKETPLACE), { recursive: true });
  const r = spawnSync(process.execPath, [CLI, 'plain'], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { HOME: home3, USERPROFILE: home3 }),
  });
  assert.ok(r.stdout.includes('would shadow it'), r.stdout);
  assert.ok(!fs.existsSync(path.join(home3, '.claude', 'skills', 'prowl')), 'the shadowing copy was created anyway');
});

it('plain installs where there is no plugin channel', () => {
  const home4 = fs.mkdtempSync(path.join(os.tmpdir(), 'prowl-plain-'));
  const r = spawnSync(process.execPath, [CLI, 'plain'], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { HOME: home4, USERPROFILE: home4 }),
  });
  assert.strictEqual(r.status, 0, r.stderr);
  for (const p of cli.PLUGINS) {
    assert.ok(fs.existsSync(path.join(home4, '.claude', 'skills', p, 'SKILL.md')), `${p} was not copied`);
  }
  assert.ok(r.stdout.includes('no hooks'), 'the plain path must say what it does not deliver');
});

report('installer');
