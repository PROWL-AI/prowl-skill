# Brief — a Prowl call stops being invisible while it runs

**Run** `live status widget for the Prowl plugin` · 2026-08-13 · operator-confirmed at
stage 0 · model `claude-opus-5[1m]`

A `prowl_analyze` call runs 30 seconds to 5 minutes; an async research session runs
longer. For all of that time the operator sees a spinner, and the money it costs
appears only inside a response body nobody reads. This run makes both visible —
in the terminal, not only in the chat transcript.

## Source ledger

| Source | Consulted | What it gave |
|---|---|---|
| This repository | yes | 13 files, zero code, zero tests, zero CI. `plugins/prowl/.mcp.json`, both `SKILL.md`, both plugin manifests, two marketplace manifests |
| `CLAUDE.md`, ADRs, `docs/` | **none found** | the repository had no documentation root before this run |
| Retro / backlog / verification ledger | **none found** | no run has been recorded here |
| Code graph `graphify-out/` | **none found** | nothing to query for reach; the repository is small enough to read whole |
| Hosted Prowl doc `prowl.chat/mcp/skill.md` | yes | 28 KB, 45 sections; `prowl_session_status` returns live `progress` 0..1 (`:314`), `prowl_analyze` emits progress events every ~15 s (`:150`), `prowl_call_tool` responses carry a `billing` object |
| Live server `prowl.chat/mcp/health` | yes | `{"status":"ok","server":"prowl_mcp","version":"1.4.0","transport":"streamable-http","endpoint":"/mcp"}` — **and no tool counts**, though the hosted document claims this endpoint returns them (carry-over C-03) |
| Hosted `skill.md:122` | yes | `## Tools (22 registered tools — 20 logical + 2 legacy aliases → 448 API tools)` — the count this repository states as **408** in 8 files. This line, not `/mcp/health`, is where 448 comes from |
| Claude Code hooks reference | yes | payload and output fields per event — see *Contracts learned at stage 1* |
| Claude Code status line reference | yes | the stdin payload, the update triggers, `refreshInterval` |
| `sshlg-skills` (reference only, not modified) | yes | the working pattern: pure logic in `lib/`, a hook that only moves bytes, silent failure, every number borrowed, state keyed by `session_id` |

## Contracts learned at stage 1, not from recall

| Contract | Consequence for this design |
|---|---|
| `PostToolUse` delivers `tool_response` as `{type:"text"\|"error", content:string}` | the billing object and the progress number arrive as **text**; the adapter parses defensively and never throws |
| `tool_response.type` is `"error"` on a failed call | `PostToolUse` alone closes every record — no dependency on `PostToolUseFailure` |
| `PreToolUse`/`PostToolUse` carry `tool_use_id`; matchers are unanchored JS regexes and `mcp__.*` matches MCP tools | a call is correlated start→end by id, never by a stack that a nested call would corrupt |
| Hook events carry no token counts | tokens can only be shown by the status line, whose payload has `context_window.*`. Stated as a boundary, not worked around |
| `statusLine` is not a field any `plugin.json` declares | a plugin **cannot** ship the bottom line; it ships hooks, and the line is opt-in |
| Status-line updates "go quiet when the main session is idle, for example while a coordinator waits on background subagents" | without `refreshInterval` the elapsed timer freezes in exactly the case the widget exists for |
| The status-line doc prescribes caching keyed by `session_id`, because pid-based keys change per invocation | the session file is keyed by `session_id`, and that is the documented shape rather than a convenience |

## Decisions

| id | Decision | Why |
|---|---|---|
| D-01 | Hooks ship in the plugin (`hooks/hooks.json`); the status line is opt-in | a plugin cannot declare `statusLine`, and nothing here may write into the operator's `settings.json` without being asked |
| D-02 | State lives in `~/.prowl/status/<session_id>.json` | `~/.prowl/` is already this plugin's home on the machine — the token file lives there. Not in the repository, not in the project tree |
| D-03 | Money is **borrowed**: only `billing.actual_cost_usd` as the server returned it | an estimate presented beside real debits is the number that gets believed |
| D-04 | Tokens appear only in the status line | no hook event carries them; showing them elsewhere would mean inventing them |
| D-05 | The repository gains code, tests and CI | a hook that throws breaks every turn of every session that installed this plugin, including sessions doing something else entirely |
| D-06 | The `408 → 448` correction ships in this run, as its own commit, with a check | the number was restated in 8 files and had nothing to keep it true |

