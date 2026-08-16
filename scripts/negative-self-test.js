#!/usr/bin/env node
'use strict';
/**
 * Does the suite still detect the defects it claims to detect?
 *
 * A green suite proves the code passes the tests. It does not prove the tests would
 * notice if the code stopped working — and a test that has quietly stopped testing
 * anything reports exactly the same green. So each plant below removes one guard,
 * runs the suite, and requires it to go red.
 *
 * **Every plant is anchored on the file's SHAPE and asserts that it changed
 * something.** A plant anchored on prose stops planting the moment the prose is
 * reworded, and then reports the guard it can no longer disarm as broken — which has
 * turned a whole repository's CI red for a validator that was fine.
 *
 * Restores are byte-compared, not assumed: this script rewrites source files, and a
 * failed restore would leave a disarmed guard in the tree.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const PLANTS = [
  {
    name: 'the session file loses its lock',
    file: 'plugins/prowl/lib/state.js',
    // Shape: the lock acquisition inside update(). Not a comment, not a sentence.
    apply: (t) => t.replace(/^(\s*)fs\.mkdirSync\(lock\);$/m, '$1/* planted */'),
    expect: 'concurrent writers',
  },
  {
    name: 'an absent amount starts reading as zero',
    file: 'plugins/prowl/lib/render.js',
    apply: (t) => t.replace("money(totals.usd) || '$—'", "money(totals.usd) || '$0.00'"),
    expect: 'no charge reported',
  },
  {
    name: 'the OSC allowlist stops refusing',
    file: 'plugins/prowl/lib/osc.js',
    apply: (t) => t.replace(/^function isAllowed\(seq\) \{$/m, 'function isAllowed(seq) {\n  return true;'),
    expect: 'allowlist',
  },
  {
    name: 'a fraction outside 0..1 gets clamped instead of refused',
    file: 'plugins/prowl/lib/prowl.js',
    apply: (t) => t.replace(
      'if (typeof v === \'number\' && Number.isFinite(v) && v >= 0 && v <= 1) return v;',
      'if (typeof v === \'number\' && Number.isFinite(v)) return Math.max(0, Math.min(1, v));'),
    expect: 'outside 0..1',
  },
  {
    name: 'a repeated failure stops being said once',
    file: 'plugins/prowl/lib/state.js',
    apply: (t) => t.replace('if (s.spoken.includes(fingerprint)) return s;', 'if (false) return s;'),
    expect: 'said once',
  },
  {
    // The defect the live server actually had. It shipped green through four suites
    // and would have reported `$—` for every metered call, forever.
    name: 'the double-encoded envelope stops being followed',
    file: 'plugins/prowl/lib/prowl.js',
    apply: (t) => t.replace(/^function unwrap\(node, depth\) \{$/m, 'function unwrap(node, depth) {\n  return node;'),
    expect: 'encoded body',
  },
  {
    // A plain copy beside the plugin serves its frozen version forever, and says
    // nothing while doing it. The guard against it is the whole reason `plain` is a
    // separate verb rather than the default.
    name: 'the installer stops refusing to shadow a plugin',
    file: 'bin/prowl-skill.js',
    apply: (t) => t.replace('if (installed && !opts.force) {', 'if (false) {'),
    expect: 'shadow',
  },
  {
    // The contract check's own credibility. It exists because a tool that did not
    // exist shipped in three places; on its first live run it reported the operator's
    // token FILE as an unregistered tool, on two pages that were fine. A check whose
    // findings are mostly wrong is one nobody reads, so the exclusion is guarded.
    name: 'the contract check starts calling the token file a tool',
    file: 'scripts/check-contract.js',
    apply: (t) => t.replace('/(?<![/\\w])prowl_[a-z][a-z0-9_]*\\b/g', '/prowl_[a-z][a-z0-9_]*\\b/g'),
    expect: 'token file',
  },
  {
    // The guard's guard. `ALLOWED` was re-anchored to match a claim rather than a
    // measurement, and the count check then printed OK against eight wrong files.
    name: 'the count constant stops being checked against the server',
    file: 'scripts/check-contract.js',
    apply: (t) => t.replace('if (Array.isArray(allowed) && !allowed.includes(registered)) {', 'if (false) {'),
    expect: 'the guard has a guard',
  },
  {
    // The CLI page says `prowl` constantly in prose — "the sibling `prowl` plugin" —
    // and only the fenced blocks are the command list. Widen the scan and every noun
    // after the word becomes a verb the CLI is accused of not shipping.
    name: 'the CLI check starts reading verbs out of prose',
    file: 'scripts/check-cli.js',
    apply: (t) => t.replace('for (const block of fencedBlocks(text)) {', 'for (const block of [text]) {'),
    expect: 'fenced blocks only',
  },
  {
    // A page pointing at a version npm has moved past passes every other check: the
    // surface is identical and the version is still served. Only the note catches it.
    name: 'the CLI check stops noticing a version that is no longer latest',
    file: 'scripts/check-cli.js',
    apply: (t) => t.replace('if (latest && documented !== latest) {', 'if (false) {'),
    expect: 'no longer latest',
  },
  {
    // A page describing an unpublished binary is a state of the world, not a defect,
    // and it is fatal at exactly one moment: the tag.
    name: 'an unpublished CLI stops blocking the release',
    file: 'scripts/check-cli.js',
    apply: (t) => t.replace('ok: failures.length === 0 && !strict,', 'ok: failures.length === 0,'),
    expect: 'refuse to tag ahead of the binary',
  },
  {
    // The version lives in seven places, and a release that tags one of them while
    // shipping another is the failure this check exists to make impossible.
    name: 'a plugin stops agreeing with itself about its version',
    file: 'plugins/prowl/.codex-plugin/plugin.json',
    apply: (t) => t.replace(/"version": "\d+\.\d+\.\d+"/, '"version": "99.99.99"'),
    expect: 'disagrees with itself',
  },
];

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function suite() {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'test', 'run.js')], {
    cwd: ROOT, encoding: 'utf8',
  });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}

