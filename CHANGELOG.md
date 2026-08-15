# Changelog

## v0.5.1 — 2026-08-16

Package `@prowl-ai/prowl-skill` 0.5.1 · plugins `prowl` 0.4.1, `prowl-cli` 0.2.1.

**v0.5.0 shipped a tool that does not exist.** It was audited against the server's
source; this release audits it against the server. `tools/list` on
`https://prowl.chat/mcp/` was called and read — 22 names, and the dump is quoted in
`docs/evidence/verification.md`.

Most of v0.5.0 was right and is kept: `execution_mode` in all three tools, the
subscription downgrade, `names` on `prowl_list_tools`, `prowl_list_sessions`, the
artifact and export enums. What follows is the correction, not a revert.

### Fixed

- **`prowl_get_wallet` is gone from both skills, and the count is back to 22.** It
  exists in the server source — the entitlement fields quoted for it are real there —
  and the deployment does not register it. A skill naming a tool the server does not
  serve teaches an agent a call that fails. It returns when `tools/list` returns it.

- **`ALLOWED` in `scripts/check-tool-count.js` is back to `[22]`.** v0.5.0 had moved it
  to match the tool above, so the one check standing between a remembered number and a
  shipped one had been taught to agree with the claim it exists to test. It reported
  *448 tools; 8 file(s) agree* while eight files carried a count the server has never
  served. The incident is now written into the constant's own comment.

- **No page implies a `prowl_` key can read its balance, because none can.**
  `GET /api/v1/wallet` decodes a JWT and answers `401` to an API key;
  `GET /api/v1/wallet/balance` — which the published CLI's `prowl wallet` calls —
  answers `404`. The neighbouring `401` is what proves that `404` means *absent*
  rather than *unauthorised*. Spend is legible only afterwards: the `billing` object,
  `prowl_get_stats`, or a human at MCP Home.

- **The three tier caps are removed.** `$2.50 / $8.00 / $18.00` were stated as hard
  provider-cost caps and appear in no tool schema, in the hosted `skill.md`, or at
  `/api/v1/tools/pricing`; `prowl.chat/pricing` is a `404`. Calls per run, wall-clock
  and the subscription each mode needs — all of which the sources do carry — replace
  them.

- **The `prowl-cli` page says which CLI it documents, above the install line.** It
  describes `0.2.0`; npm serves `0.1.0` and `0.1.1`, whose dispatcher knows six verbs.
  A reader following v0.5.0 would `npm install -g` a package and then be told to run
  commands it answers `Unknown command` to.

- **The guard suite prints what it judged red.** Its final check announced *the tree
  was left damaged* and showed nothing, sending the reader to `npm test`, which was
  green. See `B-08`: the failure is intermittent and undiagnosed, and it now leaves
  evidence.

### Added

- **Resources and prompts**, which no page here had mentioned: three resources
  (`prowl://tools`, `prowl://stats`, `prowl://report`) and three prompt templates
  (`competitor_analysis`, `seo_audit`, `ad_creative_research`), read from
  `resources/list` and `prompts/list` on the running server.

- **Scoped-key refusals are marked terminal.** A category allowlist or a spend limit
  produces an `Error:` no retry fixes; a revoked key answers `401` and an IP outside
  the allowlist `403`.

- **`docs/evidence/backlog.md`** — the board this project never had. Eight open rows,
  including the two checks whose absence let this through.

### Known, and not fixed here

**Do not release while `@prowl-ai/cli` 0.2.0 is unpublished** — board `B-01`. The
`prowl-cli` page is correct about the CLI in its repository and wrong about the one on
npm, and the warning at the top of the page is a stopgap, not the fix.

## v0.5.0 — 2026-08-15

Package `@prowl-ai/prowl-skill` 0.5.0 · plugins `prowl` 0.4.0, `prowl-cli` 0.2.0.

Both skills were audited against the running server rather than against each
other, and both were wrong in ways an agent acts on.

