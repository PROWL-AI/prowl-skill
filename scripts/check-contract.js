#!/usr/bin/env node
'use strict';
/**
 * Do the skills describe tools the server actually registers?
 *
 * `check-tool-count.js` guards one number. Nothing guarded a *name*, and on
 * 2026-08-15 `prowl_get_wallet` — real in the server's source, absent from its
 * deployment — reached a published release in three places, with the count raised to
 * match and the count check re-anchored to agree. Every gate was green. This file is
 * the check that would have been red.
 *
 * **It fails on a falsehood and reports an omission**, and the difference is
 * deliberate. Saying a tool exists when it does not teaches an agent a call that
 * fails; leaving a tool undocumented only leaves it undiscovered. The first is a
 * defect, the second is an editorial choice, and a check that treats them alike gets
 * silenced for crying about the second.
 *
 * Deliberately outside `npm test`, which must run offline. Unreachable, unauthorised
 * or unconfigured is reported as *unknown* and exits 0 — a check that could not ask
 * the server has learned nothing, and saying otherwise is how a check gets ignored.
 *
 * The parsing halves are pure and exported, so the suite fixtures them without a
 * network.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_URL = 'https://prowl.chat/mcp/';

/**
 * Where the skills live. Only shipped pages are read: `docs/` is this project's own
 * record of its runs and quotes tool names precisely *because* they were wrong.
 */
function skillFiles(root) {
  const out = [];
  const plugins = path.join(root, 'plugins');
  if (!fs.existsSync(plugins)) return out;
  for (const plugin of fs.readdirSync(plugins)) {
    const skills = path.join(plugins, plugin, 'skills');
    if (!fs.existsSync(skills)) continue;
    for (const skill of fs.readdirSync(skills)) {
      const f = path.join(skills, skill, 'SKILL.md');
      if (fs.existsSync(f)) out.push(f);
    }
  }
  return out.sort();
}

/**
 * Every `prowl_*` name a page states, per file.
 *
 * A `/` before the match rules it out: `~/.prowl/prowl_mcp_token` is a file both
 * pages tell the operator to write, and reporting it as an unregistered tool on every
 * run is how a check earns the reputation that gets it skipped.
 */
function statedTools(text) {
  const found = new Set();
  let m;
  const re = /(?<![/\w])prowl_[a-z][a-z0-9_]*\b/g;
  while ((m = re.exec(text)) !== null) found.add(m[0]);
  return [...found].sort();
}

/**
 * Every `<n> MCP tools` claim a page makes.
 *
 * Anchored on the phrase rather than on a bare number: `448` is the catalogue behind
 * the wrappers and is checked elsewhere, and a pattern loose enough to catch both
 * would report one as the other.
 */
function statedToolCounts(text) {
  const found = new Set();
  let m;
  const re = /\b(\d{1,4})\s+MCP\s+tools?\b/gi;
  while ((m = re.exec(text)) !== null) found.add(Number(m[1]));
  return [...found].sort((a, b) => a - b);
}

/*
 * There is no argument check here, and the absence is a decision with two dead
 * attempts behind it. The defect that started all of this was an argument name —
 * `tier` where the server takes `execution_mode` — so an argument check is the one
 * anybody would reach for first. Both attempts were written, run against the live
 * server, and cut:
 *
 * 1. *Every snake_case token in backticks must be a registered argument.* Flagged
 *    `total_available_usd`, `key_limits`, `focus_areas` — response fields and prompt
 *    arguments, which an input schema cannot contain. Twelve findings, all wrong, on
 *    pages with nothing wrong in them.
 * 2. *A verb of passing, then a backticked identifier within sixty characters.*
 *    Flagged exactly two things, and both were wrong: `tier`, out of the sentence
 *    warning the reader **not** to send it, and `analyze` out of ordinary prose. A
 *    rule that fires on the sentence written to prevent the defect is worse than no
 *    rule.
 *
 * The shared cause is that "this is a parameter" is a claim about meaning, and these
 * pages are English. A gate that cries is spent within a few runs — this repository
 * already carries one that does (`B-08`) — so the honest move is to check what can be
 * checked exactly and leave this named rather than half-done. Board `B-10`: the fix is
 * to make the pages carry the association in a form that is not prose, not to write a
 * third regex.
 */