## REQ table

Frozen at stage 0. Adding is free; removing needs the operator.

| id | Requirement | How it is verified |
|---|---|---|
| R-01 | An in-flight Prowl call is visible, with the tool's name and how long it has been running | fixture: a `PreToolUse` record with no `PostToolUse` renders `⟳ <tool> <elapsed>` |
| R-02 | An async session's progress reaches the dock/taskbar as a real fraction | fixture: `prowl_session_status` response carrying `progress: 0.42` yields OSC `9;4;1;42`; a response without one yields no sequence |
| R-03 | Money spent this session is the sum of what the server reported | fixture: three responses with `billing.actual_cost_usd` sum exactly; a response without a billing object moves nothing |
| R-04 | A failed call and a wallet block are said once, out loud | fixture: `tool_response.type === "error"` produces a `systemMessage`; the same error repeated does not produce a second one |
| R-05 | The last five calls are visible with ok / not-ok | fixture: six calls leave five entries, oldest dropped, each carrying its verdict |
| R-06 | Counts are shown: calls, ok, failed | fixture: counts are derived from the records, never incremented in place |
| R-07 | Tokens are shown in the status line, from the payload | fixture: the renderer receives `context_window` and prints it; absent, it prints nothing rather than zero |
| R-08 | No hook can break a turn | e2e fixture: every script fed a malformed payload, an empty payload and no payload at all still exits 0 and writes nothing to stderr |
| R-09 | Nothing to say means nothing printed | fixture: a session with no Prowl calls renders an empty string |
| R-10 | The tool count is 448 and cannot silently drift again | the count is asserted against `prowl.chat/mcp/health` by a check outside the offline suite |
| R-11 | A record cannot be corrupted by two hooks firing at once | fixture: concurrent writes leave a parsable file with both records |
| R-12 | State does not accumulate forever | fixture: `SessionStart` prunes files older than the retention window |
| R-13 | The server's **double-encoded** envelope is followed to the real body | `test/live_shapes_test.js`, on bodies captured from the live server: `{"result":"<a JSON string>"}`. Added at stage 6 — see below |
| R-14 | The server's own accounting is preferred over the observed sum, and marked as the server's | fixture: `prowl_get_stats` totals render as `$X billed`; without them the observed sum renders plainly |
| R-15 | A billed figure is not rounded away | fixture: `$0.0325` renders as itself, not as `$0.03` |

### Why R-13 to R-15 exist, and what that says about the ones above them

**R-13 is a defect this run shipped and then caught by looking at the artefact.** The
fixtures for the adapter were written from the hosted document, which describes a
`billing` object, and they passed. The live server answers
`{"result":"{\n  \"session_id\": …}"}` — one key, holding a JSON **string**. The
walker treated `result` as a leaf, stopped at the doorstep, and would have reported
`$—` for every metered call for as long as the plugin existed, with six suites green
the whole time.

It was found by calling a free tool and reading what came back. Not by a fixture: a
fixture encodes the case its author imagined, and its author had imagined the
documentation.

R-14 and R-15 followed from the same five minutes — the real `prowl_get_stats` body
carries the server's own `tool_cost_usd` and token counts, which are better numbers
than a sum this plugin keeps; and asserting one of them surfaced `$0.0325` rendering
as `$0.03`, which is the "absence reads as zero" defect one decimal place down.

**All three are now planted against** in `scripts/negative-self-test.js`, so the next
rewrite of any of them turns the suite red rather than quietly shipping.

## Carry-over ledger

| id | What | Raised at | Why not here | Home |
|---|---|---|---|---|
| C-01 | Background subagents: a `Task` started with `run_in_background` returns from `PostToolUse` immediately while the agent keeps working, so "in flight" cannot be derived from tool calls alone for that case | stage 2 | This run watches Prowl's own tools, where the boundary is exact. Counting background agents needs `SubagentStop` correlation that this scope does not include | backlog |
| C-02 | The repository states `22 MCP tools` and lists 20 of them; `prowl_list_sessions`, `prowl_test_tool` and the `prowl_get_tool_info` alias appear in the live server but in no table here | stage 0 harvest | Documentation drift of the same class as D-06 but in a different file section; fixing it inside a widget run would hide it | backlog |
| C-03 | `/mcp/health` does not return the tool counts its own hosted document claims it returns | stage 1 | Server-side, not in this repository | upstream |
