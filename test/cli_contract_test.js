#!/usr/bin/env node
'use strict';
// The CLI check, fixtured offline. The network half runs in CI; the parsing and
// judging halves are pure and belong here — including the state that blocked a
// release for a day, and the parser failure that would have looked like a defect.

const assert = require('assert');
const path = require('path');
const { it, report } = require('./_harness.js');

const check = require(path.join(__dirname, '..', 'scripts', 'check-cli.js'));

const PAGE = `---
name: prowl-cli
metadata:
  author: prowl.chat
  version: "0.2.3"
  documents_cli: "0.2.0"
---

This page documents CLI \`0.2.0\`, which is what npm serves as \`latest\`.

\`\`\`
CATALOGUE (free)
  prowl tools list [--names]
  prowl playbooks

ACCOUNT (free)
  prowl wallet
  prowl version
\`\`\`

Use the sibling \`prowl\` plugin instead when the agent should call MCP tools.

prowl skills are installed as plugins rather than copied, which is a sentence that
begins with the word and is not a command.

## Exit codes

\`0\` ok · \`1\` runtime/tool error · \`2\` usage · \`3\` auth · \`4\` insufficient balance · \`5\` network/timeout.
`;

const INDEX = `
const SUBCOMMANDED = new Set(["auth", "tools"]);
export async function run(argv) {
  switch (cmd) {
    case "tools": result = await toolsCmd(sub, rest, ctx); break;
    case "playbooks": result = await playbooksCmd(rest, ctx); break;
    case "wallet": result = await walletCmd(rest, ctx); break;
    case "version": result = VERSION; break;
    default: return { code: EXIT.USAGE };
  }
}
`;

const ERRORS = 'export const EXIT = { OK: 0, RUNTIME: 1, USAGE: 2, AUTH: 3, BALANCE: 4, NETWORK: 5 };';

it('reads the documented CLI version from its own field, not the plugin version', () => {
  // The whole defect class is these two being confused. `0.2.3` is this plugin;
  // `0.2.0` is a third party's package.
  assert.strictEqual(check.documentedVersion(PAGE), '0.2.0');
});

it('reads the same claim out of the prose, so the two cannot drift', () => {
  assert.strictEqual(check.proseVersion(PAGE), '0.2.0');
});

it('takes verbs from fenced blocks only', () => {
  // The line-start anchor alone is not enough, and this fixture is the proof: a
  // sentence *beginning* with the word — "prowl skills are installed as plugins" —
  // yields a verb `skills`, which the CLI does not ship, so the check would report a
  // command the page never claimed. The first version of this test used a mid-sentence
  // mention instead, which the anchor excluded on its own; the guard suite caught that
  // the assertion was vacuous by removing the fencing and watching the test stay green.
  assert.deepStrictEqual(check.statedVerbs(PAGE), ['playbooks', 'tools', 'version', 'wallet']);
});

it('reads the exit codes the page states', () => {
  assert.deepStrictEqual(check.statedExits(PAGE), [0, 1, 2, 3, 4, 5]);
});

it('reads the verbs and exit codes the CLI ships', () => {
  assert.deepStrictEqual(check.shippedVerbs(INDEX), ['playbooks', 'tools', 'version', 'wallet']);
  assert.deepStrictEqual(check.shippedExits(ERRORS), [0, 1, 2, 3, 4, 5]);
});

it('passes when the page and the published CLI agree', () => {
  const page = { documented: '0.2.0', prose: '0.2.0', statedVerbs: ['tools', 'wallet'], statedExits: [0, 1] };
  const v = check.verdict(page, { verbs: ['tools', 'wallet'], exits: [0, 1] }, false);
  assert.strictEqual(v.ok, true, JSON.stringify(v.failures));
  assert.strictEqual(v.blocked, false);
});

it('fails on a verb the page states and the CLI does not ship', () => {
  // Two releases of this page listed `session`, `schedule`, `artifact` and four more
  // against a binary whose dispatcher knew six verbs.
  const page = { documented: '0.2.0', prose: '0.2.0', statedVerbs: ['tools', 'session'], statedExits: [] };
  const v = check.verdict(page, { verbs: ['tools'], exits: [] }, false);
  assert.strictEqual(v.ok, false);
  assert.match(v.failures[0].detail, /states `prowl session`/);
});

it('reports a verb the CLI ships and the page omits, and stays green', () => {
  const page = { documented: '0.2.0', prose: '0.2.0', statedVerbs: ['tools'], statedExits: [] };
  const v = check.verdict(page, { verbs: ['tools', 'errors'], exits: [] }, false);
  assert.strictEqual(v.ok, true, 'an omission must never fail the gate');
  assert.match(v.notes[0].detail, /ships `prowl errors`/);
});

it('fails when an exit code moved', () => {
  const page = { documented: '0.2.0', prose: '0.2.0', statedVerbs: [], statedExits: [0, 1, 2] };
  const v = check.verdict(page, { verbs: [], exits: [0, 1, 2, 3] }, false);
  assert.strictEqual(v.ok, false);
  assert.match(v.failures[0].detail, /exit codes 0, 1, 2; the CLI defines 0, 1, 2, 3/);
});

it('fails when the front-matter field and the prose disagree', () => {
  const page = { documented: '0.2.0', prose: '0.3.0', statedVerbs: [], statedExits: [] };
  const v = check.verdict(page, { verbs: [], exits: [] }, false);
  assert.strictEqual(v.ok, false);
  assert.match(v.failures[0].detail, /front-matter says it documents 0\.2\.0, the page text says 0\.3\.0/);
});

it('fails when nothing says which CLI the page describes', () => {
  const v = check.verdict({ documented: null, prose: null, statedVerbs: [], statedExits: [] }, null, false);
  assert.strictEqual(v.ok, false);
  assert.match(v.failures[0].detail, /no metadata\.documents_cli/);
});

it('a published version that is no longer latest is a note, not a failure', () => {
  // The state this repository reached the moment the CLI published 0.2.1 while the
  // page still said 0.2.0: every check green, the surface identical, and the page
  // quietly pointing at a version `npm install` no longer gives you.
  const page = { documented: '0.2.0', prose: '0.2.0', statedVerbs: ['tools'], statedExits: [] };
  const v = check.verdict(page, { verbs: ['tools'], exits: [] }, false, '0.2.1');
  assert.strictEqual(v.ok, true, 'the surface is unchanged, so this is not a falsehood');
  assert.match(v.notes.map((n) => n.detail).join(' '), /documents 0\.2\.0; npm's latest is 0\.2\.1/);
});

it('matching latest says nothing at all', () => {
  const page = { documented: '0.2.1', prose: '0.2.1', statedVerbs: ['tools'], statedExits: [] };
  const v = check.verdict(page, { verbs: ['tools'], exits: [] }, false, '0.2.1');
  assert.strictEqual(v.notes.length, 0, 'a check that talks when nothing is wrong is one nobody reads');
});

it('an unpublished documented version is blocked, not failed — until --release', () => {
  // This was the real state for a day: the page described 0.2.0 while npm served
  // 0.1.1. It is not a defect in the page, and a red nobody reading it can clear is
  // a red that gets ignored. At the tag it is fatal, and only there.
  const page = { documented: '0.2.0', prose: '0.2.0', statedVerbs: ['session'], statedExits: [] };
  const lax = check.verdict(page, null, false);
  assert.strictEqual(lax.blocked, true);
  assert.strictEqual(lax.ok, true, 'blocked must not fail an ordinary run');
  const strict = check.verdict(page, null, true);
  assert.strictEqual(strict.ok, false, '--release must refuse to tag ahead of the binary');
});

report('cli contract');