### Fixed

- **`prowl_analyze` takes `execution_mode`, not `tier`.** The `prowl` skill said
  `tier`, and had said it for two releases. An unknown key is ignored, so an
  agent following the skill sent `tier: "deep"`, got a **basic** run, was billed
  as basic, and reported back as if it had run deep. The tiers table now names
  the real parameter, for `prowl_start_session` and `prowl_schedule_create` too.

- **The subscription gate was documented nowhere.** `deep` requires an Exploit+
  subscription and `max` a Blackops+ one, and a key without it is **not
  refused** — the run silently resolves to `basic` and bills as basic
  (`mcp_server/models.effective_tier`). Both skills now state it where the tier
  is chosen, and point at `prowl_get_wallet` / `prowl wallet` for checking
  before the spend rather than inferring it from a thin report afterwards.

- **`prowl_list_tools` no longer returns names by default.** The verify step
  promised "448 tools grouped by category"; the server returns category counts
  and gives names only for `names=true` or a single `category`. The step now
  describes what actually comes back.

### Added

- **`prowl_get_wallet`** in the tool table, the billing section and the verify
  steps. It is the only surface that can read a balance for a `prowl_` key:
  `GET /api/v1/wallet` returns the same figures but decodes a JWT, and no REST
  route on the server accepts an API key. The registered MCP tool count moves
  22 → 23 with it.

- **The `prowl-cli` skill was rewritten for the CLI it now documents.**
  `@prowl-ai/cli` 0.2.0 covers all 21 logical MCP tools rather than six —
  sessions, playbooks, schedules, artifacts, export, stats and the error feed —
  so the command list, the long-run guidance (`session start --watch` for CI)
  and the exit-code advice all changed. The old page documented `prowl wallet`
  as working; it could not.

## v0.4.0 — 2026-08-13

Package `@prowl-ai/prowl-skill` 0.4.0 · plugins `prowl` 0.3.0, `prowl-cli` 0.1.1
(unchanged — the package gained an installer, the plugins did not change).

### Added

- **`npx @prowl-ai/prowl-skill`** — one command that adds the marketplace, installs
  both plugins and says what to do next. Verbs: `install`, `update`, `statusline`,
  `token`, `status`, `plain`. Every one takes `--dry-run`, which prints what it would
  do and changes nothing. Zero dependencies: it runs through `npx` on a machine that
  has agreed to nothing yet.

  **It installs the plugin rather than copying the skill**, and that is the design
  decision worth stating. The obvious shape — copy `skills/prowl/` into
  `~/.claude/skills/` — delivers the text and silently drops everything the text is
  about: the hooks and the MCP server. Worse, a plain copy of the same name shadows an
  installed plugin and serves its frozen version forever. `plain` exists for agents
  with no plugin channel and refuses to run where the plugin is installed.

  Two things it will not do quietly: it never replaces a `statusLine` somebody else
  set without `--force`, and it never writes to `~/.claude/settings.json` without
  taking a backup first and reading it back — a copy that cannot be verified cancels
  the write.

- **`release.yml`** — tag-driven publication, off by default behind the repository
  variables `RELEASE_ENABLED` and `PUBLISH_NPMJS`. A `v*` tag runs the suite and every
  guard **on the tag**, validates both plugins and the marketplace with
  `claude plugin validate --strict`, checks that the tag matches `package.json`,
  extracts the CHANGELOG section, cuts the GitHub release, packs the tarball and runs
  the installer out of it the way `npx` would, then publishes with provenance.

  A tag rather than a push to main: every commit publishing would make every
  work-in-progress state a release somebody's `npx` picks up.

- **`test/version_sync_test.js`** — the version lives in seven places. The two plugins
  are versioned independently, so the rule is agreement *within* a plugin plus
  `package.json` matching the tag. It also asserts both marketplace manifests list
  exactly the plugin directories on disk, and that the CHANGELOG has a heading the
  release workflow's pattern can find.

