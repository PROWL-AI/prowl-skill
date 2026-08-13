'use strict';
/**
 * Records become a line, a notice, or nothing.
 *
 * Three rules, inherited rather than invented, because each one has already been got
 * wrong somewhere and the fix is cheaper than the rediscovery:
 *
 * 1. **Every number is borrowed.** Nothing here computes a figure it was not handed.
 *    The one arithmetic this module does is formatting.
 * 2. **Absent is a word, never a zero.** `$—` says the server has reported no charge;
 *    `$0.00` says it charged nothing. A renderer that prints them alike turns "we do
 *    not know" into "it was free".
 * 3. **Nothing to say prints nothing.** An empty string is the honest rendering of a
 *    session that has not called Prowl, and it is better than a line that says `0`
 *    in a repository where the plugin was never used.
 *
 * Pure: state in, string out.
 */

const SEP = ' · ';

/** `12s`, `1:12`, `1h 05m` — the coarsest unit that is still true. */
function elapsed(fromISO, nowMs) {
  const from = Date.parse(fromISO || '');
  if (!Number.isFinite(from) || !Number.isFinite(nowMs) || nowMs < from) return null;
  const s = Math.floor((nowMs - from) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}:${String(s % 60).padStart(2, '0')}`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/**
 * Money, at the precision the amount deserves.
 *
 * Two cents of rounding is nothing on a bill and everything on a **unit price**: a
 * metered call at `$0.0325` shown as `$0.03` is off by seven percent, and a hundred of
 * them are off by three dollars. So under a dollar the figure keeps four decimals,
 * trailing zeros trimmed to two so `$0.31` does not become `$0.3100`; above a dollar
 * the cents are the whole story.
 *
 * Caught by a fixture asserting the server's own billed figure and getting `$0.03`
 * back — the same class as printing an absence as a zero, one decimal place down.
 */
function money(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  if (v === 0) return '$0.00';
  if (v >= 1) return `$${v.toFixed(2)}`;
  const four = v.toFixed(4).replace(/(\.\d\d[1-9]?)0+$/, '$1');
  return `$${four}`;
}

/** The in-flight calls, oldest first — the one that has been waiting longest leads. */
function inFlight(state) {
  const open = (state && state.open) || {};
  return Object.keys(open)
    .map((id) => ({ id, tool: open[id].tool, at: open[id].at }))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

/** `call_tool` from `prowl_call_tool`; whatever it is when it is not that. */
function short(tool) {
  return typeof tool === 'string' ? tool.replace(/^prowl_/, '') : '?';
}

/**
 * The ticker: the last calls, newest first, each with its verdict.
 *
 * Newest first because the question a ticker answers is "what just happened", and
 * the answer should not be at the end of a line that may be truncated.
 */
function ticker(state, limit) {
  const recent = (state && state.recent) || [];
  const n = typeof limit === 'number' ? limit : recent.length;
  return recent.slice(-Math.max(0, n)).reverse()
    .map((r) => `${short(r.tool)}${r.ok ? '✓' : '✗'}`)
    .join(' ');
}

/**
 * One row, or `''`.
 *
 * `opts.cost` and `opts.context` are the status-line payload's own objects; no hook
 * event carries them, so a caller that has none simply omits those segments rather
 * than filling them in.
 */
function line(state, opts) {
  const o = opts || {};
  const s = state || {};
  const totals = s.totals || {};
  const running = inFlight(s);
  const calls = typeof totals.calls === 'number' ? totals.calls : 0;

  // Nothing has happened and nothing is happening: say nothing.
  if (!calls && !running.length) return '';

  const parts = ['prowl'];

  if (running.length) {
    const head = running[0];
    const since = elapsed(head.at, o.now);
    const more = running.length > 1 ? ` +${running.length - 1}` : '';
    parts.push(`⟳ ${short(head.tool)}${since ? ` ${since}` : ''}${more}`);
  }

  if (calls) {
    const ok = typeof totals.ok === 'number' ? totals.ok : 0;
    const failed = typeof totals.failed === 'number' ? totals.failed : 0;
    parts.push(`${calls} calls ${ok}✓${failed ? ` ${failed}✗` : ''}`);
    // The server's own figure wins when it volunteered one — it is what Prowl says it
    // charged, against what this session happened to observe. Marked, so the two are
    // never read as the same claim.
    const server = s.server && typeof s.server.usd === 'number' ? money(s.server.usd) : null;
    // `$—` is not `$0.00`: the first says no response has reported a charge, the
    // second says a response reported one and it was nothing.
    parts.push(server ? `${server} billed` : (money(totals.usd) || '$—'));
  }

  if (s.progress && typeof s.progress.value === 'number') {
    parts.push(`${Math.round(s.progress.value * 100)}% done`);
  }

  const used = o.context && typeof o.context.used_percentage === 'number'
    ? Math.round(o.context.used_percentage) : null;
  if (used !== null) parts.push(`ctx ${used}%`);

  const claude = o.cost && typeof o.cost.total_cost_usd === 'number' ? money(o.cost.total_cost_usd) : null;
  if (claude) parts.push(`claude ${claude}`);

  const tick = ticker(s, o.tickerLimit);
  if (tick) parts.push(`▸ ${tick}`);

  return fit(parts, o.columns);
}

/**
 * Join, and drop from the end until it fits the terminal.
 *
 * The status-line reference is explicit that a script cannot read the terminal width
 * itself and must use `COLUMNS`. Where the caller knows it, the ticker is shed first:
 * it is the segment whose absence costs the least, and the segments before it answer
 * questions the ticker does not.
 */
function fit(parts, columns) {
  const width = typeof columns === 'number' && columns > 20 ? columns : null;
  let out = parts.join(SEP);
  if (!width) return out;
  const kept = parts.slice();
  while (kept.length > 1 && visibleLength(out) > width) {
    kept.pop();
    out = kept.join(SEP);
  }
  return out;
}

/** Length as the terminal sees it: the glyphs used here are all single-width. */
function visibleLength(text) {
  return Array.from(String(text || '')).length;
}

/**
 * The chat notice for the two things worth interrupting for.
 *
 * Everything else this plugin knows belongs on the status line, where it costs the
 * reader nothing. A notice that fires on every finished call is a notice that gets
 * skimmed, and then the wallet gate is skimmed with it.
 */
function block(record) {
  if (!record || record.ok !== false || !record.error) return '';
  const tool = short(record.tool);
  if (record.error.gate) {
    return `[prowl] \`${tool}\` was stopped before it ran: the wallet has no balance for it. `
      + 'Nothing was charged. Top up at MCP Home (https://prowl.chat) — or run the free '
      + 'catalogue tools (`prowl_list_tools`, `prowl_search_tools`, `prowl_tool_info`) meanwhile.';
  }
  return `[prowl] \`${tool}\` failed: ${record.error.message}`;
}

module.exports = { line, block, ticker, elapsed, money, inFlight, short, fit, visibleLength, SEP };
