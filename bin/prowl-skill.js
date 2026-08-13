#!/usr/bin/env node
'use strict';
/*
 * The Prowl plugin installer.
 *
 *   npx @prowl-ai/prowl-skill              install the plugin (and the CLI skill)
 *   npx @prowl-ai/prowl-skill update       refresh an installed copy
 *   npx @prowl-ai/prowl-skill statusline   wire the status line, with a backup taken first
 *   npx @prowl-ai/prowl-skill token        store an API key at ~/.prowl/prowl_mcp_token
 *   npx @prowl-ai/prowl-skill status       what is installed, and what is missing
 *   npx @prowl-ai/prowl-skill plain        a plain skill copy, for agents with no plugin channel
 *
 * **It installs the PLUGIN, not a copy of the skill**, and that is the one design
 * decision worth stating. The obvious shape — copy `skills/prowl/` into
 * `~/.claude/skills/` — would deliver the text and silently drop everything the text
 * is about: the hooks that make a running call visible and the MCP server that
 * answers it. Worse, a plain copy under `~/.claude/skills/<id>` **shadows** an
 * installed plugin of the same name and serves its frozen version forever.
 *
 * So `plain` exists for agents that have no plugin channel, and it refuses to run
 * where the plugin is installed unless it is forced.
 *
 * Zero dependencies, on purpose: this runs through `npx` on a machine that has agreed
 * to nothing yet.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPO = 'PROWL-AI/prowl-skill';
const MARKETPLACE = 'prowl';
const PLUGINS = ['prowl', 'prowl-cli'];
const TOKEN_FILE = ['.prowl', 'prowl_mcp_token'];

function version() {
  try {
    return require(path.join(ROOT, 'package.json')).version;
  } catch (e) {
    return 'unknown';
  }
}

function usage() {
  process.stdout.write(`prowl-skill installer v${version()}

Usage:
  npx @prowl-ai/prowl-skill [install]   add the marketplace and install the plugins
  npx @prowl-ai/prowl-skill update      refresh an installed copy
  npx @prowl-ai/prowl-skill statusline  wire the Prowl status line into ~/.claude/settings.json
  npx @prowl-ai/prowl-skill token       store an API key (reads stdin, never echoes it)
  npx @prowl-ai/prowl-skill status      report what is installed
  npx @prowl-ai/prowl-skill plain       copy the skills into ~/.claude/skills (agents without plugins)
  npx @prowl-ai/prowl-skill --help | --version

Flags: --force (overwrite), --dry-run (print the commands, change nothing)

The plugin carries the hooks and the MCP server; a plain skill copy carries neither
and shadows an installed plugin. Prefer 'install'.
`);
}

/** Is Claude Code on PATH? Its absence is a fact to report, never a crash. */
function haveClaude() {
  const r = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
}

/** Run a command, or print it under --dry-run. Returns {ok, out}. */
function run(cmd, args, opts) {
  const o = opts || {};
  if (o.dryRun) {
    process.stdout.write(`would run: ${cmd} ${args.join(' ')}\n`);
    return { ok: true, out: '', skipped: true };
  }
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  return { ok: !r.error && r.status === 0, out };
}

/**
 * The `statusLine` block this plugin wants, pointing at a stable path.
 *
 * Not at the plugin's own directory: that path carries the version, so a line wired
 * to it breaks on the next update — silently, since a status line that fails prints
 * nothing either way.
 */
function statusLineBlock(scriptPath) {
  return {
    type: 'command',
    command: `node ${JSON.stringify(scriptPath)}`,
    refreshInterval: 2,
  };
}

/**
 * Merge the block into settings, reporting what it would displace.
 *
 * Pure, so the decision is fixtured without a home directory. It never removes a
 * status line somebody else set: replacing one loses whatever it printed, and that is
 * how a person discovers their configuration changed by noticing it is gone.
 */
