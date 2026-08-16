# Changelog

## v0.5.4 — 2026-08-16

Package `@prowl-ai/prowl-skill` 0.5.4 · plugins `prowl` 0.4.2 (unchanged), `prowl-cli`
0.2.4.

**The release is unblocked: `@prowl-ai/cli` 0.2.0 is published and is `latest`.** Its
thirteen verbs and its exit codes match this page exactly, read out of the tarball
rather than out of a repository — and the check that reads them is what this release
adds. `B-01` closes, and the warning at the top of the page, which had become false, is
gone.

Twice in a row now a check has been written for a gap that closed while it was being
written: `check-contract.js` shipped the hour `prowl_get_wallet` was deployed, and
`check-cli.js` ships the hour the CLI was published. Neither is a coincidence worth
reading into — it is what happens when documentation is finally compared against
registries that move.

### Added

- **`scripts/check-cli.js`** and `npm run check:cli`. The `prowl-cli` page against the
  package it describes: the verbs its fenced command blocks list, and the exit codes it
  states, against `src/index.js` and `src/errors.js` in the **published tarball**. Same
  asymmetry as the other checks — a verb the page claims and the CLI lacks is a
  failure, a verb the CLI ships and the page omits is a note.

- **`metadata.documents_cli` in the page's front-matter**, which is the missing link
  the whole task was about. The plugin's `metadata.version` means *this plugin*;
  `documents_cli` means *the third-party release this page describes*. They read
  `0.2.4` and `0.2.0` and were never compared, which is exactly how a page came to
  describe commands the published binary did not have. The check reads the field, and
  also the same claim in prose, and fails if those two drift apart.

- **A third outcome: `BLOCKED`.** When the page documents a version npm does not serve
  there is nothing to compare against — a state of the world, not a defect in the page.
  It exits 0 on a branch, because a red nobody reading it can clear is a red that gets
  ignored within a week, and `--release` makes it fatal. `release.yml` runs that mode
  before it validates a single manifest: a tag is the one moment the gap reaches
  somebody's `npx`.

- **`test/cli_contract_test.js`** — 12 offline checks, including the blocked/`--release`
  pair and the prose-versus-field disagreement. Two more plants in the guard suite,
  which now proves **twelve**: reading verbs out of prose, and letting an unpublished
  CLI through the release gate. A `cli` job in CI beside `contract` and `tool-count`.

### Fixed

- The page's `0.2.0 is not on npm yet` warning is removed, and its provenance line now
  points at the published tarball rather than a commit on `master`.

## v0.5.3 — 2026-08-16

Package `@prowl-ai/prowl-skill` 0.5.3 · plugins `prowl` 0.4.2, `prowl-cli` 0.2.3.

**`prowl_get_wallet` shipped, and this release is the check that noticed.**
`scripts/check-contract.js` was written to catch the v0.5.0 defect — a tool named in
the pages that the server does not register. On its first run against the live server
it went red in the *opposite* direction: the deployment now registers **23** tools and
the pages said 22. The hosted `skill.md` grew from 27,934 to 30,751 bytes in the same
window and now carries the tool as its section 21.

So v0.5.1 was right when it was measured and stale within the hour. That is the
argument for the check rather than against the correction: three sources agreeing at a
point in time is not a standing fact about a service somebody else deploys.

### Added

- **`scripts/check-contract.js`** and `npm run check:contract`. Every `prowl_*` name
  the shipped pages state, and every `<n> MCP tools` claim, against a live
  `tools/list`. **It fails on a falsehood and reports an omission** — saying a tool
  exists when it does not teaches an agent a call that fails, while leaving one
  undocumented is an editorial choice, and a check that treats those alike gets
  silenced for the second before it can catch the first.

  It also checks `ALLOWED` in `check-tool-count.js` against the server, so **the guard
  has a guard**. That constant is the one that was re-anchored to match a claim in
  v0.5.0; nothing sat above it.

  No credential, or an unreachable endpoint, is *unknown* and exit 0. It takes
  `PROWL_API_KEY`, or `PROWL_MCP_HEADER="Name: value"` for an MCP gateway holding the
  key — which is how it was run on the machine that wrote it, because a check whose
  author never watched it answer is not evidence.

- **`test/contract_test.js`** — 11 checks, offline, including the ALLOWED case and the
  rule that an omission must never fail the gate. Two new plants in the guard suite:
  the token-file exclusion and the ALLOWED comparison, each watched failing.

