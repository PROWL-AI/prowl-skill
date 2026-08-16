#!/usr/bin/env node
'use strict';
/**
 * Does the `prowl-cli` page describe the CLI that npm actually serves?
 *
 * The page documents `@prowl-ai/cli`, and until this file nothing connected the two.
 * `version_sync_test.js` checks that a plugin agrees with *itself* across its three
 * surfaces; the npm package it describes was never in the comparison. Plugin `0.2.3`
 * and CLI `0.2.0` are unrelated numbers that happened to look related. A CLI release
 * that renamed a verb would have shipped here unnoticed — which is not hypothetical:
 * the page spent two releases listing commands the published binary answers
 * `Unknown command` to.
 *
 * **Fails on a falsehood, reports an omission** — the same asymmetry
 * `check-contract.js` states, for the same reason. A verb the page claims and the CLI
 * lacks sends an agent to run something that does not exist. A verb the CLI has and
 * the page omits only leaves it undiscovered.
 *
 * **The unpublished case is neither, and gets its own outcome.** When the page
 * documents a version npm does not serve — board `B-01` — there is nothing to compare
 * against, so the check says `BLOCKED` and exits 0 by default. A red that cannot be
 * cleared by anyone reading it is a red that gets ignored within a week. Under
 * `--release` it exits 1 instead, and that is the mode the tag workflow runs: the one
 * moment where shipping the page ahead of the binary actually hurts someone.
 *
 * Outside `npm test`, which must run offline. Unreachable is *unknown*, never drift.
 * The parsing halves are pure and exported, and fixtured without a network.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PAGE = path.join('plugins', 'prowl-cli', 'skills', 'prowl-cli', 'SKILL.md');
const PACKAGE = '@prowl-ai/cli';

/**
 * The CLI release the page claims to describe.
 *
 * It lives in `metadata.documents_cli`, beside `metadata.version` and deliberately not
 * inside it: one is this plugin's version and the other is a third party's, and the
 * whole defect class here is those two being confused. Front-matter rather than prose
 * because a version parsed out of a sentence stops being found the moment somebody
 * rewrites the sentence.
 */
function documentedVersion(text) {
  const fm = text.split('---')[1] || '';
  const m = /^\s*documents_cli:\s*"([^"]+)"\s*$/m.exec(fm);
  return m ? m[1] : null;
}

/**
 * The same claim as the page makes it in prose, so the two cannot drift apart.
 *
 * The front-matter field is what machines read and what nobody looks at; the sentence
 * above the install line is what a person reads. A field updated without the sentence
 * is how a page ends up telling a human one version and a script another.
 */
function proseVersion(text) {
  const m = /documents CLI `([0-9]+\.[0-9]+\.[0-9]+)`/.exec(text);
  return m ? m[1] : null;
}

/** Fenced blocks only — the command list lives in one, and prose says `prowl` a lot. */
function fencedBlocks(text) {
  return [...text.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]);
}

/** Top-level verbs the page lists: the token after `prowl` at the start of a line. */
function statedVerbs(text) {
  const found = new Set();
  for (const block of fencedBlocks(text)) {
    for (const line of block.split('\n')) {
      const m = /^\s*prowl\s+([a-z][a-z-]*)\b/.exec(line);
      if (m) found.add(m[1]);
    }
  }
  return [...found].sort();
}

