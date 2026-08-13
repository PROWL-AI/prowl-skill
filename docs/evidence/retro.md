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

## Retired

*(nothing yet — this file was created at the 2026-08-13 stamps below.)*

## Run stamps

| Date | Task | Commit | Diverged? |
|---|---|---|---|
| 2026-08-13 | The live status widget; `prowl` 0.3.0 | `8d40dcd` | yes — see below |
| 2026-08-13 | npx distribution and tag-driven release; package 0.4.0 | `c622978` | yes — see below |

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
