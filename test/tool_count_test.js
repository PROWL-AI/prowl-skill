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

## Tools (23 registered tools — 21 logical + 2 legacy aliases → 448 API tools)
`;

// The same two anchors after the 2026-09 repositioning: the opening paragraph says
// "market data tools", the heading keeps "→ <n> API tools".
const HOSTED_2026_09 = `
Prowl gives your agents **real-world market data**. It exposes
**444 market data tools** across 17 providers (DataForSEO, Majestic, …).

## Tools (23 registered tools — 21 logical + 2 legacy aliases → 444 API tools)
`;

it('reads one count out of the hosted document', () => {
  assert.deepStrictEqual(check.serverCount(HOSTED), { count: 448, found: [448] });
});

it('reads one count out of the hosted document in its market-data wording', () => {
  assert.deepStrictEqual(check.serverCount(HOSTED_2026_09), { count: 444, found: [444] });
  assert.deepStrictEqual(check.serverCount('444 market-data API tools · → 444 API tools'), { count: 444, found: [444] });
});

it('refuses to guess when the new wording disagrees with the heading', () => {
  const drifted = HOSTED_2026_09.replace('**444 market data tools**', '**448 market data tools**');
  assert.deepStrictEqual(check.serverCount(drifted), { count: null, found: [444, 448] });
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

it('finds a count in the market-data wording too', () => {
  // A stale figure written in the new wording must not slip past the check because
  // the words between the number and "tools" changed.
  const prose = [
    '**Real-world market data for your agents.** One MCP endpoint, 444 market data tools.',
    'exposes **408 market-data tools** across 17 providers',
    'drive the 444-tool Prowl market data catalog from the shell',
  ].join('\n');
  assert.deepStrictEqual(check.statedCounts(prose), [408, 444]);
});

it('does not mistake neighbouring numbers for counts', () => {
  // Every one of these sits in the real prose beside a real count.
  const noise = '60+ SERP engines, 102 SearchAPI engines, 15 providers, 17 providers, up to 16 intelligence modules, $18.00 cap, brandColor #3f7d5f, Node 18+';
  assert.deepStrictEqual(check.statedCounts(noise), []);
});

it('the registered-MCP-tool count is not drift', () => {
  const rows = [{ file: 'SKILL.md', counts: [23, 448] }];
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

it('the CHANGELOG is history and is not read as a current claim', () => {
  // Every past release states the count it shipped with. Reading those as claims
  // about today would either rewrite the past on every catalogue change or keep the
  // check red forever.
  assert.ok(check.HISTORICAL_FILES.has('CHANGELOG.md'));
  const rows = check.repoCounts(path.join(__dirname, '..'));
  assert.ok(!rows.some((r) => r.file === 'CHANGELOG.md'), 'CHANGELOG.md must not be a row');
});

it('reads owner/repo out of every repository shape npm allows', () => {
  assert.strictEqual(check.forgeSlug({ repository: 'github:PROWL-AI/prowl-skill' }), 'PROWL-AI/prowl-skill');
  assert.strictEqual(check.forgeSlug({ repository: { url: 'git+https://github.com/PROWL-AI/prowl-skill.git' } }), 'PROWL-AI/prowl-skill');
  assert.strictEqual(check.forgeSlug({}), null, 'no repository field must be silent, not a crash');
});

it('the forge description is judged like any other surface', () => {
  // It said 408 for two months after every file on disk said 448 — drift on the one
  // published surface the file walk cannot see, which is why it is a row now.
  const stale = check.statedCounts('… connects any agent to 408 market-intelligence tools (SEO, ads).');
  assert.deepStrictEqual(stale, [408]);
  const rows = [{ file: 'github:PROWL-AI/prowl-skill (repo description)', counts: stale }];
  const v = check.verdict(448, rows, check.ALLOWED);
  assert.strictEqual(v.ok, false);
  assert.deepStrictEqual(v.mismatches[0].stated, [408]);
});

report('tool count');