/** Names, arguments and enum values the server registers, from a `tools/list` result. */
function serverContract(tools) {
  const names = new Set();
  const args = new Set();
  const enums = new Set();
  const perTool = {};
  for (const t of tools) {
    names.add(t.name);
    const schema = t.inputSchema || {};
    const props = schema.properties || {};
    perTool[t.name] = { args: Object.keys(props).sort(), enums: [] };
    for (const k of Object.keys(props)) args.add(k);
    for (const def of Object.values(schema.$defs || {})) {
      for (const v of def.enum || []) {
        enums.add(String(v));
        perTool[t.name].enums.push(String(v));
      }
    }
    perTool[t.name].enums = [...new Set(perTool[t.name].enums)].sort();
  }
  return { names, args, enums, perTool };
}

/**
 * The verdict. Pure, so both branches are fixtured.
 *
 * `rows` is `{file, tools, counts}` per page; `contract` is what the
 * server answered; `allowed` is the constant `check-tool-count.js` carries, which is
 * checked here rather than trusted — it is the value that was re-anchored to match a
 * claim, and a hand-maintained expected value with nothing above it is how that
 * happened.
 */
function verdict(rows, contract, allowed) {
  const failures = [];
  const notes = [];
  const registered = contract.names.size;

  for (const row of rows) {
    for (const name of row.tools) {
      if (!contract.names.has(name)) {
        failures.push({ file: row.file, kind: 'tool', detail: `${name} is not registered by the server` });
      }
    }
    for (const n of row.counts) {
      if (n !== registered) {
        failures.push({ file: row.file, kind: 'count', detail: `states ${n} MCP tools; the server registers ${registered}` });
      }
    }
  }

  if (Array.isArray(allowed) && !allowed.includes(registered)) {
    failures.push({
      file: 'scripts/check-tool-count.js',
      kind: 'allowed',
      detail: `ALLOWED is ${JSON.stringify(allowed)}; the server registers ${registered}`,
    });
  }

  // Omission, reported and never failed: an enum value of a tool the pages name, that
  // no page mentions.
  const mentioned = new Set(rows.flatMap((r) => r.tools));
  const prose = rows.map((r) => r.text || '').join('\n');
  for (const name of [...mentioned].sort()) {
    const t = contract.perTool[name];
    if (!t) continue;
    const missing = t.enums.filter((v) => !prose.includes(v));
    if (missing.length) {
      notes.push({ file: '(pages)', kind: 'undocumented', detail: `${name}: no page mentions ${missing.join(', ')}` });
    }
  }

  return { ok: failures.length === 0, failures, notes, registered };
}

/**
 * How the check reaches the server.
 *
 * `PROWL_API_KEY` (or `PROWL_MCP_TOKEN`, or `~/.prowl/prowl_mcp_token`) sends the
 * documented `Authorization: Bearer` header. `PROWL_MCP_HEADER`, given as
 * `Name: value`, sends that instead and is how this runs against a local MCP gateway
 * that holds the upstream key itself — which is the only way it could be run on the
 * machine where it was written, and a check whose author never watched it answer is
 * not evidence.
 */
function auth(env, home) {
  const raw = env.PROWL_MCP_HEADER;
  if (raw && raw.includes(':')) {
    const i = raw.indexOf(':');
    return { [raw.slice(0, i).trim().toLowerCase()]: raw.slice(i + 1).trim() };
  }
  let key = env.PROWL_API_KEY || env.PROWL_MCP_TOKEN || null;
  if (!key && home) {
    try {
      key = fs.readFileSync(path.join(home, '.prowl', 'prowl_mcp_token'), 'utf8').trim() || null;
    } catch {}
  }
  return key ? { authorization: `Bearer ${key}` } : null;
}

