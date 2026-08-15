#!/usr/bin/env node
'use strict';
/**
 * Does this repository still state the number of tools the server actually serves?
 *
 * The count was written into eight files and had nothing keeping it true: the
 * repository said 408 for two releases while `prowl.chat` served 448. A number
 * restated in eight places is a number that will drift, and the only durable fix is
 * a check that compares it against the source rather than a promise to remember.
 *
 * Deliberately outside `npm test`, which must run offline. CI runs it as its own
 * step, and a network failure is reported as *unknown* rather than as a mismatch —
 * a check that cannot reach the server has learned nothing, and saying otherwise
 * would eventually train someone to ignore it.
 *
 * The parsing halves are pure and exported, so the suite fixtures them without a
 * network.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = 'https://prowl.chat/mcp/skill.md';

/** Files whose prose carries the count. Directories the run itself writes are excluded. */
const SKIP_DIRS = new Set(['.git', 'node_modules', 'docs', '.task-pipeline']);

/**
 * The server's own figure, from the hosted skill document.
 *
 * Anchored on the heading's shape — `→ <n> API tools` — and on the opening
 * paragraph's `<n> marketing intelligence API tools`. Two independent anchors,
 * because a document that reworded one of them should make this check say so
 * rather than silently stop finding anything.
 */
function serverCount(text) {
  const found = new Set();
  const patterns = [
    /→\s*(\d{2,5})\s+API\s+tools/gi,
    /\b(\d{2,5})\s+marketing[\s-]intelligence\s+API\s+tools/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) found.add(Number(m[1]));
  }
  if (found.size !== 1) return { count: null, found: [...found].sort((a, b) => a - b) };
  return { count: [...found][0], found: [...found] };
}

/**
 * Every count this repository states, per file.
 *
 * Three shapes appear in the prose and each is matched on its own terms: `448
 * tools`, `448-tool catalog`, and the README badge's `tools-448-<colour>`. A bare
 * three-digit number is never taken — `15 providers` and `#0969da` are not counts,
 * and a pattern loose enough to catch them would report noise until nobody read it.
 */
function statedCounts(text) {
  const found = new Set();
  const patterns = [
    /\b(\d{2,5})\s+(?:market-intelligence\s+)?(?:API\s+)?tools?\b/gi,
    /\b(\d{2,5})-tool\b/gi,
    /tools-(\d{2,5})-/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) found.add(Number(m[1]));
  }
  return [...found].sort((a, b) => a - b);
}

/** Walk the repository, returning `{file, counts}` for every file that states one. */
function repoCounts(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name));
        continue;
      }
      if (!/\.(md|json)$/.test(e.name)) continue;
      const file = path.join(dir, e.name);
      const counts = statedCounts(fs.readFileSync(file, 'utf8'));
      if (counts.length) out.push({ file: path.relative(root, file), counts });
    }
  };
  walk(root);
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * The verdict. Pure, so both branches are fixtured.
 *
 * `22` is the count of MCP tools the server registers and is stated deliberately
 * beside the catalogue figure; it is not drift, and a check that flagged it would be
 * wrong every single run.
 */
function verdict(server, rows, allowed) {
  const ok = new Set([server, ...(allowed || [])]);
  const mismatches = [];
  for (const row of rows) {
    const bad = row.counts.filter((c) => !ok.has(c));
    if (bad.length) mismatches.push({ file: row.file, stated: bad });
  }
  return { ok: mismatches.length === 0, mismatches };
}

/**
 * The registered-MCP-tool count, which lives beside the catalogue count on purpose.
 *
 * Only the current value is listed: keeping an outgoing one would exempt a page that
 * still states it from every check in this file, which is the drift this file exists
 * to catch.
 *
 * It was moved to 23 on 2026-08-15 for a `prowl_get_wallet` that does not exist, and
 * moved back on 2026-08-16 after `tools/list` was called and answered 22. That is the
 * failure mode worth naming here: this constant is the only thing standing between a
 * remembered number and a shipped one, so **re-anchoring it to match a new claim
 * destroys the check instead of updating it**. Move it only after reading a live
 * `tools/list`, and say in the commit which call was read.
 */
const ALLOWED = [22];

async function main() {
  let text;
  try {
    const res = await fetch(SOURCE, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (e) {
    // Unknown is not a failure. A check that cannot reach the server has learned
    // nothing, and reporting that as drift is how a check gets ignored.
    process.stdout.write(`UNKNOWN: could not reach ${SOURCE} — ${e.message}\n`);
    process.exit(0);
  }

  const { count, found } = serverCount(text);
  if (count === null) {
    process.stdout.write(
      `FAIL: could not read one count from ${SOURCE}; anchors matched ${JSON.stringify(found)}.\n` +
      'The document was reworded — re-anchor serverCount() rather than trusting the last known number.\n');
    process.exit(1);
  }

  const rows = repoCounts(ROOT);
  const v = verdict(count, rows, ALLOWED);
  if (v.ok) {
    process.stdout.write(`OK: ${SOURCE} serves ${count} tools; ${rows.length} file(s) agree.\n`);
    process.exit(0);
  }
  process.stdout.write(`FAIL: ${SOURCE} serves ${count} tools, and these files say otherwise:\n`);
  for (const m of v.mismatches) process.stdout.write(`  ${m.file}: ${m.stated.join(', ')}\n`);
  process.exit(1);
}

module.exports = { serverCount, statedCounts, repoCounts, verdict, ALLOWED, SOURCE };

if (require.main === module) main();
