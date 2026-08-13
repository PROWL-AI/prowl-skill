'use strict';
/**
 * A hook payload becomes a record, or becomes nothing.
 *
 * Pure and total. Every decision this plugin makes about a tool call is a function of
 * the payload and lives here, so the suite can fixture it without a `HOME`, without a
 * network and without Claude Code — and so the hook scripts contain no judgement at
 * all, only plumbing.
 *
 * **The server's numbers, and only those.** `usd` appears when the response carried
 * `actual_cost_usd`; `progress` appears when the response carried a fraction. Neither
 * is ever estimated. A number this module could not read is an absence, and an
 * absence renders differently from a zero.
 */

/** Tools whose responses are worth reading for a fraction. */
const PROGRESS_TOOLS = new Set(['prowl_session_status', 'prowl_get_session', 'prowl_start_session']);

/** Statuses after which there is nothing left to show progress for. */
const TERMINAL_STATUS = new Set(['completed', 'complete', 'done', 'failed', 'error', 'cancelled', 'canceled']);

/** How deep to look for a `billing` object before giving up. Envelopes are shallow. */
const MAX_DEPTH = 6;

/**
 * Is this one of Prowl's tools, under either name it can have?
 *
 * A directly configured server yields `mcp__prowl__prowl_analyze`; the same server
 * shipped inside this plugin is namespaced by Claude Code and yields
 * `mcp__plugin_prowl_prowl__prowl_analyze`. Both must be recognised, and neither may
 * be recognised by a substring test that would also match somebody else's server
 * called `prowl-mirror`.
 */
function parseToolName(name) {
  if (typeof name !== 'string') return null;
  const parts = name.split('__');
  if (parts.length < 3 || parts[0] !== 'mcp') return null;
  const server = parts[1];
  const tool = parts.slice(2).join('__');
  const isProwlServer = server === 'prowl' || /(^|_)prowl$/.test(server);
  if (!isProwlServer) return null;
  if (!/^prowl_/.test(tool)) return null;
  return { server, tool };
}

/** `prowl_call_tool` → `call_tool`. The prefix is noise once the segment says `prowl`. */
function shortName(tool) {
  return typeof tool === 'string' ? tool.replace(/^prowl_/, '') : null;
}

/** Envelope keys whose value is the real body. Verified against the live server. */
const ENVELOPE_KEYS = ['result', 'content', 'data', 'response', 'output'];

/** Largest string this will attempt to parse. A report body can be very large. */
const MAX_PARSE = 512 * 1024;

/** Does this string look like it holds JSON? Cheap test before an expensive parse. */
function looksJson(s) {
  if (typeof s !== 'string' || s.length > MAX_PARSE) return false;
  const t = s.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}

/** Parse if it parses, otherwise `null`. Never throws. */
function tryParse(s) {
  if (!looksJson(s)) return null;
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' ? v : null;
  } catch (e) {
    return null;
  }
}

/**
 * Follow single-key envelopes down to the body that actually says something.
 *
 * **The live server double-encodes.** `prowl_get_stats` and `prowl_list_tools` both
 * answer `{"result": "{\n  \"session_id\": …}"}` — an object whose one key holds a
 * JSON *string*. A walker that treats `result` as a leaf stops at the doorstep, which
 * is precisely what this module did until the shape was checked against a real
 * response rather than against a fixture written from the documentation.
 */
function unwrap(node, depth) {
  let cur = node;
  for (let i = 0; i < (depth || MAX_DEPTH); i += 1) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return cur;
    const keys = Object.keys(cur);
    if (keys.length !== 1 || !ENVELOPE_KEYS.includes(keys[0])) return cur;
    const inner = cur[keys[0]];
    const parsed = typeof inner === 'string' ? tryParse(inner) : inner;
    if (!parsed || typeof parsed !== 'object') return cur;
    cur = parsed;
  }
  return cur;
}

/** The response body, parsed and unwrapped. A body that is not JSON is not an error. */
function parseBody(toolResponse) {
  if (!toolResponse) return null;
  const content = typeof toolResponse === 'string' ? toolResponse : toolResponse.content;
  const parsed = typeof content === 'string'
    ? tryParse(content)
    : (content && typeof content === 'object' ? content : null);
  return parsed ? unwrap(parsed, MAX_DEPTH) : null;
}

/**
 * The debited amount, wherever the envelope put it.
 *
 * `actual_cost_usd` is the figure the server says it took; `estimated_cost_usd` sits
 * beside it in the same object and is deliberately NOT read — an estimate displayed
 * next to real debits is the number that gets believed.
 */
