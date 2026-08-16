# CLAUDE.md — prowl-skill

House rules for **this repository only**.

## What this repo is

The installable plugin for [Prowl](https://prowl.chat): two skills, the hosted MCP
config, and — since v0.3.0 — the **status widget**, the only code here.

The skills are a shopfront for a document this repository does not own:
`https://prowl.chat/mcp/skill.md` is the source of truth for the tool catalogue, the
schemas and the tiers. Anything restated here is a copy, and copies drift — which is
exactly what happened: the count sat at 408 in eight files while the server served
448. That is why `scripts/check-tool-count.js` exists, and why a number is either
computed or fetched here, never remembered.

## The gate

```bash
npm test                            # every test/*_test.js, offline
node scripts/negative-self-test.js  # every guard, each watched failing
npm run check:tools                 # the stated count against the live server
npm run check:contract              # the stated NAMES against a live tools/list
```

`check:tools` and `check:contract` are deliberately outside `npm test`: they reach
prowl.chat, and the suite must work on a plane. Both report *unknown* and exit 0 when
they cannot ask — unreachable, or, for `check:contract`, no credential. A check that
could not reach the server has learned nothing, and reporting that as drift is how a
check gets ignored.

`check:contract` needs a key, because `tools/list` answers `-32001` without one. It
takes `PROWL_API_KEY`, or `PROWL_MCP_HEADER="Name: value"` when an MCP gateway in
front holds the key itself:

```bash
PROWL_MCP_URL=http://127.0.0.1:4000/mcp/prowl \
PROWL_MCP_HEADER="x-agw-key: $(cat ~/.config/agentgateway/secrets/roles/full)" \
  npm run check:contract
```

**Never run two `negative-self-test.js` at once** — it plants defects in the working
tree and restores them, and two instances corrupt each other's restore. It also fails
intermittently for reasons not yet understood (`B-08` on the board); when it does, it
now prints the suite output it judged red.

## Invariants

- **A hook may observe; it may not decide.** Nothing in `plugins/prowl/hooks/` returns
  a permission decision, blocks a call or sets `continue: false`. An observer that can
  refuse is an observer somebody eventually turns off, and then the widget goes with
  it.
- **A hook fails silent and always exits 0.** A hook that throws breaks the operator's
  turn — in every session that installed this plugin, including sessions doing
  something else entirely. Asserted in `test/hooks_e2e_test.js`, which runs the real
  scripts as processes against empty, malformed and absent payloads.
- **The decision is in `lib/`, the plumbing is in `hooks/`.** Every string, number and
  refusal is a function of a payload, fixtured without a `HOME` and without a network.
  Nothing rests on a hook's matcher being exact: the reference says matchers are
  best-effort, so `lib/prowl.js` re-asks the question precisely.
- **Every number is borrowed.** `usd` is what the server put in `actual_cost_usd` —
  never the estimate beside it, never a sum this repository computed from prices.
- **Absent is a word, never a zero.** `$—` and `$0.00` mean different things, and a
  renderer that prints them alike turns *we do not know* into *it was free*. There is a
  fixture for exactly this, and a plant that proves the fixture still fires.
- **The plugin writes nothing to `~/.claude/settings.json`.** Hooks ship through the
  plugin channel because that channel exists. The status line cannot — no plugin
  manifest declares `statusLine` — so it is opt-in, wired by the operator, in two
  documented commands.
- **`~/.prowl/` holds a billing-bearing token.** Anything this code writes there is
  small, pruned after seven days, and contains no secret.

## Evidence

Every number in a document here is counted by running something. `npm test` prints its
check count; `scripts/check-tool-count.js` prints the server's figure and the number of
files that agree. A restated number is the defect this repository already shipped once.

## Where things live

`docs/evidence/` — the artifact root for pipeline runs (briefs, specs, plans). The
`task-pipeline` convention is `docs/superpowers/`; this project relocates it, which
that skill's `references/artifacts.md` permits, because the name of another pack does
not belong in a third party's repository. Keep the shape, keep the slugs.
