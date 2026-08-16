# Pipeline retrospective — prowl-skill

One file per project. Stage 0 of every run reads the standing instructions below **in
full** before its first question.

## Standing instructions

Hard cap: ten. Each carries the run stamp it was written at. Retire an entry the moment
any of its three triggers fires — it became a mechanical check, the paths or commands it
names are gone, or it has not fired in five run stamps — and log the deletion as one
line under *Retired*.

1. **(2026-08-13) A fixture encodes the case its author imagined, and its author
   imagined the documentation.** The adapter's tests were written from
   `prowl.chat/mcp/skill.md`, which describes a `billing` object, and they passed. The
   live server answers `{"result": "<a JSON string>"}`; the walker treated `result` as
   a leaf and would have shown `$—` for every metered call forever, with six suites
   green. **Call the real thing once and read what comes back** before believing a
   fixture written from prose. *(Retire when every external shape this repository
   parses has a captured-response fixture, or after five run stamps without firing.)*

2. **(2026-08-13) A component that receives no input can look exactly like one that
   succeeded.** `gh secret set NPM_TOKEN` with no value and no TTY stored an **empty**
   secret, and `gh secret list` reported it as present. The only symptom was
   `NODE_AUTH_TOKEN:` with nothing after it in a job log — legible only if you know a
   non-empty secret prints as `***`. It cost a false release. **Assert the input
   arrived**, and where a value cannot be read back, make the step that consumes it
   safe to re-run. *(Retire when every secret this repository depends on is verified by
   a step that fails loudly on an empty value.)*

3. **(2026-08-13) A negative self-test that fires on some runs is worse than none.**
   The lock guard proved itself on Node 18 and not on Node 22: the fixture detected the
   lost update probabilistically, because eight processes launched in sequence can also
   finish in sequence. It reported a guard as proven on a coin flip. **Make contention
   deterministic** — a start barrier and enough repetitions that the window cannot be
   missed — and verify in both directions more than once. *(Retire when the guard suite
   runs under a scheduler that forces interleaving, or after five run stamps without
   firing.)*

4. **(2026-08-13) The step that repairs a failure must survive the failure.** The first
   release published a GitHub release and then died at `npm publish`. With
   `gh release create` alone the re-run would have died earlier, on a release that
   already existed, and the step that actually failed would never have been retried.
   **Any step before a fallible one is a step that will be re-run**: make it idempotent
   when you write it, not after it hurts. *(Retire when every release step in this
   repository is idempotent and a fixture proves it.)*

5. **(2026-08-16) Source is not deployment, and a working tree is not a registry.**
   `prowl_get_wallet` was written into a shipped skill because it exists in the
   server's source — the same commit cites `mcp_server/models.effective_tier` and is
   right about it. `tools/list` on `prowl.chat` registers 22 tools and that is not one
   of them. The same commit rewrote the CLI skill for a version that lives in its
   repository and not on npm. **Ask the surface that answers users** — `tools/list`,
   `npm view`, the published tarball — never the code that would produce it. *(Retire
   when a script checks every named tool, command and flag against the registry that
   serves it — board `B-02` and `B-03` — or after five run stamps without firing.)*

6. **(2026-08-16) A guard moved to agree with a new claim is not a weakened guard. It
   is a deleted one that still prints `OK`.** `ALLOWED` in `check-tool-count.js` went
   from `[22]` to `[23]` — deliberately, with a comment explaining the move — to match
   the tool above. The check then reported *448 tools; 8 file(s) agree* while eight
   files carried a count the server has never served. The comment made it look like
   maintenance. **A constant that encodes a measurement is changed only by re-taking
   the measurement, and the commit says which call was read.** *(Retire when no check
   in this repository carries a hand-maintained expected value.)*

## Retired

*(nothing yet — the four 2026-08-13 entries are at age 1 of five, and none has become
a mechanical check or lost the paths it names.)*

## Run stamps

| Date | Task | Commit | Diverged? |
|---|---|---|---|
| 2026-08-13 | The live status widget; `prowl` 0.3.0 | `8d40dcd` | yes — see below |
| 2026-08-13 | npx distribution and tag-driven release; package 0.4.0 | `c622978` | yes — see below |
| 2026-08-15 | The skills against the server's *source*; package 0.5.0, released | `8977023` (PR #5) | yes — it shipped a tool that does not exist |
| 2026-08-16 | The same skills against the *running* server; package 0.5.1 | PR #6 | yes — see below |
| 2026-08-16 | The CLI page against the CLI source; package 0.5.2 | PR #7 | no — seven defects found in an existing artifact, none introduced by the run |

---

## 2026-08-13 — three defects, three instruments, no fixture among them

**Symptom.** A widget that six green suites described as working, and three separate
things wrong with it.

1. **The adapter could not have found a single debit.** The live server double-encodes;
   the walker stopped at the envelope. Every metered call would have rendered `$—`.
2. **The lock guard proved itself on one Node version and not the other**, because the
   fixture detected the lost update probabilistically.
3. **The widget printed `1 calls`** — with eighteen render fixtures, every one of which
   happened to use a plural count.

**Owned by** stage 5 in each case, and by stage 6 for not looking at the artefact.

**Root cause.** One shape: **the test knew only what its author knew.** The
documentation described an inner body, so the fixture used an inner body. Overlap was
assumed, so the race assumed overlap. Counts in fixtures were plural, so plurality was
never a case.

**Fix, by grade.**

- *Mechanical (taken):* captured live bodies as fixtures; a start barrier and five
  writes per writer; a singular-count assertion. All three planted against, so the next
  rewrite turns the suite red.
