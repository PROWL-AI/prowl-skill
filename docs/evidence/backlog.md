# Board — what is open, and what it would cost to close

Seeded 2026-08-16, during the run that synced the skills with the running server.
There was no board before it; the work that had been deferred lived in prose or in
nobody's head.

`Priority = blast × (1 + age_runs) / effort`, effort in `S=1 / M=2 / L=3`. Recompute
at the close of every run; a row that has waited gets louder on its own.

| id | What | Source | Blast | Effort | Age | Pri | Status |
|---|---|---|---:|---:|---:|---:|---|
| B-09 | `prowl --help` states hard provider-cost caps of $2.50 / $8.00 / $18.00 and `src/commands/analyze.js` cites `prowl.chat/pricing` as their origin. That page is a `404` and no server response carries the figures. Either publish the page or drop the caps from the CLI banner — right now the CLI and this repository's skills disagree in public | run 4 | 1 | 1 | 0 | 1.0 | open, upstream |
| B-05 | The hosted `skill.md` is stale in five measured ways: it counts 21 tools in its health example and 22 in its heading, omits `prowl_schedule_pause`, omits `limit`/`offset`/`names` on `prowl_list_tools` and `limit`/`offset` on `prowl_schedule_list`, and documents health fields the endpoint no longer returns. It is the document `check-tool-count.js` reads | run 3 | 2 | 1 | 0 | 2.0 | open, upstream |
| B-07 | The status line has never been rendered by Claude Code — only the state file it reads has been verified. Carried from run 1 | run 1 | 1 | 1 | 2 | 3.0 | open |
| B-10 | Nothing checks that an argument a page tells the caller to pass is one the server accepts — the `tier`-for-`execution_mode` class. Two regex attempts were written, run live and cut (both recorded in `check-contract.js`); prose cannot be asked this question reliably. The fix is a machine-readable association in the pages themselves, not a third pattern | run 5 | 3 | 3 | 0 | 1.0 | open |
| B-08 | `negative-self-test.js` intermittently ends *the suite is red after every restore* with all eight guards green and the tree provably intact — two reds in four runs, cause unidentified. The final check now prints what it judged red, so the next occurrence is diagnosable; the diagnosis itself is owed. A gate that cries wolf is spent within a few runs | run 3 | 2 | 2 | 0 | 1.0 | open |

## Closed

| id | What | Closed by |
|---|---|---|
| B-01 | Publish `@prowl-ai/cli` 0.2.0, then release | Published 2026-08-16 and `latest` on npm; its thirteen verbs and exit codes match the page exactly. `check-cli.js --release` now refuses a tag if this ever recurs |
| B-03 | `scripts/check-cli.js` and the plugin↔CLI binding | Shipped in 0.5.4: the check, `metadata.documents_cli`, 12 offline checks, two guard plants, a CI job and a release gate |
| B-02 | `scripts/check-contract.js` | Shipped in 0.5.3 with 11 offline checks, two guard plants, and a CI job. It caught a live divergence on its first run |
| B-04 | `prowl wallet` broken in both CLI versions | `prowl_get_wallet` was deployed on 2026-08-16; `tools/list` now returns it. The 0.2.0 command works as written. [prowl-cli#2](https://github.com/PROWL-AI/prowl-cli/issues/2) closed |
| B-06 | `prowl_get_wallet` returns when the deployment registers it | It did. Restored to both skills in 0.5.3 with the contract the server serves |
| — | *"The hooks have never fired from Claude Code's own dispatcher"* (carried from runs 1 and 2) | Two real sessions wrote `~/.prowl/status/<uuid>.json` on 2026-08-15 at 21:42 and 23:45, with `totals.calls` 2 and 1, all `ok`, and `usd: null` on free calls — the dispatcher fired, and *absent* stayed absent instead of becoming `$0.00` |
