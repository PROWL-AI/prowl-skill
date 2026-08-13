# Verification ledger — what shipped and what confirmed it

One row per requirement. `verified` means a named check was run and its output read —
not that the code looks right, and not that the suite was green somewhere nearby.

**Run** `live status widget for the Prowl plugin` · 2026-08-13 · commits `b14d7f3`,
`e9a9fdc`, `3a68234` · PR [PROWL-AI/prowl-skill#2](https://github.com/PROWL-AI/prowl-skill/pull/2)
· CI run `31722687335`, all four jobs green.

## Requirements

| REQ | What shipped | How it was confirmed | Status |
|---|---|---|---|
| R-01 | An in-flight call is visible with its tool and elapsed time | `render_test.js`: an open record with no close renders `prowl · ⟳ analyze 1:12`; a second in flight renders `+1` rather than a list | verified |
| R-02 | Async progress reaches the dock as a real fraction | `hooks_e2e_test.js`: a `prowl_session_status` body carrying `progress: 0.42` yields OSC `9;4;1;42` from the real hook process; `status: completed` yields `9;4;0` and clears the stored fraction | verified |
| R-03 | Spend is the sum of what the server reported | `state_test.js`: three closes sum to `0.0325`; a close with no billing figure leaves the total untouched; a session with no billed call reports `null`, not `0` | verified |
| R-04 | A failure and a wallet gate are said once | `hooks_e2e_test.js`: the first failure returns `systemMessage` **and** `additionalContext`; the second, same fingerprint, returns nothing — while still being counted | verified |
| R-05 | The last five calls are visible with ok / not-ok | `state_test.js`: six calls leave five entries, oldest dropped, `totals.calls` still 6 — the ticker is trimmed, the count is not | verified |
| R-06 | Counts: calls, ok, failed | `render_test.js` + `state_test.js`; counts are derived from records, never incremented in place | verified |
| R-07 | Tokens shown in the status line, from the payload | `render_test.js`: `ctx 42%` appears with `context_window`, and nothing appears without it. `hooks_e2e_test.js` asserts it end to end from a real status-line payload | verified |
| R-08 | No hook can break a turn | `hooks_e2e_test.js`: all four scripts, against no payload, a malformed payload and an empty object — exit 0, empty stdout, **empty stderr** | verified |
| R-09 | Nothing to say prints nothing | `render_test.js` for the empty state, `null` and `undefined`; `hooks_e2e_test.js` for a session that never called Prowl | verified |
| R-10 | The count is 448 and cannot silently drift | `npm run check:tools` against the live server: *448 tools; 8 file(s) agree*. Watched failing against a planted 408, offline and online, then green after the revert | verified |
| R-11 | Two hooks firing at once cannot lose a record | `state_test.js`: eight processes behind a start barrier, five writes each, all forty land. See *What went wrong* below — this row was **wrong** for one push | verified |
| R-12 | State does not accumulate forever | `state_test.js` and `hooks_e2e_test.js`: a file older than the window is pruned, a live session is not | verified |
| R-13 | The server's double-encoded envelope is followed | `live_shapes_test.js`, on bodies captured from the live server on 2026-08-13 | verified |
| R-14 | The server's own accounting is preferred, and marked | `render_test.js`: `$0.0325 billed` when `prowl_get_stats` reported it; the observed sum renders plainly and never claims to be billed | verified |
| R-15 | A billed figure is not rounded away | `render_test.js`: `$0.0325` renders as itself; `money()` checked across `0 … 12.3456` | verified |
| R-16 | The line reads like something a person wrote | `render_test.js`: `1 call`, not `1 calls`. Found by reading the installed plugin's real output | verified |

## The gate, as run

| Check | Command | Result |
|---|---|---|
| Suite, offline | `npm test` | 89 checks, 6 suites |
| Guards | `node scripts/negative-self-test.js` | 6 of 6 disarmed and watched failing; tree byte-compared on restore |
| Count vs server | `npm run check:tools` | 448; 8 files agree |
| Manifests | `claude plugin validate` × 3 | marketplace and both plugins pass |
| CI | run `31722687335` | `suite (18)`, `suite (22)`, `manifests`, `tool-count` — all green |
| Installed, end to end | the real hooks from `~/.claude/plugins/cache/prowl/prowl/0.3.0` | `pre` → `post` → session file → status line: `prowl · 1 call 1✓ · $0.0125 · ctx 42% · claude $1.20 · ▸ call_tool✓` |

## What went wrong, and what it cost

**R-13 — the adapter could not have found a single debit.** Six suites green, and the
walker stopped at the envelope. Caught by calling a free tool and reading the response,
not by any fixture. R-14 and R-15 came from the same five minutes.

**R-11 — the guard proved itself on Node 18 and not on Node 22**, and CI said so.
The fixture detected the missing lock *probabilistically*: eight processes launched in
sequence can finish in sequence, and one read-modify-write is a window measured in
microseconds. A negative self-test that fires on some runs reports a guard as proven on
a coin flip. Fixed with a start barrier and five writes per writer; verified three
times in each direction.

**R-16 — the widget said `1 calls`** the first time anyone looked at its real output.
Eighteen render fixtures, every one of them using a plural count.

Three findings, three different instruments: a live call, a CI matrix, and a person
reading a line. None of them was a fixture.

## Exposure — what shipped that nobody has confirmed

| What | How to close it |
|---|---|
| The hooks have never fired from Claude Code's own dispatcher. They have run as processes against real payload shapes and real response bodies, and the installed copy was driven end to end by hand — but the matcher firing, and the terminal honouring `terminalSequence`, are unwitnessed | Restart Claude Code with `prowl@prowl` enabled, make one free Prowl call, then read `~/.prowl/status/<session_id>.json` |
| The status line has never been rendered by Claude Code | Wire the `statusLine` block from the skill and look at the bottom of the terminal |

**This was measured, not assumed.** The plugin was installed mid-session and a real
free call (`prowl_list_tools`, category `ai`) was made straight afterwards:
`~/.prowl/status/` gained **no** new file. Plugins and their hooks are loaded at
session start, so the dispatcher in the session that built this could never have
carried them. The restart is a human step and it is the only one this change has.