- *Standing instructions:* #1 and #3 above.
- *What actually caught them is worth naming, because it is not a rule:* a live call, a
  CI matrix, and a person reading a line. **Three findings, three instruments, and not
  one of them was a fixture.**

## 2026-08-13 (second run) — the release that published nothing, and why it cost one re-run

**Symptom.** A `v0.4.0` tag ran ten green steps, cut a public GitHub release, and
failed at `npm publish` with `ENEEDAUTH`. npm had nothing; the tag looked delivered.

**Root cause.** `gh secret set` with no value and no TTY reads stdin, gets nothing, and
stores an empty secret that `gh secret list` then reports as present. A component that
never received its input, indistinguishable from one that worked.

**Fix, by grade.**

- *Mechanical (taken):* the GitHub-release step edits an existing release rather than
  failing, and publish reports an already-published version as nothing to do. The
  recovery is one re-run of the same workflow.
- *Standing instructions:* #2 and #4 above.
- *What made this cheap:* the idempotency was written twenty minutes **before** it was
  needed, while reasoning about what could not be verified in advance — not after the
  failure. That is the whole difference between a one-command recovery and a manual
  repair of a public release.

**The honest note.** Two of this run's three real problems were in the operator's hands
rather than the code — an empty secret and a placeholder pasted literally. Both were
caught by reading what was actually there: a blank after `NODE_AUTH_TOKEN:`, and the
literal text of a command. Neither would have been caught by any test in this
repository, and no test should be written for either.

## 2026-08-16 — the tool that was never deployed, and the guard that agreed with it

**Symptom.** A skill that named `prowl_get_wallet` in three places, a count of 23, and
`ALLOWED = [23]` in `check-tool-count.js`. `tools/list` against
`https://prowl.chat/mcp/` — called through this machine's gateway, so the key never
left its `secrets/` — returns **22** tools and no `prowl_get_wallet`. In the same
commit, `prowl-cli` had been rewritten for `@prowl-ai/cli` 0.2.0; npm serves `0.1.1`,
and the upstream repository carries one tag.

**It shipped.** The commit was merged as PR #5 on 2026-08-15 and released as
`@prowl-ai/prowl-skill@0.5.0`, which is `latest` on npm. This was not caught on a
branch — it was caught in the published package, one day later, by an audit that
happened to re-ask the server. Everything below is therefore a correction, not a
prevention.

**Surfaced at** stage 1, by re-fetching the two sources the branch claimed to have
audited. **Owned by** stage 6 of the previous run: the branch's own gate could not have
caught this, because the only check that reads the server had been edited to agree with
the claim under test.

**Root cause, and it is one sentence.** *The claim was true of the source and false of
the deployment.* `prowl_get_wallet` is in the server's code; the entitlement fields
quoted for it are real there. The CLI 0.2.0 verbs are in the CLI's repository. Neither
is on the surface a user's agent reaches. Everything else followed: if you believe the
tool exists, raising the guard's constant is *maintenance*, and the careful comment
explaining the move is what makes it invisible.

**What the branch got right, and it is most of it** — `execution_mode` in all three
tools, the subscription downgrade, `names` on `prowl_list_tools`, `prowl_list_sessions`,
the artifact and export enums. All confirmed against the live schemas and kept. The
correction is surgical, not a revert, and saying so matters: a run that throws away
correct work because part of it was wrong teaches the next one to hide the wrong part.

**Fix, by grade.**

- *Mechanical (taken):* `ALLOWED` back to `[22]`, with the incident written into the
  constant's own comment so the next person to move it reads what moving it cost. The
  `prowl-cli` page states which CLI version it documents, above the install line.
  `CHANGELOG` carries a *Not shipped, and why* section, and the release is blocked on
  board `B-01`.
- *Mechanical (owed):* board `B-02` and `B-03` — nothing in this repository checks a
  tool name, an argument, an enum, or a CLI verb. The count is still the only thing
  guarded, which is why the count was the thing that got edited.
- *Standing instructions:* #5 and #6 above.
- *What actually caught it:* re-asking two registries that answer in seconds —
  `tools/list` and `npm view`. Not a fixture, not a reviewer. The fourth run stamp in a
  row where the finding came from calling the real thing.

**A second finding, and the way it was mis-diagnosed is the useful part.**
`negative-self-test.js` ended twice with *FAIL: the suite is red after every restore —
the tree was left damaged*, having passed all eight guards. The tree was not damaged:
`git status` showed only the intended edits and `npm test` was green immediately after,
five times in a row.

Three hypotheses were formed and two were wrong, each on evidence that looked
sufficient:

1. *Concurrent runs clobbered each other* — three had indeed been started, and the
   script does mutate the working tree. Refuted: it failed again running alone.
2. *My edits caused it* — a pristine worktree at `8977023` ran the guards green.
   Refuted: the same tree that had failed twice then passed. **One green run cannot
   refute an intermittent failure, and treating it as proof was the actual error here.**
3. Unresolved. Frequency so far: two reds in four runs on the working tree, none in one
   run on a pristine one. Cause unknown, and it is left unknown rather than guessed.

This is standing instruction #3 exactly — *a self-test that fires on some runs is worse
than none* — arriving from the other direction: not a guard that misses, a gate that
cries. The mechanical fix taken is small and it is the one that matters: the final
check now **prints the suite output it judged red**. It printed nothing before, which
is why the reader's next move was `npm test`, which by then was green — a failure that
cannot be reproduced is a failure that gets explained away, and it very nearly was.
Board `B-08` carries the diagnosis.
