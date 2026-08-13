#!/usr/bin/env node
'use strict';
// The version lives in seven places. Nothing but this checks that they agree.
//
// The family this pattern comes from lost three releases to the class: a tag goes
// public, the job then fails on a manifest that disagrees, and the tag looks delivered
// while nothing shipped. The two plugins are versioned INDEPENDENTLY — `prowl` and
// `prowl-cli` ship on their own schedules — so the rule is agreement *within* a
// plugin, plus `package.json` matching the tag, which the release workflow enforces.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { it, report } = require('./_harness.js');

const ROOT = path.join(__dirname, '..');
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/** Every surface, as a list of {file, version} — read, never remembered. */
function surfaces(root) {
  const out = [{ file: 'package.json', plugin: null, version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version }];
  const plugins = fs.readdirSync(path.join(root, 'plugins'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name);
  for (const p of plugins) {
    for (const man of ['.claude-plugin', '.codex-plugin']) {
      const f = path.join('plugins', p, man, 'plugin.json');
      out.push({ file: f, plugin: p, version: JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')).version });
    }
    const skillFile = path.join('plugins', p, 'skills', p, 'SKILL.md');
    const text = fs.readFileSync(path.join(root, skillFile), 'utf8');
    const m = /^\s*version:\s*"([^"]+)"\s*$/m.exec(text.split('---')[1] || '');
    out.push({ file: skillFile, plugin: p, version: m ? m[1] : null });
  }
  return out;
}

const all = surfaces(ROOT);

it('every surface states a version at all', () => {
  const missing = all.filter((s) => !s.version);
  assert.deepStrictEqual(missing.map((s) => s.file), [],
    'a surface with no version is one the release gate cannot check');
});

it('every version is a semver', () => {
  const bad = all.filter((s) => !SEMVER.test(s.version));
  assert.deepStrictEqual(bad.map((s) => `${s.file}: ${s.version}`), []);
});

it('all seven surfaces are found — a renamed one must not vanish quietly', () => {
  assert.strictEqual(all.length, 7, all.map((s) => s.file).join(', '));
});

it('each plugin agrees with itself across its three surfaces', () => {
  const byPlugin = new Map();
  for (const s of all) {
    if (!s.plugin) continue;
    if (!byPlugin.has(s.plugin)) byPlugin.set(s.plugin, []);
    byPlugin.get(s.plugin).push(s);
  }
  assert.ok(byPlugin.size >= 2, 'expected at least two plugins');
  for (const [plugin, rows] of byPlugin) {
    assert.strictEqual(rows.length, 3, `${plugin}: expected 3 surfaces, found ${rows.length}`);
    const versions = new Set(rows.map((r) => r.version));
    assert.strictEqual(versions.size, 1,
      `${plugin} disagrees with itself: ${rows.map((r) => `${r.file}=${r.version}`).join(', ')}`);
  }
});

it('the marketplace lists every plugin directory, and no other', () => {
  const mkt = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'));
  const listed = mkt.plugins.map((p) => p.name).sort();
  const onDisk = fs.readdirSync(path.join(ROOT, 'plugins'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort();
  // A plugin shipped but undeclared is installed by nobody; declared but absent fails
  // at install time, on someone else's machine.
  assert.deepStrictEqual(listed, onDisk);
});

it('the agents marketplace lists the same set', () => {
  const mkt = JSON.parse(fs.readFileSync(path.join(ROOT, '.agents', 'plugins', 'marketplace.json'), 'utf8'));
  const listed = mkt.plugins.map((p) => p.name).sort();
  const onDisk = fs.readdirSync(path.join(ROOT, 'plugins'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort();
  assert.deepStrictEqual(listed, onDisk);
});

it('the npm package ships what the installer needs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(!pkg.private, 'a private package cannot be published, and npx cannot fetch it');
  assert.strictEqual(pkg.bin['prowl-skill'], 'bin/prowl-skill.js');
  for (const needed of ['bin', 'plugins']) {
    assert.ok(pkg.files.includes(needed), `files[] omits ${needed}, so npx would fetch an installer with nothing to install`);
  }
  assert.strictEqual(pkg.publishConfig.access, 'public', 'a scoped package defaults to restricted');
  assert.ok(fs.existsSync(path.join(ROOT, pkg.bin['prowl-skill'])));
});

it('the CHANGELOG has a section the release workflow can extract', () => {
  const text = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  // The accepting pattern the workflow uses, asserted here so a heading style change
  // fails offline instead of after the tag is already public.
  const re = new RegExp(`^## \\[?v?${pkg.version.replace(/\./g, '\\.')}\\]?`, 'm');
  assert.ok(re.test(text), `no CHANGELOG heading for ${pkg.version} — the release would tag and then fail`);
});

report('version sync');
