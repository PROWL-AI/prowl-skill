# Contributing

Thanks for looking. This is a small repository with an unusually specific rule, so the
short version first.

## The rule that explains most review comments

**Every number and every name here is fetched or computed, never remembered.**

The tool count sat at `408` in eight files for two releases while the server served
`448`. A tool named `prowl_get_wallet` shipped to npm in three places while the
deployment did not register it — and the check that guards the count had been edited
to agree with it. Both were confident, both were wrong, and both were caught by asking
the server rather than by reading the repository.

So a pull request that states a figure or a tool name is expected to say what it read.
The three checks below do the asking; if your change makes one of them harder to run,
that is worth discussing before the code is written.

## The gate

```bash
npm test                            # 10 suites, offline — must pass on a plane
node scripts/negative-self-test.js  # 12 guards, each watched failing
npm run check:tools                 # the stated count against the live server
npm run check:contract              # the stated tool NAMES against a live tools/list
npm run check:cli                   # the prowl-cli page against the published CLI
```

Three notes that will save you an hour:

- **`npm test` must work offline.** The three `check:*` scripts reach the network on
  purpose and are therefore *not* part of it.
- **Never run two `negative-self-test.js` at once.** It plants defects into the working
  tree and restores them; two instances corrupt each other's restore. Its final check
  is also intermittently red with the tree provably intact (board `B-08`) — when that
  happens it now prints the suite output it judged red, so you can tell the two apart.
- **`check:contract` needs a credential**, because `tools/list` answers `-32001`
  without one. Set `PROWL_API_KEY`, or `PROWL_MCP_HEADER="Name: value"` when an MCP
  gateway in front holds the key. No credential is reported as *unknown* and exits 0 —
  it never reports "I could not ask" as "the pages are wrong".

## Adding a check

A check that cannot reach its source reports **unknown and exits 0**. Never drift.
A check that could not ask has learned nothing, and a check that says otherwise gets
ignored within a week — which costs more than the check was worth.

A check also earns its keep by failing. `scripts/negative-self-test.js` removes each
guard in turn and requires the suite to go red; if you add a guard, add its plant. A
green nobody has watched fail against a planted defect is not evidence.

## Releasing

**Bump `version` in `package.json` in your PR.** A merge to `main` that changes it cuts
the tag automatically and `release.yml` does the rest; a merge that does not bump
publishes nothing. Add the matching `## vX.Y.Z` section to `CHANGELOG.md` in the same
PR — `auto-tag.yml` refuses to tag without one, because a missing section fails the
release *after* the tag is public, and the tag then looks delivered while nothing
shipped.

The version lives in seven places and `test/version_sync_test.js` checks all of them.
The two plugins are versioned independently of the package.

## Two things this repository will not take

- **A second install channel.** A plain copy of a skill beside an installed plugin
  shadows it and serves its frozen version forever. One channel per agent; the
  installer's `plain` verb exists for agents with no plugin channel and refuses to run
  where the plugin is present.
- **A hook that decides anything.** Nothing in `plugins/prowl/hooks/` may return a
  permission decision, block a call, or set `continue: false`, and every hook exits 0
  even on malformed input. An observer that can refuse is an observer somebody
  eventually turns off — and the widget goes with it.

## Reporting a vulnerability

Not here. See [SECURITY.md](SECURITY.md) — and never paste a `prowl_...` key into an
issue: it is billing-bearing.
