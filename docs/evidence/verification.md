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

---

# Run 2 — npx distribution

**Run** `npx installs it, and a tag publishes it` · 2026-08-13 · commits `013faba`,
`80a3775` · PR [#3](https://github.com/PROWL-AI/prowl-skill/pull/3), merged `c622978`
· release run `31727838433`.

| REQ | What shipped | How it was confirmed | Status |
|---|---|---|---|
| D-01 | `npx @prowl-ai/prowl-skill` installs the plugins | driven from a clean directory against the **published** package: `npx --yes @prowl-ai/prowl-skill@latest install` added the marketplace and installed both plugins | verified |
| D-02 | The installer never copies a skill where a plugin belongs | `installer_test.js`: `plain` refuses where the marketplace exists and creates nothing; planted against in the guard suite | verified |
| D-03 | A status line set by somebody else is never taken silently | `installer_test.js`, both directions: refused without `--force`, replaced with it, and unrelated settings preserved | verified |
| D-04 | Nothing is written to settings without a verified backup | `installer_test.js`: the copy is read back and compared; an absent file is a success with no copy | verified |
| D-05 | A key is never echoed and never stored malformed | `installer_test.js`: a bad key is refused with exit 2; a good one lands at mode `600` and appears in no output | verified |
| D-06 | `--dry-run` changes nothing | `installer_test.js` compares the home directory before and after | verified |
| D-07 | A `v*` tag publishes, and nothing else does | release run `31727838433`: eleven steps green, `+ @prowl-ai/prowl-skill@0.4.0` with a provenance statement in the sigstore transparency log | verified |
| D-08 | The version cannot drift across seven surfaces | `version_sync_test.js`, planted against by disarming one plugin manifest | verified |
| D-09 | The published package actually runs | `npx --yes @prowl-ai/prowl-skill@latest --version / --help / status` from an empty directory on a real machine | verified |
| D-10 | This machine consumes releases, not a working tree | the marketplace was re-pointed to `{"source":"github","repo":"PROWL-AI/prowl-skill"}`, and the reinstalled copy carries the widget including the `1 call` fix | verified |

## What went wrong

**The first release cut a GitHub release and published nothing.** `gh secret set
NPM_TOKEN` with no value, run without a TTY, reads stdin, gets nothing, and stores an
**empty** secret — which `gh secret list` then reports as present. The only visible
symptom was `NODE_AUTH_TOKEN:` with nothing after it in the job log, and that is
legible only if you know a non-empty secret prints as `***`.

It cost one false release: tag public, GitHub release published, npm empty — the exact
*looks delivered, shipped nothing* state. It cost **one re-run** rather than a manual
repair, because the release step had been made idempotent twenty minutes earlier, for
this reason, before it happened.

**The placeholder was pasted literally on the second attempt**, storing the string
`npm_ВАШ_ТОКЕН` as the secret. Non-empty, so it would have masked as `***` and failed
differently from the first attempt. Caught before the re-run by reading the command
rather than waiting for the result.

## Exposure

| What | How to close it |
|---|---|
| An npm token with publish rights to `@prowl-ai` was typed into a terminal in clear text and is recorded in one session transcript on disk. The shell histories are clean and the temp file was removed | Revoke it at npmjs.com. The release is published and the token is not needed until the next tag; issue the next one through the GitHub web UI |
| The hooks have still never fired from Claude Code's own dispatcher (carried from run 1) | Restart Claude Code, make one free Prowl call, read `~/.prowl/status/` — **closed in run 3, see below** |

---

# Run 3 — the skills against the running server

**Run** `sync the skills with the live tool contract` · 2026-08-16 · branch
`fix/skill-server-divergences`.

Every row below was confirmed against `tools/list` on `https://prowl.chat/mcp/`,
called through this machine's MCP gateway so the upstream key never left its
`secrets/`. The dump is the run's ground truth; nothing here was read out of the
hosted document, which is stale in five ways (board `B-05`).

| REQ | What shipped | How it was confirmed | Status |
|---|---|---|---|
| S-01 | The skills name `execution_mode`, not `tier` | `prowl_analyze(query, execution_mode, session_id, playbook_id)`, `prowl_start_session(query, execution_mode, title)`, `prowl_schedule_create(query, trigger_type, execution_mode, playbook_id, cadence, run_at_hour)` — read from the live schemas | verified |
| S-02 | The subscription gate and its silent downgrade are stated where the mode is chosen | `prowl_analyze`'s own description: *"'deep'/'max' require an active subscription — a caller without one is downgraded to basic and notified"* | verified |
| S-03 | Artifacts and exports are no longer conflated | `artifact_type` ∈ `infographic\|pdf\|pptx\|audio\|video`, `theme` ∈ `prowl\|prowl-gold\|prowl-light`, `format` ∈ `markdown\|html` — from the live `$defs` | verified |
| S-04 | `prowl_list_tools` is described as it answers | live schema carries `category, limit, offset, names`; the old text promised names by default | verified |
| S-05 | `prowl_list_sessions` is in the tool table | present in the live list, `(limit, offset)` | verified |
| S-06 | Resources and prompts are documented | `resources/list` → `prowl://tools`, `prowl://stats`, `prowl://report`; `prompts/list` → `competitor_analysis`, `seo_audit`, `ad_creative_research`. Three of each, read live | verified |
| S-07 | Scoped-key refusals are marked terminal, and `401`/`403` distinguished | hosted `skill.md` error table; the `401` shape reproduced by calling `/mcp` without a key (`-32001`) | verified |
| S-08 | A `prowl_` key cannot read its own balance, and no page implies it can | `/api/v1/wallet` → `401` (JWT), `/api/v1/wallet/balance` → `404`, and no registered tool returns one. The neighbouring `401` is what proves the `404` means *absent* and not *unauthorised* | verified |
| S-09 | The three tier caps are gone, replaced by sourced figures | `$2.50/$8.00/$18.00` appear in no schema, not in the hosted document, not at `/api/v1/tools/pricing` (which answers per-tool prices only); `prowl.chat/pricing` → `404`. Calls-per-run and wall-clock come from the hosted document's own mode descriptions | verified |
| S-10 | The registered count is 22, and the guard says so | `probe.sh /mcp/prowl` → *"инструментов: 22"*; the full dump lists 22 names with no `prowl_get_wallet`. `ALLOWED` back to `[22]`; `npm run check:tools` → *448 tools; 9 file(s) agree* | verified |
| S-11 | The `prowl-cli` page says which CLI it documents, above the install line | npm serves `0.1.0` and `0.1.1` only; `PROWL-AI/prowl-cli` carries one tag, `v0.1.1`; its `src/index.js` dispatcher handles `auth\|tools\|call\|analyze\|wallet\|version` | verified |

## What went wrong, and it is the worst kind

**A tool that does not exist was written into a shipped skill — and the guard was
moved to agree with it.** The previous commit on this branch added
`prowl_get_wallet` to the tool table, the billing section and the verify steps,
raised the stated count to 23, and edited `ALLOWED` in `check-tool-count.js` from
`[22]` to `[23]` with a comment explaining the move. `tools/list` returns 22 names
and none of them is `prowl_get_wallet`.

The claim was not invented. It is in the server source — the same commit cites
`mcp_server/models.effective_tier` for the downgrade, which is real and correct.
**It is deployed nowhere.** Source and deployment are different sources of truth, and
only one of them answers an agent's call.

What makes it worse than a wrong sentence: the repository's single defence against a
remembered number is that constant, and it had been re-anchored rather than
consulted. A check taught to agree with the claim it exists to test is not a weakened
check, it is a deleted one that still prints `OK`. It printed `OK` — *448 tools;
9 file(s) agree* — with 23 in eight files and 22 on the server.

The same commit rewrote `prowl-cli` for a CLI version that is not published. Same
shape, different registry: written against a working tree, shipped to people who
install from npm.

## Exposure

| What | How to close it |
|---|---|
| Nothing checks a tool name, an argument or an enum. This run found the drift by hand; the next one will only find it if someone thinks to look | Board `B-02` — `check-contract.js` against a live `tools/list` |
| Nothing binds `plugins/prowl-cli` to the `@prowl-ai/cli` version it documents. The two agreeing at `0.1.1` was a coincidence | Board `B-03` — `check-cli.js` |
| The status line has never been rendered by Claude Code (carried from run 1). The state file it reads is now confirmed written by real sessions | Board `B-07` — wire the `statusLine` block and look at the terminal |

---

# Run 4 — the CLI page against the CLI

**Run** `verify the prowl-cli page against @prowl-ai/cli 0.2.0` · 2026-08-16 · PR #7.

Source of truth: `PROWL-AI/prowl-cli` at `master` `b526d96`, `package.json` version
`0.2.0`, unreleased — npm serves `0.1.1`. Read from the repository, not from the
published tarball, because the page describes the unreleased tree; that is exactly the
gap standing instruction #5 names, so the page keeps saying so.

| REQ | What shipped | How it was confirmed | Status |
|---|---|---|---|
| C-01 | The coverage sentence is true | Every `"prowl_*"` literal in `src/` diffed against the 22-name live dump: the CLI reaches 20 of them, omits `prowl_get_tool_info` and `prowl_test_tool` (aliases of tools it already calls), and adds `prowl_get_wallet`, which the server does not register | verified |
| C-02 | `prowl wallet` is marked broken, with the mechanism | `src/commands/wallet.js:19` calls `runTool(ctx, "prowl_get_wallet", {})`; the tool is absent from `tools/list`. REST has no fallback: `/api/v1/wallet` → `401` (JWT), `/api/v1/wallet/balance` → `404` | verified |
| C-03 | Two timeouts, not one | `src/mcp.js:18-19` — `QUICK_TIMEOUT_MS = 60_000`, `LONG_TIMEOUT_MS = 900_000`; `mcp.js:51` defaults to quick, and only `analyze.js`, `call.js` and `report.js` (artifact, export) pass the long one | verified |
| C-04 | Four key sources, in order | `src/config.js:25-35` — explicit, `PROWL_API_KEY`, `~/.prowl/prowl_mcp_token`, `~/.codex/prowl_mcp_token`, first non-empty wins | verified |
| C-05 | Missing flags added | `--trigger`/`--hour` at `schedule.js:13,17`; `--limit`/`--offset` at `schedule.js:22` and `session.js:36`; `--source`/`--class`/`--offset` at `report.js:60-65`; `--server-path` at `report.js:46` | verified |
| C-06 | `--watch` behaviour stated | `session.js:9` `DEFAULT_INTERVAL_S = 10`; `session.js:70` writes the id to stderr before the first sleep | verified |
| C-07 | The caps disagreement is named rather than silently dropped | `src/index.js:53` states them in the shipped banner; `src/commands/analyze.js:16` cites the pricing page as their origin; `prowl.chat/pricing` → `404`. Board `B-09` | verified |
| C-08 | The upstream defect is filed where it can be fixed | [prowl-cli#2](https://github.com/PROWL-AI/prowl-cli/issues/2) | verified |

**What the page already had right, checked and left alone:** every verb in the
dispatcher (`index.js:83-124`), the exit codes (`errors.js:1`, unchanged from 0.1.1),
`--json`/`--key`/`--quiet`/`-h`, the four environment variables (`index.js:51`), the
artifact, theme and export enums (`report.js:6-8`), and the tier values
(`analyze.js:5`).

**No divergence entry for this run.** Nothing was found that a check could have caught
and did not — the check that would have caught all of it is `B-03`, which does not
exist yet and is the next task.


---

# Run 5 — the check, and what it caught on its first run

**Run** `scripts/check-contract.js` · 2026-08-16 · PR #8.

| REQ | What shipped | How it was confirmed | Status |
|---|---|---|---|
| K-01 | Every `prowl_*` name the shipped pages state is registered | `check:contract` against the live server via the machine's MCP gateway: *23 tools; 2 page(s) name only tools it serves* | verified |
| K-02 | A name the server does not register fails the check | Watched failing twice for real, before either was fixed: `prowl_get_wallet` when it was absent, and `prowl_mcp_token` — the operator's token *file*, a false positive the exclusion now prevents. Fixtured in `contract_test.js` and planted against in the guard suite | verified |
| K-03 | A stated MCP-tool count that is not the registered count fails | `contract_test.js`; watched failing live as *states 22 MCP tools; the server registers 23* | verified |
| K-04 | `ALLOWED` in `check-tool-count.js` is checked against the server, not trusted | `contract_test.js` *the guard has a guard*; watched failing live as *ALLOWED is [22]; the server registers 23*, and planted against | verified |
| K-05 | An omission is reported and never fails the gate | `contract_test.js`: a page mentioning a tool but none of its enum values yields one note and `ok: true`. Live, it reported the two artifact themes, which were then documented | verified |
| K-06 | No credential is *unknown*, never a pass | Run with `HOME=/nonexistent` and no key: `UNKNOWN`, exit 0. Fixtured in `auth()` | verified |
| K-07 | The check runs where the key is not on disk | `PROWL_MCP_HEADER="x-agw-key: …"` against `http://127.0.0.1:4000/mcp/prowl`; the upstream key never left the gateway's `secrets/` | verified |
| K-08 | `prowl_get_wallet` is registered, and the pages say what it returns | `tools/list` returns it with an empty input schema; the hosted document's section 21 gives the response shape quoted in both pages | verified |

## What the run found that it was not looking for

**The deployment changed underneath a correction.** v0.5.1 removed `prowl_get_wallet`
after three sources agreed it did not exist — the hosted document, this session's
registered tool list, and a live `tools/list` through the gateway. Roughly an hour
later the same call returned 23 names including it, and the hosted document had grown
by ~2.8 KB.

Both states were measured; neither was a mistake. The lesson is not *the correction
was wrong* — it is that **agreement among sources at a point in time is not a standing
fact about a service somebody else deploys**, and the only durable answer is a check
that re-asks on every run. That check now exists, and this is how it announced itself.

## Exposure

| What | How to close it |
|---|---|
| Nothing binds `plugins/prowl-cli` to the `@prowl-ai/cli` version it documents (carried) | Board `B-03` — `check-cli.js`, the next task |
| No check catches an argument name the server does not accept — the class that started all of this. Two attempts written, run and cut | Board `B-10`; the fix is a machine-readable association in the pages, not a third regex |
| `negative-self-test.js` still fails intermittently for reasons unknown (carried) | Board `B-08`; it now prints what it judged red |

---

# Run 6 — the CLI page bound to the CLI

**Run** `scripts/check-cli.js` · 2026-08-16 · PR #9.

| REQ | What shipped | How it was confirmed | Status |
|---|---|---|---|
| L-01 | The page names the CLI release it describes, in a field, distinct from the plugin's own version | `metadata.documents_cli: "0.2.0"` beside `metadata.version: "0.2.4"`; `documentedVersion()` fixtured. `version_sync_test` still finds exactly seven surfaces — its regex anchors on `^\s*version:` and does not see the new key | verified |
| L-02 | The field and the prose cannot drift apart | `verdict` fails when they disagree; fixtured | verified |
| L-03 | A verb the page states and the CLI does not ship fails | fixtured; and the real case is on record — two releases of this page listed seven verbs a six-verb binary did not have | verified |
| L-04 | A verb the CLI ships and the page omits is a note, not a failure | fixtured. Live: **zero** notes — the page states exactly the thirteen verbs `0.2.0` ships | verified |
| L-05 | Verbs come from fenced blocks, not prose | fixtured against `Use the sibling \`prowl\` plugin`, which a wider scan turns into a verb called *plugin*; planted against in the guard suite | verified |
| L-06 | Exit codes are compared | fixtured; live, the page's `0..5` matches the shipped `EXIT` map | verified |
| L-07 | An unpublished documented version is `BLOCKED`, not failed — and fatal at the tag | fixtured both ways; `release.yml` runs `--release` before it validates a manifest; planted against | verified |
| L-08 | A parser that finds nothing says so | `main()` reports UNKNOWN below four verbs rather than declaring every documented command missing | verified |
| L-09 | `@prowl-ai/cli` 0.2.0 is published | `npm view` → versions `0.1.0, 0.1.1, 0.2.0`, `dist-tags.latest = 0.2.0`; verbs read from the tarball: analyze, artifact, auth, call, errors, export, playbooks, schedule, session, stats, tools, version, wallet | verified |
| L-10 | The check is green against the real package | `npm run check:cli` → *documents @prowl-ai/cli@0.2.0, which npm serves, and states only commands it ships* | verified |

## Exposure

| What | How to close it |
|---|---|
| **The `contract` CI job reports `UNKNOWN` on every run** — the `PROWL_API_KEY` repository secret is not set, so the check that would have caught this session's worst defect is inert in CI. It is green, and green here means *nothing was checked* | Set the secret. Until then the check only runs where somebody runs it by hand |
| No check catches an argument name the server does not accept (carried) | Board `B-10` |
| `negative-self-test.js` still fails intermittently, undiagnosed (carried) | Board `B-08` |
| The status line has never been rendered by Claude Code (carried from run 1) | Board `B-07` |

---

# Run 7 — the release starts itself, and the audit's gaps close

**Run** `auto-tag, validate gating, /skill-audit gaps` · 2026-08-16 · PR #10.

| REQ | What shipped | How it was confirmed | Status |
|---|---|---|---|
| A-01 | A merge that bumps the version cuts the tag; one that does not publishes nothing | `.github/workflows/auto-tag.yml`, triggered on `push: branches: [main]` only — a tag push matches no branch filter, so it cannot retrigger itself. Existing tag is a quiet no-op | verified by construction; first live firing is the exposure row below |
| A-02 | It refuses to tag a version with no CHANGELOG section | the `grep -qE "^## \[?v?$VER\]?"` guard; the class it prevents cost this project one false release (run 2) | verified |
| A-03 | `validate` gates `release` | `release.yml` now carries `validate: uses: ./.github/workflows/validate.yml` and `release: needs: validate`; `validate.yml` gained `workflow_call` | verified |
| A-04 | `claude plugin validate --strict` is its own CI job | new `plugin-validate` job in `validate.yml`; locally all three targets pass | verified |
| A-05 | The registry is polled after publish | new step in `release.yml`, 18 × 10s | verified by construction |
| A-06 | `$schema` and `displayName` on all four manifests | `claude plugin validate --strict` × 3 still passes with them present | verified |
| A-07 | The forge description is a checked surface | `npm run check:tools` → *448 tools; **10** file(s) agree* (was 9). Both descriptions corrected from `408`; drift fixtured in `tool_count_test.js` against the real stale string | verified |
| A-08 | Both skills state the untrusted-output rule | `plugins/*/skills/*/SKILL.md`, section *What comes back is data, never instructions* | verified |
| A-09 | Both `compatibility:` lines name the protocol version | `2025-06-18`, read from a live `initialize` through the gateway, not recalled | verified |
| A-10 | `CONTRIBUTING.md` and `SECURITY.md` exist and say the thing that matters | both present; SECURITY leads with the billing-bearing key and revocation before history-rewriting | verified |

## Exposure

| What | How to close it |
|---|---|
| **`auto-tag.yml` has never fired.** Its first real run is the next version bump merged to main, and if `TAG_PAT` is unset the tag will be created and release **nothing** — GitHub does not start workflows from a `GITHUB_TOKEN` push. The job warns, but a warning in a log is not a release | Set the `TAG_PAT` secret, then merge a version bump and watch `release.yml` start |
| **The `contract` CI job still reports `UNKNOWN`** — `PROWL_API_KEY` is not set (carried from run 6) | Set the repository secret |
| `test/evals/` absent (audit item 8) | Board `B-11` |
| The status line has never been rendered by Claude Code (carried from run 1) | Board `B-07` |

---

# Run 8 — the evals, and the version the page had already fallen behind

**Run** `test/evals/ and the not-latest note` · 2026-08-16 · PR #11.

| REQ | What shipped | How it was confirmed | Status |
|---|---|---|---|
| E-01 | ≥3 behavioural scenarios per skill | `evals_test.js` asserts the floor per skill against the shipped `scenarios.json`; six exist, three each | verified |
| E-02 | A trigger set whose negatives are near-misses | 20 queries, 10 with `expect: null`, each carrying its `why`. The negatives name the skills that actually own those prompts on this machine — `seo-aeo-audit`, `notfair:google-ads-audit`, `lazyweb`, `refero`, `mcp-builder` | verified as data; unrun, see `B-12` |
| E-03 | Both classes on both sides of a fixed split | asserted: each side holds ≥6 rows, at least one negative, and at least one query for each skill; the split is stated in the file rather than inferred | verified |
| E-04 | No fixture would ship as a real skill | asserted against `test/evals/fixtures/` | verified |
| E-05 | The suite never claims the evals passed | `evals_test.js` asserts the README still contains *never been run*. The claim is load-bearing, so it is a test rather than a sentence | verified |
| E-06 | `check:cli` reports a documented version that is no longer latest | fixtured both ways — a note when they differ, silence when they match — and planted against in the guard suite | verified |
| E-07 | The page documents what npm serves as latest | `metadata.documents_cli` and the prose now read `0.2.1`; `npm run check:cli` → *documents @prowl-ai/cli@0.2.1, which npm serves* | verified |

## The honest limit of this run

**Nothing here measures skill behaviour.** The evals are data and the suite checks the
data's shape. A green `npm test` after this change means the twenty queries are
well-formed and the six scenarios are describable — not that either skill fires
correctly on any of them, and not that a model refuses the injected instruction in
`fixtures/scraped-page-with-injection.txt`.

That gap is `B-12` and it is deliberate rather than deferred by accident: running them
means three tiers × three repetitions × twenty queries against a live agent, and
guessing the outcome would be worse than leaving the row open.

## Exposure

| What | How to close it |
|---|---|
| The evals have never been run against a model (new) | Board `B-12` |
| **`TAG_PAT` is unset in both repositories**, so `auto-tag` cuts a tag that releases nothing. Observed twice today; both releases were dispatched by hand | Set the secret in `prowl-skill` and `prowl-cli` |
| The `contract` CI job reports `UNKNOWN` — `PROWL_API_KEY` unset (carried) | Set the repository secret |
| `negative-self-test.js` fails intermittently, undiagnosed (carried) | Board `B-08` |
| The status line has never been rendered by Claude Code (carried from run 1) | Board `B-07` |