function findUsd(node, depth) {
  if (!node || depth > MAX_DEPTH) return null;
  // A nested JSON string is a branch, not a leaf: the server encodes bodies that way.
  if (typeof node === 'string') return findUsd(tryParse(node), depth + 1);
  if (typeof node !== 'object') return null;

  const billing = typeof node.billing === 'string' ? tryParse(node.billing) : node.billing;
  if (billing && typeof billing === 'object') {
    const v = billing.actual_cost_usd;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  if (typeof node.actual_cost_usd === 'number' && Number.isFinite(node.actual_cost_usd)) {
    return node.actual_cost_usd;
  }
  for (const key of Object.keys(node)) {
    const found = findUsd(node[key], depth + 1);
    if (found !== null) return found;
  }
  return null;
}

/**
 * The server's own accounting, when `prowl_get_stats` is what came back.
 *
 * Strictly better than the sum this plugin keeps: it is what Prowl says it charged
 * and how many tokens its own pipeline burned, rather than what one session happened
 * to observe. Recorded separately and never merged into the sum — two numbers that
 * disagree are information, and averaging them away would destroy it.
 */
function findServerTotals(body) {
  if (!body || typeof body !== 'object') return null;
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const out = {
    usd: num(body.tool_cost_usd),
    total_usd: num(body.total_cost_usd),
    tokens: num(body.total_tokens),
    calls: num(body.tool_calls_count),
  };
  return Object.values(out).some((v) => v !== null) ? out : null;
}

/** A fraction, and only if it really is one. `0` is a real progress value. */
function findProgress(body) {
  if (!body || typeof body !== 'object') return null;
  const v = body.progress;
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1) return v;
  return null;
}

/**
 * Did this call fail, and was it the wallet that stopped it?
 *
 * The wallet case is recognised by wording **and** by shape, because either alone is
 * brittle: a code field can be renamed and a message can be rephrased, and a check
 * resting on one of them silently stops firing when that happens.
 */
function findError(toolResponse, body) {
  const typed = toolResponse && toolResponse.type === 'error';
  const bodyError = body && (body.error || body.isError === true);
  if (!typed && !bodyError) return null;

  const text = [
    toolResponse && typeof toolResponse.content === 'string' ? toolResponse.content : '',
    body && typeof body.error === 'string' ? body.error : '',
    body && body.error && typeof body.error.message === 'string' ? body.error.message : '',
    body && typeof body.message === 'string' ? body.message : '',
  ].join(' ');

  const code = (body && (body.code || (body.error && body.error.code))) || '';
  const gate = /insufficient[\s_-]*(balance|funds|credit)/i.test(text)
    || /\bwallet\b[^.]{0,40}\b(empty|balance|insufficient)\b/i.test(text)
    || /insufficient[_-]?balance/i.test(String(code));

  return { gate, message: text.trim().slice(0, 300) || 'the call failed with no message' };
}

/**
 * A stable fingerprint for "have we already said this?".
 *
 * The tool plus the class of failure, never the message: a message carrying an id or
 * a timestamp would be a new fingerprint every time, and the once-only rule would
 * quietly become a rule that says everything.
 */
function fingerprint(tool, error) {
  if (!error) return null;
  return `${tool || 'unknown'}:${error.gate ? 'wallet-gate' : 'error'}`;
}

/**
 * The payload, classified.
 *
 * Returns `null` for anything that is not a Prowl tool call — which is almost every
 * payload this process will ever see, and the cheapest possible answer for it.
 */
function classify(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const parsed = parseToolName(payload.tool_name);
  if (!parsed) return null;

  const id = typeof payload.tool_use_id === 'string' ? payload.tool_use_id : null;
  if (!id) return null;

  const base = { tool: parsed.tool, short: shortName(parsed.tool), id };

  if (payload.hook_event_name === 'PreToolUse') {
    return Object.assign(base, { kind: 'open' });
  }

  const body = parseBody(payload.tool_response);
  const error = findError(payload.tool_response, body);
  const rec = Object.assign(base, {
    kind: 'close',
    ok: !error,
    usd: findUsd(body, 0),
    error,
    fingerprint: fingerprint(parsed.tool, error),
  });

  if (parsed.tool === 'prowl_get_stats') {
    const server = findServerTotals(body);
    if (server) rec.server = server;
  }

  if (PROGRESS_TOOLS.has(parsed.tool)) {
    const p = findProgress(body);
    if (p !== null) {
      rec.progress = p;
      rec.progress_session = (body && typeof body.session_id === 'string') ? body.session_id : null;
    }
    // The bar belongs to the async session, not to the poll that read it. Without a
    // terminal status the caller would have to guess when to take it down, and the
    // obvious guess — "when this tool call ends" — takes it down after every poll.
    const status = body && typeof body.status === 'string' ? body.status.toLowerCase() : null;
    if (status) {
      rec.status = status;
      rec.finished = TERMINAL_STATUS.has(status);
    }
  }
  return rec;
}

module.exports = {
  classify, parseToolName, shortName, parseBody, unwrap, tryParse, looksJson,
  findUsd, findProgress, findError, findServerTotals, fingerprint,
  PROGRESS_TOOLS, TERMINAL_STATUS, ENVELOPE_KEYS,
};