const baseline = suite();
if (!baseline.ok) {
  process.stdout.write('FAIL: the suite is already red; a negative self-test means nothing here.\n');
  process.stdout.write(baseline.out);
  process.exit(1);
}

let failures = 0;
for (const plant of PLANTS) {
  const file = path.join(ROOT, plant.file);
  const original = fs.readFileSync(file, 'utf8');
  const before = sha(file);
  const planted = plant.apply(original);

  if (planted === original) {
    process.stdout.write(`FAIL  ${plant.name}: PLANT DID NOT LAND in ${plant.file} — re-anchor it.\n`);
    failures += 1;
    continue;
  }

  fs.writeFileSync(file, planted, 'utf8');
  const r = suite();
  fs.writeFileSync(file, original, 'utf8');

  if (sha(file) !== before) {
    process.stdout.write(`FAIL  ${plant.name}: the restore did not reproduce ${plant.file}.\n`);
    process.exit(1);
  }

  if (r.ok) {
    process.stdout.write(`FAIL  ${plant.name}: the suite stayed GREEN with the guard removed.\n`);
    failures += 1;
  } else if (!r.out.includes(plant.expect)) {
    process.stdout.write(
      `FAIL  ${plant.name}: the suite went red, but not on the check that owns this guard `
      + `(expected a failure mentioning "${plant.expect}").\n`);
    failures += 1;
  } else {
    process.stdout.write(`ok    ${plant.name}\n`);
  }
}

const after = suite();
if (!after.ok) {
  // Print what was red. Announcing damage without showing it sends the reader to
  // `npm test`, which by then is green again — and a check that cannot be reproduced
  // is a check that gets explained away.
  process.stdout.write('FAIL: the suite is red after every restore — the tree was left damaged.\n');
  process.stdout.write(after.out);
  process.exit(1);
}

if (failures) {
  process.stdout.write(`\n${failures} of ${PLANTS.length} guards did not prove themselves.\n`);
  process.exit(1);
}
process.stdout.write(`\nOK: ${PLANTS.length} guards each watched failing, and the tree restored.\n`);
