#!/usr/bin/env node
'use strict';
// The tool-count check, fixtured offline. The network half runs in CI; the parsing
// halves are pure and belong here, including the case that made the check necessary.

const assert = require('assert');
const path = require('path');
const { it, report } = require('./_harness.js');

const check = require(path.join(__dirname, '..', 'scripts', 'check-tool-count.js'));

// The two anchors as the hosted document actually writes them, 2026-08-13.
const HOSTED = `
Prowl is **the MCP that turns any AI agent into a research analyst**. It exposes
**448 marketing intelligence API tools** (across DataForSEO, Majestic, …).

## Tools (22 registered tools — 20 logical + 2 legacy aliases → 448 API tools)
`;

it('reads one count out of the hosted document', () => {
  assert.deepStrictEqual(check.serverCount(HOSTED), { count: 448, found: [448] });
});

it('refuses to guess when the anchors disagree', () => {
  const drifted = HOSTED.replace('→ 448 API tools', '→ 512 API tools');
  const r = check.serverCount(drifted);
  assert.strictEqual(r.count, null, 'two different figures must not resolve to one');
  assert.deepStrictEqual(r.found, [448, 512]);
});

it('refuses to guess when neither anchor matches', () => {
  const r = check.serverCount('a document that no longer says any of this');
  assert.strictEqual(r.count, null);
  assert.deepStrictEqual(r.found, []);
});

it('finds every shape the repository states a count in', () => {
  const prose = [
    '**One MCP. 448 market-intelligence tools for your agent.**',
    '[![Tools](https://img.shields.io/badge/tools-448-0969da?style=flat-square)]',
    'drive the 448-tool Prowl catalog from the shell',
    'exposes **448 market-intelligence API tools** across 15 providers',
  ].join('\n');
  assert.deepStrictEqual(check.statedCounts(prose), [448]);
});

it('does not mistake neighbouring numbers for counts', () => {
  // Every one of these sits in the real prose beside a real count.
  const noise = '60+ SERP engines, 15 providers, $18.00 cap, brandColor #0969da, Node 18+';
  assert.deepStrictEqual(check.statedCounts(noise), []);
});

it('the registered-MCP-tool count is not drift', () => {
  const rows = [{ file: 'SKILL.md', counts: [22, 448] }];
  assert.strictEqual(check.verdict(448, rows, check.ALLOWED).ok, true);
});

it('a stale figure is reported with its file', () => {
  const rows = [
    { file: 'README.md', counts: [448] },
    { file: 'plugins/prowl/skills/prowl/SKILL.md', counts: [408, 448] },
  ];
  const v = check.verdict(448, rows, check.ALLOWED);
  assert.strictEqual(v.ok, false);
  assert.deepStrictEqual(v.mismatches, [
    { file: 'plugins/prowl/skills/prowl/SKILL.md', stated: [408] },
  ]);
});

it('this repository agrees with itself right now', () => {
  // The live figure is not fetched here — offline suite. What is asserted is that
  // every file states the SAME count, which is the half that can rot locally.
  const rows = check.repoCounts(path.join(__dirname, '..'));
  const stated = new Set();
  for (const row of rows) for (const c of row.counts) if (!check.ALLOWED.includes(c)) stated.add(c);
  assert.strictEqual(stated.size, 1, `files disagree on the count: ${[...stated].join(', ')}`);
  assert.ok(rows.length >= 8, `expected at least 8 files to state it, found ${rows.length}`);
});

report('tool count');
