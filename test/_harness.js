'use strict';
/**
 * The smallest thing that can report a failure honestly.
 *
 * Every suite ends with `report()`, which exits non-zero on any failure and prints
 * the count on success — a suite that passes silently is indistinguishable from a
 * suite that ran nothing.
 */

let checks = 0;
const failures = [];

function it(name, fn) {
  checks += 1;
  try {
    fn();
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

function report(label) {
  if (failures.length) {
    for (const f of failures) process.stdout.write(`FAIL  ${f}\n`);
    process.stdout.write(`\n${failures.length} failed / ${checks} checks — ${label}\n`);
    process.exit(1);
  }
  process.stdout.write(`ok  ${checks} checks — ${label}\n`);
}

module.exports = { it, report };
