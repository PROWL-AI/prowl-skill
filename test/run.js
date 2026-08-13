#!/usr/bin/env node
'use strict';
/**
 * `npm test` — every Node suite in this directory.
 *
 * Suites are DISCOVERED, never listed. A list would have to be kept here and in the
 * CI workflow at once, and a suite added to one and forgotten in the other reports
 * green from a file nobody ran.
 *
 * `scripts/check-tool-count.js` is deliberately absent: it queries prowl.chat, and
 * `npm test` has to work offline. CI runs it as its own step.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TEST_DIR = __dirname;
const ROOT = path.resolve(TEST_DIR, '..');

const suites = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('_test.js')).sort();

if (!suites.length) {
  // An empty run is not a pass. A rename or a bad glob would otherwise turn
  // "no tests" into "all tests green".
  process.stdout.write('FAIL: no *_test.js suites found in test/\n');
  process.exit(1);
}

const failed = [];
for (const suite of suites) {
  process.stdout.write(`\n== ${suite} ==\n`);
  const r = spawnSync(process.execPath, [path.join(TEST_DIR, suite)], { stdio: 'inherit', cwd: ROOT });
  if (r.error) {
    process.stdout.write(`FAIL: ${suite} — ${r.error.message}\n`);
    failed.push(suite);
  } else if (r.status !== 0) {
    failed.push(suite);
  }
}

process.stdout.write('\n');
if (failed.length) {
  process.stdout.write(`FAIL: ${failed.length} suite(s): ${failed.join(', ')}\n`);
  process.exit(1);
}
process.stdout.write(`OK: ${suites.length} suite(s)\n`);