/** Exit codes the page states, as `` `0` `` … `` `5` `` on its exit-code line. */
function statedExits(text) {
  const line = /`0`[^\n]*/.exec(text);
  if (!line) return [];
  return [...new Set([...line[0].matchAll(/`(\d)`/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
}

/**
 * The verbs the shipped dispatcher answers, from its `case "x":` arms.
 *
 * Both released shapes are the same switch on `cmd`. A parser that finds nothing must
 * say so rather than report every documented verb as missing, which is why the caller
 * treats an implausibly small result as *unknown* — a broken parser and a CLI with no
 * commands are indistinguishable from the output alone, and only one of them is real.
 */
function shippedVerbs(indexSource) {
  const m = /switch\s*\(\s*cmd\s*\)\s*\{([\s\S]*?)\n\s{0,4}\}/.exec(indexSource);
  const body = m ? m[1] : indexSource;
  return [...new Set([...body.matchAll(/case\s+"([a-z][a-z-]*)"\s*:/g)].map((x) => x[1]))].sort();
}

/** The shipped `EXIT` map, as a sorted list of its values. */
function shippedExits(errorsSource) {
  const m = /EXIT\s*=\s*\{([^}]*)\}/.exec(errorsSource);
  if (!m) return [];
  return [...new Set([...m[1].matchAll(/:\s*(\d+)/g)].map((x) => Number(x[1])))].sort((a, b) => a - b);
}

/**
 * The verdict. Pure, so every branch is fixtured.
 *
 * `published` is `null` when the documented version is not on npm — the `BLOCKED`
 * case, which is a state of the world rather than a defect in the page.
 */
function verdict({ documented, prose, statedVerbs: sv, statedExits: se }, published, strict) {
  const failures = [];
  const notes = [];

  if (!documented) {
    failures.push({ detail: `${PAGE} carries no metadata.documents_cli — nothing says which CLI it describes` });
    return { ok: false, blocked: false, failures, notes };
  }
  if (prose && prose !== documented) {
    failures.push({ detail: `front-matter says it documents ${documented}, the page text says ${prose}` });
  }

  if (!published) {
    return {
      ok: failures.length === 0 && !strict,
      blocked: true,
      failures,
      notes,
    };
  }

  for (const v of sv) {
    if (!published.verbs.includes(v)) {
      failures.push({ detail: `the page states \`prowl ${v}\`, and ${PACKAGE}@${documented} has no such command` });
    }
  }
  for (const v of published.verbs) {
    if (!sv.includes(v)) notes.push({ detail: `${PACKAGE}@${documented} ships \`prowl ${v}\`, which no page mentions` });
  }
  if (se.length && published.exits.length && String(se) !== String(published.exits)) {
    failures.push({ detail: `the page states exit codes ${se.join(', ')}; the CLI defines ${published.exits.join(', ')}` });
  }

  return { ok: failures.length === 0, blocked: false, failures, notes };
}

/** What npm serves right now: every version, and the `latest` tag. */
function npmVersions() {
  const out = execFileSync('npm', ['view', PACKAGE, 'versions', 'dist-tags', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const d = JSON.parse(out);
  return { versions: [].concat(d.versions || []), latest: (d['dist-tags'] || {}).latest || null };
}

/** Unpack the published tarball and read the two files that carry the contract. */
function fetchPublished(version) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prowl-cli-check-'));
  try {
    execFileSync('npm', ['pack', `${PACKAGE}@${version}`, '--silent'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
    const tgz = fs.readdirSync(dir).find((f) => f.endsWith('.tgz'));
    if (!tgz) throw new Error('npm pack produced no tarball');
    execFileSync('tar', ['xzf', tgz], { cwd: dir });
    const src = path.join(dir, 'package', 'src');
    const verbs = shippedVerbs(fs.readFileSync(path.join(src, 'index.js'), 'utf8'));
    const exits = shippedExits(fs.readFileSync(path.join(src, 'errors.js'), 'utf8'));
    return { verbs, exits };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function readPage(root) {
  const text = fs.readFileSync(path.join(root, PAGE), 'utf8');
  return {
    documented: documentedVersion(text),
    prose: proseVersion(text),
    statedVerbs: statedVerbs(text),
    statedExits: statedExits(text),
  };
}

async function main() {
  const strict = process.argv.includes('--release');
  const page = readPage(ROOT);

  let npmState;
  try {
    npmState = npmVersions();
  } catch (e) {
    process.stdout.write(`UNKNOWN: could not ask npm about ${PACKAGE} — ${e.message}\n`);
    process.exit(0);
  }

  let published = null;
  if (page.documented && npmState.versions.includes(page.documented)) {
    try {
      published = fetchPublished(page.documented);
    } catch (e) {
      process.stdout.write(`UNKNOWN: could not read the published tarball — ${e.message}\n`);
      process.exit(0);
    }
    // A parser that found nothing must not report every documented verb as missing.
    if (published.verbs.length < 4) {
      process.stdout.write(
        `UNKNOWN: read only ${published.verbs.length} command(s) out of ${PACKAGE}@${page.documented}. ` +
        'The dispatcher changed shape — re-anchor shippedVerbs() rather than trusting this.\n');
      process.exit(0);
    }
  }

  const v = verdict(page, published, strict);
  for (const n of v.notes) process.stdout.write(`note  ${n.detail}\n`);

  if (v.blocked) {
    process.stdout.write(
      `BLOCKED: ${PAGE} documents ${PACKAGE}@${page.documented}, which npm does not serve ` +
      `(latest is ${npmState.latest}; published: ${npmState.versions.join(', ')}).\n` +
      '  Board B-01. Publish the CLI before tagging this package, or npx hands people a\n' +
      '  page whose commands answer "Unknown command". Re-run with --release to fail on this.\n');
    for (const f of v.failures) process.stdout.write(`FAIL  ${f.detail}\n`);
    process.exit(v.ok ? 0 : 1);
  }

  if (v.ok) {
    process.stdout.write(
      `OK: ${PAGE} documents ${PACKAGE}@${page.documented}, which npm serves, and states ` +
      `only commands it ships${v.notes.length ? `; ${v.notes.length} note(s) above` : ''}.\n`);
    process.exit(0);
  }
  process.stdout.write(`FAIL: ${PAGE} disagrees with ${PACKAGE}@${page.documented}:\n`);
  for (const f of v.failures) process.stdout.write(`  ${f.detail}\n`);
  process.exit(1);
}

module.exports = {
  documentedVersion, proseVersion, statedVerbs, statedExits,
  shippedVerbs, shippedExits, verdict, readPage, PAGE, PACKAGE,
};

if (require.main === module) main();