- **A CI job**, `contract`, non-blocking like `tool-count`: on a fork the secret is
  absent, and *unknown* is the honest answer there.

### Fixed

- **`prowl_get_wallet` is back in both skills**, this time with the contract the
  server actually serves: no parameters, and a response carrying
  `subscription_balance_usd`, `extra_balance_usd`, `total_available_usd`, an
  `entitlement` block with `available_execution_modes` and `downgraded_modes`, and
  `key_limits`. `prowl wallet` in the CLI page is no longer marked broken, because it
  is not. Board `B-04` and `B-06` close; [prowl-cli#2](https://github.com/PROWL-AI/prowl-cli/issues/2)
  closes with them.

- **`ALLOWED` is `[23]`, moved by re-reading `tools/list`** rather than to match a
  claim. Its comment now carries all three moves and which of them was legitimate.

- The artifact themes (`prowl`, `prowl-gold`, `prowl-light`) are named — the only
  omission the new check reported on the shipped pages.

### Attempted twice and cut

An argument check — the obvious one, since the defect that started this was `tier` for
`execution_mode`. Both versions were written, run live, and removed: matching every
snake_case token flagged twelve **response** fields on pages with nothing wrong, and
matching a verb-of-passing near a backticked identifier flagged exactly two things,
one of them the sentence that warns readers *not* to send `tier`. A rule that fires on
the sentence written to prevent the defect is worse than no rule. Both attempts are
recorded in the file so the next person does not write a third regex; board `B-10`
carries the real fix, which is to stop asking prose a question about meaning.

## v0.5.2 — 2026-08-16

Package `@prowl-ai/prowl-skill` 0.5.2 · plugins `prowl` 0.4.1 (unchanged), `prowl-cli`
0.2.2.

The `prowl-cli` page was written from the CLI's working tree and nothing had ever
checked it against that tree. It has now been read line by line against
`PROWL-AI/prowl-cli` at `master` `b526d96` — every verb, flag, exit code, environment
variable and default. The verbs, the exit codes and the enums were right. Seven other
things were not.

### Fixed

- **"the CLI covers the 22 the server registers" was wrong twice.** It reaches every
  *logical* tool and deliberately skips `prowl_get_tool_info` and `prowl_test_tool`,
  the legacy aliases `tools info` and `call` already cover — and it calls one tool the
  deployment does not register. The page now says what is true.

- **`prowl wallet` is marked broken against production, with the reason.** 0.1.1 called
  `GET /api/v1/wallet/balance` (a `404`); 0.2.0 calls the MCP tool `prowl_get_wallet`,
  which `tools/list` does not return. The dependency moved rather than went away, and
  no surface answers a balance to a `prowl_` key. Filed upstream as
  [prowl-cli#2](https://github.com/PROWL-AI/prowl-cli/issues/2); board `B-04`.

- **The timeout was stated as one number and there are two.** 15 minutes for `analyze`,
  `call`, `artifact` and `export`; **60 seconds** for everything else. A page that
  promises a quarter of an hour to a command that gives a minute is worse than one that
  says nothing.

- **A fourth key source, and the order they are tried in.** The page listed two;
  `resolveKey` reads `--key`, then `PROWL_API_KEY`, then `~/.prowl/prowl_mcp_token`,
  then `~/.codex/prowl_mcp_token`, first non-empty wins.

### Added

Flags the page omitted, all wired and reaching the server: `--trigger` and `--hour` on
`schedule create`; `--limit`/`--offset` on `schedule list` and `session list`;
`--source`, `--class` and `--offset` on `errors`; `--server-path` on `export`, with the
warning that it writes on the *server* and returns a path the caller cannot open. The
`--watch` default poll interval (10s) and the fact that the session id is printed
before the first wait, so a dying poll loop still leaves the id of a run being billed.

### Disagreement recorded rather than resolved

`prowl --help` states hard provider-cost caps of $2.50 / $8.00 / $18.00 and the CLI
source cites `prowl.chat/pricing` as their origin. That page is a `404` and no server
response carries the figures, so v0.5.1 removed them from these skills. Rather than
quietly differ from a banner the user will read, the page now names the caps, says
where they come from and says they are unconfirmed. Board `B-09`.

### Still blocking the release

`B-01` — `@prowl-ai/cli` 0.2.0 is unpublished. Everything above describes it correctly
and npm still serves `0.1.1`.

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
