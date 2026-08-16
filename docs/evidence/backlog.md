# Board — what is open, and what it would cost to close

Seeded 2026-08-16, during the run that synced the skills with the running server.
There was no board before it; the work that had been deferred lived in prose or in
nobody's head.

`Priority = blast × (1 + age_runs) / effort`, effort in `S=1 / M=2 / L=3`. Recompute
at the close of every run; a row that has waited gets louder on its own.

| id | What | Source | Blast | Effort | Age | Pri | Status |
|---|---|---|---:|---:|---:|---:|---|
| B-01 | **Publish `@prowl-ai/cli` 0.2.0, then release this package.** `plugins/prowl-cli` documents `0.2.0`; npm serves `0.1.1`, whose dispatcher knows six verbs. Releasing first hands `npx` users a page whose commands answer `Unknown command` | run 3 | 3 | 2 | 0 | 1.5 | **blocks release** |
| B-02 | `scripts/check-contract.js` — every `prowl_*` name, argument and enum in the skills, checked against a live `tools/list`. This run's defect class had no check at all | run 3 | 3 | 2 | 0 | 1.5 | open |
| B-03 | `scripts/check-cli.js` — the documented CLI surface against the published tarball, and a field binding the plugin to the CLI version it documents. B-01 exists because nothing noticed the gap | run 3 | 3 | 2 | 0 | 1.5 | open |
| B-04 | **`prowl wallet` is broken in both published and unreleased CLI, for two different reasons.** 0.1.1 called `GET /api/v1/wallet/balance` (`404`); 0.2.0 calls the MCP tool `prowl_get_wallet`, which the deployment does not register. No surface answers a balance to a `prowl_` key. Filed upstream as [prowl-cli#2](https://github.com/PROWL-AI/prowl-cli/issues/2) — deploy the tool, or gate the command and drop the `--help` advice pointing at it | run 3, re-scoped run 4 | 2 | 1 | 1 | 4.0 | open, upstream |
| B-09 | `prowl --help` states hard provider-cost caps of $2.50 / $8.00 / $18.00 and `src/commands/analyze.js` cites `prowl.chat/pricing` as their origin. That page is a `404` and no server response carries the figures. Either publish the page or drop the caps from the CLI banner — right now the CLI and this repository's skills disagree in public | run 4 | 1 | 1 | 0 | 1.0 | open, upstream |
| B-05 | The hosted `skill.md` is stale in five measured ways: it counts 21 tools in its health example and 22 in its heading, omits `prowl_schedule_pause`, omits `limit`/`offset`/`names` on `prowl_list_tools` and `limit`/`offset` on `prowl_schedule_list`, and documents health fields the endpoint no longer returns. It is the document `check-tool-count.js` reads | run 3 | 2 | 1 | 0 | 2.0 | open, upstream |
| B-06 | `prowl_get_wallet` returns to both skills when the deployment registers it. It is in the server source; `tools/list` does not serve it | run 3 | 1 | 1 | 0 | 1.0 | open, blocked on deploy |
| B-07 | The status line has never been rendered by Claude Code — only the state file it reads has been verified. Carried from run 1 | run 1 | 1 | 1 | 2 | 3.0 | open |
| B-08 | `negative-self-test.js` intermittently ends *the suite is red after every restore* with all eight guards green and the tree provably intact — two reds in four runs, cause unidentified. The final check now prints what it judged red, so the next occurrence is diagnosable; the diagnosis itself is owed. A gate that cries wolf is spent within a few runs | run 3 | 2 | 2 | 0 | 1.0 | open |

## Closed

| id | What | Closed by |
|---|---|---|
| — | *"The hooks have never fired from Claude Code's own dispatcher"* (carried from runs 1 and 2) | Two real sessions wrote `~/.prowl/status/<uuid>.json` on 2026-08-15 at 21:42 and 23:45, with `totals.calls` 2 and 1, all `ok`, and `usd: null` on free calls — the dispatcher fired, and *absent* stayed absent instead of becoming `$0.00` |
