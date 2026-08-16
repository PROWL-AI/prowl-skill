#!/usr/bin/env node
'use strict';
// The evals, checked for shape and nothing more.
//
// This file cannot tell you the skills pass. There is no runner, the queries go to a
// model, and a suite that claimed otherwise would be the most expensive lie in the
// repository — a green that reads as "the skills behave" while nobody has watched them
// behave. What it does check is that the data is worth running: that the negatives are
// really half the set, that the split is fixed, that no fixture would ship as a real
// skill. See test/evals/README.md, which says the same thing in the place a person
// looks first.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { it, report } = require('./_harness.js');

const DIR = path.join(__dirname, 'evals');
const triggers = JSON.parse(fs.readFileSync(path.join(DIR, 'triggers.json'), 'utf8'));
const scenarios = JSON.parse(fs.readFileSync(path.join(DIR, 'scenarios.json'), 'utf8'));
const SKILLS = ['prowl', 'prowl-cli'];

it('every skill this repository ships has scenarios', () => {
  // A skill with no scenario is a skill nobody has described the correct behaviour of.
  for (const s of SKILLS) {
    const mine = scenarios.scenarios.filter((x) => x.skills.includes(s));
    assert.ok(mine.length >= 3, `${s}: ${mine.length} scenario(s), the floor is 3`);
  }
});

it('a scenario says what a correct response does, not that it went well', () => {
  for (const s of scenarios.scenarios) {
    assert.ok(s.query && s.query.length > 10, `a scenario needs a real query: ${s.query}`);
    assert.ok(Array.isArray(s.expected_behavior) && s.expected_behavior.length >= 2,
      `${s.query}: needs at least two checkable behaviours`);
    assert.ok(s.why, `${s.query}: a scenario without a reason is one nobody will maintain`);
  }
});

it('every file a scenario names exists', () => {
  // A scenario pointing at a missing fixture fails at read time, which reads as the
  // skill failing.
  for (const s of scenarios.scenarios) {
    for (const f of s.files || []) {
      assert.ok(fs.existsSync(path.join(__dirname, '..', f)), `missing fixture: ${f}`);
    }
  }
});

it('no fixture is named SKILL.md — it would ship as a real skill', () => {
  const dir = path.join(DIR, 'fixtures');
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    assert.notStrictEqual(f, 'SKILL.md', 'a fixture named SKILL.md installs as a skill');
  }
});

it('the trigger set is about twenty queries, and the ids are unique', () => {
  const q = triggers.queries;
  assert.ok(q.length >= 18 && q.length <= 24, `${q.length} queries; the house shape is ~20`);
  assert.strictEqual(new Set(q.map((x) => x.id)).size, q.length, 'duplicate id');
});

it('half the trigger set fires nothing, and those are the valuable half', () => {
  // Negatives that share no keywords prove nothing. The useful ones are near-misses,
  // and there have to be enough of them to measure with.
  const q = triggers.queries;
  const negatives = q.filter((x) => x.expect === null).length;
  const ratio = negatives / q.length;
  assert.ok(ratio >= 0.4 && ratio <= 0.6, `${negatives}/${q.length} negatives; the house shape is half`);
});

it('every query names a skill this repository ships, or none', () => {
  for (const x of triggers.queries) {
    assert.ok(x.expect === null || SKILLS.includes(x.expect), `${x.id}: unknown expect ${x.expect}`);
    assert.ok(x.why, `${x.id}: a query without a stated reason cannot be tuned without guessing`);
  }
});

it('both skills and both classes appear on both sides of the split', () => {
  // A split with all the negatives on one side measures nothing on the other, and a
  // skill absent from validation is a skill tuned without a held-out check.
  for (const side of ['train', 'validation']) {
    const rows = triggers.queries.filter((x) => x.split === side);
    assert.ok(rows.length >= 6, `${side}: only ${rows.length} queries`);
    assert.ok(rows.some((x) => x.expect === null), `${side}: no negatives`);
    for (const s of SKILLS) {
      assert.ok(rows.some((x) => x.expect === s), `${side}: ${s} never appears`);
    }
  }
});

it('the split is 60/40 and written down, so it can be held fixed', () => {
  const train = triggers.queries.filter((x) => x.split === 'train').length;
  const ratio = train / triggers.queries.length;
  assert.ok(ratio >= 0.55 && ratio <= 0.65, `train is ${train}/${triggers.queries.length}`);
  assert.ok(triggers.split && triggers.split.train && triggers.split.validation,
    'the split must be stated in the file, not inferred — tuning on validation is how it stops measuring');
});

it('the README refuses to claim the evals have been run', () => {
  // The claim this repository must never make. Asserted, because prose drifts and the
  // pressure to delete this sentence arrives the first time someone wants a green.
  const readme = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8');
  assert.match(readme, /never been run/i, 'the README must say the evals have not been run');
});

report('evals');
