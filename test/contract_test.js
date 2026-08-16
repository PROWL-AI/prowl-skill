#!/usr/bin/env node
'use strict';
// The contract check, fixtured offline. The network half runs in CI; the parsing and
// judging halves are pure and belong here — including the two cases that made the
// check necessary, and the one that made it noisy.

const assert = require('assert');
const path = require('path');
const { it, report } = require('./_harness.js');

const check = require(path.join(__dirname, '..', 'scripts', 'check-contract.js'));

// A page in the shape both skills actually have, 2026-08-16.
const PAGE = `
23 MCP tools front the catalog.

| \`prowl_list_tools\` | Category counts | free |
| \`prowl_get_wallet\` | Balance | free |

Prowl exposes **448 market-intelligence API tools** across 15 providers.

Provide the key via a token file at \`~/.prowl/prowl_mcp_token\`.
Artifacts come as infographic, pdf, pptx, audio or video.
`;

/** What a two-tool server answers, with an enum-bearing argument. */
const TOOLS = [
  { name: 'prowl_list_tools', inputSchema: { properties: { category: {}, names: {} } } },
  {
    name: 'prowl_get_wallet',
    inputSchema: {
      properties: { artifact_type: {} },
      $defs: { ArtifactType: { enum: ['infographic', 'pdf', 'pptx', 'audio', 'video'] } },
    },
  },
];

it('reads every prowl_* name a page states', () => {
  assert.deepStrictEqual(check.statedTools(PAGE), ['prowl_get_wallet', 'prowl_list_tools']);
});

it('does not mistake the token file for a tool', () => {
  // `~/.prowl/prowl_mcp_token` is a path both pages tell the operator to write. It
  // was reported as an unregistered tool on the check's first live run, on two pages
  // that had nothing wrong with them.
  assert.ok(!check.statedTools(PAGE).includes('prowl_mcp_token'));
});

it('reads the MCP-tool count without swallowing the catalogue count', () => {
  // `448 market-intelligence API tools` sits three lines away and is a different
  // number about a different thing. A pattern loose enough to take both would report
  // the catalogue as drift on every run.
  assert.deepStrictEqual(check.statedToolCounts(PAGE), [23]);
});

it('builds names, arguments and enum values out of a tools/list result', () => {
  const c = check.serverContract(TOOLS);
  assert.deepStrictEqual([...c.names].sort(), ['prowl_get_wallet', 'prowl_list_tools']);
  assert.ok(c.args.has('category') && c.args.has('artifact_type'));
  assert.ok(c.enums.has('video'));
  assert.deepStrictEqual(c.perTool.prowl_list_tools.args, ['category', 'names']);
});

it('passes a page that names only registered tools', () => {
  const rows = [{ file: 'SKILL.md', text: PAGE, tools: check.statedTools(PAGE), counts: [2] }];
  const v = check.verdict(rows, check.serverContract(TOOLS), [2]);
  assert.strictEqual(v.ok, true, JSON.stringify(v.failures));
});

it('fails on a tool the server does not register', () => {
  // The defect this file exists for: real in the server source, absent from the
  // deployment, shipped in three places with every gate green.
  const rows = [{ file: 'SKILL.md', text: PAGE, tools: ['prowl_invented'], counts: [2] }];
  const v = check.verdict(rows, check.serverContract(TOOLS), [2]);
  assert.strictEqual(v.ok, false);
  assert.match(v.failures[0].detail, /prowl_invented is not registered/);
});

it('fails on a stated count that is not the registered count', () => {
  const rows = [{ file: 'SKILL.md', text: PAGE, tools: [], counts: [23] }];
  const v = check.verdict(rows, check.serverContract(TOOLS), [2]);
  assert.strictEqual(v.ok, false);
  assert.match(v.failures[0].detail, /states 23 MCP tools; the server registers 2/);
});

it('fails when check-tool-count.js disagrees with the server — the guard has a guard', () => {
  // ALLOWED was re-anchored from [22] to [23] to match a tool that did not exist, and
  // the count check then printed OK. Nothing sat above it. This is that thing.
  const rows = [{ file: 'SKILL.md', text: PAGE, tools: [], counts: [] }];
  const v = check.verdict(rows, check.serverContract(TOOLS), [22]);
  assert.strictEqual(v.ok, false);
  assert.match(v.failures[0].detail, /ALLOWED is \[22\]; the server registers 2/);
});

it('reports an undocumented enum value as a note, and stays green', () => {
  // Omission is an editorial choice; falsehood is a defect. A check that fails on the
  // first gets silenced before it can catch the second.
  const thin = '2 MCP tools. `prowl_get_wallet` exists.';
  const rows = [{ file: 'SKILL.md', text: thin, tools: ['prowl_get_wallet'], counts: [2] }];
  const v = check.verdict(rows, check.serverContract(TOOLS), [2]);
  assert.strictEqual(v.ok, true, 'an omission must never fail the gate');
  assert.strictEqual(v.notes.length, 1);
  assert.match(v.notes[0].detail, /no page mentions .*video/);
});

it('prefers an explicit gateway header, then a key, then nothing', () => {
  assert.deepStrictEqual(
    check.auth({ PROWL_MCP_HEADER: 'x-agw-key: abc', PROWL_API_KEY: 'prowl_zzz' }, null),
    { 'x-agw-key': 'abc' },
    'the gateway header must win — it is how the check runs where the key is not on disk');
  assert.deepStrictEqual(check.auth({ PROWL_API_KEY: 'prowl_zzz' }, null), { authorization: 'Bearer prowl_zzz' });
  assert.strictEqual(check.auth({}, null), null, 'no credential must be unknown, never a pass');
});

it('reads a body whether the endpoint answers JSON or SSE', () => {
  assert.deepStrictEqual(check.parseBody('application/json', '{"a":1}'), { a: 1 });
  assert.deepStrictEqual(
    check.parseBody('text/event-stream', 'event: message\ndata: {"a":2}\n\n'),
    { a: 2 },
    'the same endpoint answers both depending on what sits in front of it');
});

report('contract');