### Fixed

- **The CHANGELOG heading could not be extracted**, and nothing would have said so
  until after the tag was public — the class that cost a sibling project three
  releases. Found offline by the new check, before any tag existed.

- **`scripts/` shipped inside the npm tarball.** `negative-self-test.js` rewrites
  source files by design; inside a published package that is a script capable of
  mangling somebody's `node_modules`, and no consumer has any use for it.

## v0.3.0 — 2026-08-13

Package `@prowl-ai/prowl-skill` 0.3.0 · plugins `prowl` 0.3.0, `prowl-cli` 0.1.1.

### Added

- **The status widget.** A `prowl_analyze` call runs 30 seconds to 5 minutes and an
  async session runs longer; until now the terminal showed a spinner and the cost
  appeared only inside a response body nobody reads.

  The plugin now ships three observing hooks. A call opens a record keyed by its
  `tool_use_id` and closes it when the response arrives, carrying the debit the server
  reported in `billing.actual_cost_usd`. A fraction from `prowl_session_status` becomes
  a dock/taskbar progress bar, taken down when the session reports a terminal status
  rather than when a poll happens to end. A failed call and a wallet gate are said
  once per kind of failure — an agent retrying five times must not produce five
  notices — to the operator as a message and to the agent as context, so it stops
  retrying.

  **It calls no API.** Every figure was already in a response the agent received.

- **An opt-in status line**, wired by the operator in two documented commands, showing
  the in-flight call and its elapsed time, calls / ok / failed, spend, context usage,
  and the last five tools with their verdicts. A plugin cannot ship one: no plugin
  manifest declares `statusLine`. The script finds its library whether it runs inside
  the plugin or copied to a stable path, and prints nothing when it finds neither.

- **Tests and CI**, which this repository had none of. 89 checks across six suites,
  including end-to-end fixtures that run the real hook scripts as processes against
  empty, malformed and absent payloads — a hook that throws breaks the turn of every
  session that installed the plugin. Plus `scripts/negative-self-test.js`: six guards,
  each disarmed in turn, with the suite required to go red and the tree byte-compared
  on restore.

### Fixed

- **The tool count was 408 in eight files while the server served 448** — restated
  twenty times and with nothing keeping it true. Corrected, and
  `scripts/check-tool-count.js` now compares the repository's figure against
  `prowl.chat/mcp/skill.md` on every CI run. A network failure is reported as
  *unknown*, never as drift: a check that could not reach the server has learned
  nothing, and saying otherwise trains people to ignore it.

- **The adapter could not have found a single debit.** The live server double-encodes:
  `prowl_get_stats` and `prowl_list_tools` both answer `{"result": "<a JSON string>"}`.
  The walker treated `result` as a leaf and stopped there, so every metered call would
  have rendered `$—` forever — with the whole suite green, because the fixtures were
  written from the documentation and the documentation describes the inner shape.
  Found by calling a free tool and reading the response. `test/live_shapes_test.js` now
  holds the captured bodies, and the envelope-following is planted against.

- **A negative self-test that fired on a coin flip.** The lock guard proved itself on
  Node 18 and not on Node 22, and CI is what said so: the fixture detected the lost
  update probabilistically, because eight processes launched in sequence can also
  finish in sequence. A start barrier and five writes per writer make it deterministic
  — verified three times in each direction.

- **The widget said `1 calls`.** Eighteen render fixtures, every one of them using a
  plural count. Found by driving the installed plugin by hand and reading the line.

### Notes

- State lives in `~/.prowl/status/<session_id>.json`, beside the token file, and is
  pruned after seven days. The plugin writes nothing to `~/.claude/settings.json`.
- Known gap, recorded rather than hidden: this repository states `22 MCP tools` and
  tabulates 20 of them. `prowl_list_sessions`, `prowl_test_tool` and the
  `prowl_get_tool_info` alias are served but appear in no table here.
