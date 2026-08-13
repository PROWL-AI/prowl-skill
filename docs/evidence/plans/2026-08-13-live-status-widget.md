# Plan — the live status widget

Tasks in build order. The walking skeleton is T2+T3: a call opens a record and closes
it, and nothing is printed. Everything after that adds a segment to a mechanism that
already works.

Set comparison: brief REQs `R-01…R-12` == the union of `Implements:` below.

---

## T1 — the tool count stops being a restated number

`408 → 448` across the 8 files that carry it, plus `scripts/check-tool-count.js`,
which fetches `prowl.chat/mcp/skill.md` and fails when the repository's number and the
server's disagree. Outside `npm test`, which must run offline; wired into CI as its own
step.

**Implements:** R-10
**Verified by:** the check run against the live server, and against a planted wrong
number that must make it exit non-zero.

## T2 — `lib/state.js`

Read, `open`, `close`, `prune`. Atomic write through a temp file and `rename`. An
unparsable file reads as an empty state. `close` moves a record from `open` into
`recent`, trims `recent` to five, and adds to `totals` only what it was given.

**Implements:** R-05, R-06, R-11, R-12
**Verified by:** fixtures for the six-call trim, for a `usd`-less close leaving the
sum untouched, for two writers in the same millisecond, for a corrupt file, and for
pruning by age.

## T3 — `lib/prowl.js`

`classify(payload)`. Pure, total, never throws. Extracts `usd`, `progress`, `error`
and `gate` when the body proves them and returns absence when it does not.

**Implements:** R-01, R-03, R-04
**Verified by:** fixtures over a real `prowl_call_tool` billing body, a
`prowl_session_status` body with and without `progress`, a non-JSON body, an error
response, and an insufficient-balance body.

## T4 — `lib/render.js` and `lib/osc.js`

`line()`, `block()`, and the two allowlisted sequences.

**Implements:** R-02, R-07, R-09
**Verified by:** fixtures asserting `''` for an empty state, `$—` versus `$0.00`,
a progress fraction becoming `OSC 9;4;1;42`, no fraction becoming no sequence, and a
token segment that disappears when `context_window` is absent.

## T5 — the three hook scripts and `hooks.json`

Each reads stdin, calls one pure function, writes at most one JSON object, exits 0.
Matchers: `mcp__prowl__.*` on both tool events.

**Implements:** R-08
**Verified by:** e2e fixtures that run the real scripts as processes against a real
temporary `HOME` — malformed payload, empty payload, no payload at all, and a full
open→close pair that leaves a readable file.

## T6 — `statusline/prowl-statusline.js`

Reads its payload's `session_id`, the session file, and the payload's `cost` and
`context_window`. Prints one line or nothing.

**Implements:** R-07
**Verified by:** a fixture feeding a real status-line payload shape and asserting the
line, plus the empty case.

## T7 — tests, `package.json`, CI

`npm test` discovers suites rather than listing them, so a suite added and forgotten
cannot report green from a file nobody ran. CI runs the suite plus the tool-count
check. One negative self-test: with the atomic write replaced by a plain write, the
concurrency fixture must fail — a guard nobody has watched fail is not a guard.

**Implements:** every row above, by making them re-runnable
**Verified by:** the suite failing when the plant is applied, and passing when it is
removed.

## T8 — documentation, in the same change

`README.md` and both `SKILL.md` gain the widget: what it shows, what it costs
(nothing — it calls no API), and the one command that turns the status line on.
`CLAUDE.md` is created and declares the artifact root.

**Implements:** R-10 (the corrected number lands in the same files)
**Verified by:** every named command runnable and every named path resolvable.