function planStatusLine(current, scriptPath, force) {
  const next = JSON.parse(JSON.stringify(current || {}));
  const want = statusLineBlock(scriptPath);
  const existing = next.statusLine;
  const ours = existing && typeof existing.command === 'string'
    && existing.command.includes('prowl-statusline');

  if (existing && !ours && !force) {
    return { settings: next, changed: false, conflict: existing.command || '(set)' };
  }
  next.statusLine = want;
  return { settings: next, changed: JSON.stringify(existing) !== JSON.stringify(want), conflict: null };
}

/**
 * Copy the file, read it back, and compare — a backup that was not verified is a
 * habit rather than a mechanism. A copy that cannot be taken cancels the write.
 */
function backup(file) {
  if (!fs.existsSync(file)) return { ok: true, path: null };
  const dir = path.join(os.homedir(), '.prowl', 'backups');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(dir, `${path.basename(file)}.${stamp}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(file, dest);
    if (fs.readFileSync(dest, 'utf8') !== fs.readFileSync(file, 'utf8')) {
      return { ok: false, path: null };
    }
    return { ok: true, path: dest };
  } catch (e) {
    return { ok: false, path: null };
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// --------------------------------------------------------------------- commands

function cmdInstall(opts) {
  if (!haveClaude() && !opts.dryRun) {
    process.stdout.write(
      'Claude Code is not on PATH, so the plugin channel is unavailable here.\n'
      + `Install it, or run: npx @prowl-ai/prowl-skill plain   (skills only, no hooks, no MCP)\n`);
    return 1;
  }
  const add = run('claude', ['plugin', 'marketplace', 'add', REPO], opts);
  if (!add.ok && !/already/i.test(add.out)) {
    process.stdout.write(`could not add the marketplace:\n${add.out}\n`);
    return 1;
  }
  let failed = 0;
  for (const p of PLUGINS) {
    const r = run('claude', ['plugin', 'install', `${p}@${MARKETPLACE}`], opts);
    process.stdout.write(`${r.ok ? '✔' : '✘'} ${p}@${MARKETPLACE}${r.out ? `  ${r.out.split('\n').pop()}` : ''}\n`);
    if (!r.ok) failed += 1;
  }
  if (!failed) {
    process.stdout.write(
      '\nRestart Claude Code — plugins and their hooks are read at session start.\n'
      + 'Then: npx @prowl-ai/prowl-skill token     (store your prowl_... key)\n'
      + '      npx @prowl-ai/prowl-skill statusline (optional line at the bottom)\n');
  }
  return failed ? 1 : 0;
}

function cmdUpdate(opts) {
  const m = run('claude', ['plugin', 'marketplace', 'update', MARKETPLACE], opts);
  process.stdout.write(`${m.ok ? '✔' : '✘'} marketplace ${MARKETPLACE}\n`);
  let stale = false;
  for (const p of PLUGINS) {
    const r = run('claude', ['plugin', 'update', `${p}@${MARKETPLACE}`], opts);
    process.stdout.write(`${r.ok ? '✔' : '✘'} ${p}@${MARKETPLACE}${r.out ? `  ${r.out.split('\n').pop()}` : ''}\n`);
    if (/already at the latest/i.test(r.out)) stale = true;
  }
  if (stale) {
    // Measured, not assumed: an install copies the plugin into a directory named by
    // its version, and `update` compares versions rather than contents. Same version,
    // changed source, no refresh, no warning.
    process.stdout.write(
      '\nNote: a plugin already at the advertised version is NOT re-copied, even when\n'
      + 'its source has changed. That is normal for a release; during development,\n'
      + 'reinstall instead:\n'
      + `  claude plugin uninstall prowl@${MARKETPLACE} && claude plugin install prowl@${MARKETPLACE}\n`);
  }
  return 0;
}

function cmdStatusLine(opts) {
  const home = os.homedir();
  const script = path.join(home, '.prowl', 'prowl-statusline.js');
  const src = path.join(ROOT, 'plugins', 'prowl', 'statusline', 'prowl-statusline.js');
  const settingsFile = path.join(home, '.claude', 'settings.json');

  if (opts.dryRun) {
    process.stdout.write(`would copy ${src} -> ${script}\n`);
    process.stdout.write(`would set statusLine in ${settingsFile}\n`);
    return 0;
  }

  let current = {};
  try { current = JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch (e) { current = {}; }

  const plan = planStatusLine(current, script, opts.force);
  if (plan.conflict) {
    process.stdout.write(
      `A status line is already set by something else:\n  ${plan.conflict}\n`
      + 'Replacing it would lose whatever it printed. Re-run with --force to replace it.\n');
    return 1;
  }

  const b = backup(settingsFile);
  if (!b.ok) {
    process.stdout.write('could not back up settings.json, so nothing was written.\n');
    return 1;
  }

  try {
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.copyFileSync(src, script);
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, `${JSON.stringify(plan.settings, null, 2)}\n`, 'utf8');
  } catch (e) {
    process.stdout.write(`could not write the status line: ${e.message}\n`);
    return 1;
  }

  process.stdout.write(
    `✔ status line wired${b.path ? ` (settings backed up to ${b.path})` : ''}\n`
    + '  It prints nothing until this session has called Prowl — that is the design.\n');
  return 0;
}

function cmdToken(opts) {
  const home = os.homedir();
  const file = path.join(home, ...TOKEN_FILE);
  const key = (process.env.PROWL_API_KEY || readStdin() || '').trim();

  if (!key) {
    process.stdout.write(
      'No key given. Pipe it in, so it never reaches your shell history:\n'
      + '  printf %s "prowl_YOUR_KEY" | npx @prowl-ai/prowl-skill token\n'
      + 'Generate one at https://prowl.chat -> MCP Home -> API keys & config.\n');
    return 2;
  }
  if (!/^prowl_[0-9a-f]{32}$/i.test(key)) {
    // Refuse early rather than write something that will fail at the first call with
    // a 401 nobody connects back to this moment.
    process.stdout.write('That does not look like a Prowl key (expected prowl_ + 32 hex).\n');
    return 2;
  }
  if (opts.dryRun) { process.stdout.write(`would write a key to ${file} (mode 600)\n`); return 0; }

  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, key, { encoding: 'utf8', mode: 0o600 });
    fs.chmodSync(file, 0o600);
  } catch (e) {
    process.stdout.write(`could not write ${file}: ${e.message}\n`);
    return 1;
  }
  // The key is never printed back, here or anywhere else.
  process.stdout.write(`✔ key stored at ${file} (mode 600)\n`);
  return 0;
}

function readStdin() {
  try {
    if (process.stdin.isTTY) return '';
    return fs.readFileSync(0, 'utf8');
  } catch (e) {
    return '';
  }
}

/**
 * Where the running server would find a key — in `.mcp.json`'s own order.
 *
 * Returns a description of the source, never the key. Pure enough to fixture: it is
 * given the home directory and reads the environment it was started with.
 */
function tokenSource(home, env) {
  const e = env || process.env;
  if (e.PROWL_MCP_TOKEN) return 'present (PROWL_MCP_TOKEN)';
  for (const p of [path.join(home, ...TOKEN_FILE), path.join(home, '.codex', 'prowl_mcp_token')]) {
    try { if (fs.existsSync(p) && fs.readFileSync(p, 'utf8').trim()) return `present (${p})`; } catch (err) { /* unreadable is absent */ }
  }
  return null;
}

function cmdStatus() {
  const home = os.homedir();
  const rows = [];
  rows.push(['Claude Code', haveClaude() ? 'on PATH' : 'not found']);

  // Ask the question `.mcp.json` actually asks, in its order: the env var, then this
  // plugin's file, then Codex's. Reporting "absent" for a token the server would have
  // found is worse than not reporting at all — it sends someone to re-issue a key
  // that already works.
  rows.push(['API key', tokenSource(home) || 'absent — run: npx @prowl-ai/prowl-skill token']);

  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8')); } catch (e) { /* none */ }
  const sl = settings.statusLine && settings.statusLine.command;
  rows.push(['Status line', sl ? (String(sl).includes('prowl-statusline') ? 'wired to Prowl' : 'set by something else') : 'not wired']);

  for (const p of PLUGINS) {
    const on = settings.enabledPlugins && settings.enabledPlugins[`${p}@${MARKETPLACE}`];
    rows.push([`Plugin ${p}`, on === true ? 'enabled' : on === false ? 'installed, disabled' : 'not installed']);
  }

  const statusDir = path.join(home, '.prowl', 'status');
  let sessions = 0;
  try { sessions = fs.readdirSync(statusDir).filter((f) => f.endsWith('.json')).length; } catch (e) { /* none */ }
  rows.push(['Sessions recorded', String(sessions)]);

  for (const [k, v] of rows) process.stdout.write(`${k.padEnd(19)}${v}\n`);
  return 0;
}

function cmdPlain(opts) {
  const home = os.homedir();
  let failed = 0;
  for (const p of PLUGINS) {
    const dest = path.join(home, '.claude', 'skills', p);
    const src = path.join(ROOT, 'plugins', p, 'skills', p);

    // One channel per agent. A plain copy beside an installed plugin is two listings
    // of the same skill, and the stale one wins — forever, and quietly.
    const installed = fs.existsSync(path.join(home, '.claude', 'plugins', 'marketplaces', MARKETPLACE))
      || fs.existsSync(path.join(home, '.claude', 'plugins', 'cache', MARKETPLACE, p));
    if (installed && !opts.force) {
      process.stdout.write(
        `skip: ${p} is installed as a plugin; a plain copy would shadow it and serve\n`
        + `      its frozen version forever. Update instead:\n`
        + `        npx @prowl-ai/prowl-skill update\n`
        + '      Pass --force if you really want both.\n');
      continue;
    }
    if (fs.existsSync(dest) && !opts.force) {
      process.stdout.write(`skip: ${dest} exists (pass --force to overwrite)\n`);
      continue;
    }
    if (opts.dryRun) { process.stdout.write(`would copy ${src} -> ${dest}\n`); continue; }
    try {
      fs.rmSync(dest, { recursive: true, force: true });
      copyDir(src, dest);
      process.stdout.write(`✔ ${p} -> ${dest}\n`);
    } catch (e) {
      process.stdout.write(`✘ ${p}: ${e.message}\n`);
      failed += 1;
    }
  }
  process.stdout.write('\nThe skills are text: no hooks, no status widget, no MCP server.\n');
  return failed ? 1 : 0;
}

// ------------------------------------------------------------------------- main

function parse(argv) {
  const opts = { force: argv.includes('--force'), dryRun: argv.includes('--dry-run') };
  const verb = argv.find((a) => !a.startsWith('-')) || 'install';
  return { verb, opts };
}

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) { usage(); return 0; }
  if (argv.includes('--version') || argv.includes('-v')) { process.stdout.write(`${version()}\n`); return 0; }

  const { verb, opts } = parse(argv);
  switch (verb) {
    case 'install': return cmdInstall(opts);
    case 'update': return cmdUpdate(opts);
    case 'statusline': return cmdStatusLine(opts);
    case 'token': return cmdToken(opts);
    case 'status': return cmdStatus();
    case 'plain': return cmdPlain(opts);
    default:
      process.stdout.write(`unknown command: ${verb}\n\n`);
      usage();
      return 2;
  }
}

module.exports = {
  parse, planStatusLine, statusLineBlock, backup, tokenSource, version,
  REPO, MARKETPLACE, PLUGINS, TOKEN_FILE,
};

if (require.main === module) process.exit(main(process.argv.slice(2)));