async function toolsList(url, headers) {
  const base = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers };
  const post = (body, extra = {}) =>
    fetch(url, { method: 'POST', headers: { ...base, ...extra }, body: JSON.stringify(body), redirect: 'follow' });

  const init = await post({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'check-contract', version: '1' } },
  });
  if (init.status === 401 || init.status === 403) throw Object.assign(new Error(`HTTP ${init.status}`), { unauthorised: true });
  if (!init.ok) throw new Error(`initialize: HTTP ${init.status}`);
  const sid = init.headers.get('mcp-session-id');
  const withSid = sid ? { 'mcp-session-id': sid } : {};
  await init.text();

  // The server expects the initialized notification before it will serve anything.
  await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, withSid).catch(() => {});

  const res = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, withSid);
  if (!res.ok) throw new Error(`tools/list: HTTP ${res.status}`);
  const text = await res.text();
  const body = parseBody(res.headers.get('content-type'), text);
  if (!body || !body.result || !Array.isArray(body.result.tools)) {
    throw new Error(`tools/list returned no tool array: ${text.slice(0, 200)}`);
  }
  return body.result.tools;
}

/** SSE or JSON; the endpoint answers either depending on what sits in front of it. */
function parseBody(contentType, text) {
  if ((contentType || '').includes('text/event-stream')) {
    let last = null;
    for (const line of text.split(/\r?\n/)) {
      const m = /^data:\s?(.*)$/.exec(line);
      if (m && m[1]) {
        try {
          last = JSON.parse(m[1]);
        } catch {}
      }
    }
    return last;
  }
  return text ? JSON.parse(text) : null;
}

function readRows(root) {
  return skillFiles(root).map((f) => {
    const text = fs.readFileSync(f, 'utf8');
    return {
      file: path.relative(root, f),
      text,
      tools: statedTools(text),
      counts: statedToolCounts(text),
    };
  });
}

async function main() {
  const url = process.env.PROWL_MCP_URL || DEFAULT_URL;
  const headers = auth(process.env, process.env.HOME);
  if (!headers) {
    process.stdout.write(
      'UNKNOWN: no credential. Set PROWL_API_KEY, or PROWL_MCP_HEADER="Name: value" for a gateway.\n' +
      'tools/list requires one — the endpoint answers -32001 without it.\n');
    process.exit(0);
  }

  let tools;
  try {
    tools = await toolsList(url, headers);
  } catch (e) {
    const why = e.unauthorised ? 'the credential was refused' : e.message;
    process.stdout.write(`UNKNOWN: could not read tools/list from ${url} — ${why}\n`);
    process.exit(0);
  }

  const contract = serverContract(tools);
  const rows = readRows(ROOT);
  let allowed = null;
  try {
    allowed = require(path.join(ROOT, 'scripts', 'check-tool-count.js')).ALLOWED;
  } catch {}

  const v = verdict(rows, contract, allowed);
  for (const n of v.notes) process.stdout.write(`note  ${n.file}: ${n.detail}\n`);
  if (v.ok) {
    process.stdout.write(
      `OK: ${url} registers ${v.registered} tools; ${rows.length} page(s) name only tools it serves` +
      `${v.notes.length ? `, ${v.notes.length} note(s) above` : ''}.\n`);
    process.exit(0);
  }
  process.stdout.write(`FAIL: ${url} registers ${v.registered} tools, and the pages disagree:\n`);
  for (const f of v.failures) process.stdout.write(`  ${f.file}: ${f.detail}\n`);
  process.exit(1);
}

module.exports = { skillFiles, statedTools, statedToolCounts, serverContract, verdict, auth, parseBody, DEFAULT_URL };

if (require.main === module) main();
