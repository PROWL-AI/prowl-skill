# Evals

Two files of data and no runner, which is the house layout: there is no built-in
harness for this, so they live in the repository and a person runs them.

| File | What it holds |
|---|---|
| `triggers.json` | 20 queries. `expect` names the skill that should fire, or `null` for neither. Split 60/40, **fixed** — tuning on validation is how a trigger set stops measuring anything |
| `scenarios.json` | 6 behavioural scenarios, 3 per skill. Each names what a correct response *does*, in terms an observer can check |
| `fixtures/` | Inputs. Never a file named `SKILL.md` — that would ship as a real skill |

## They have never been run

Stated plainly because the alternative is worse. `npm test` checks that these files
are **well-formed** — that the scenarios exist, that the negatives are half the
trigger set, that the split is fixed, that no fixture is named `SKILL.md`. It does not
and cannot check that the skills pass them.

So: the data is real, the thresholds below are the house ones, and the numbers beside
them are blank until somebody runs it. A green `npm test` here means *the evals are
valid*, never *the skills passed*.

## How to run them

Triggers, per the house loop:

1. Each query 3× against an agent with the skills installed. Record which skill fired.
2. Pass threshold **0.5** on trigger rate.
3. Tune only on the **train** rows. Never paste a keyword from a failed query into a
   description — that overfits to the query instead of fixing the category.
4. At most 5 iterations, and pick the one with the best **validation** rate, which is
   not always the last.

Scenarios: run the query against a fresh agent with the skill installed, then check
each `expected_behavior` line by reading what it did. Baseline the same query with the
skills removed first — a scenario the model already passes without the skill is
measuring the model, not the skill.

Run on every model the skills claim: Haiku may need more guidance, Opus may be slowed
by over-explanation.

## Why these six

Four of the six encode something that already went wrong or already costs money:

- **`execution_mode`, not `tier`** — the skill said `tier` for two releases. An unknown
  key is ignored, so the caller got a basic run, was billed as basic, and reported back
  as though it had run deep.
- **Discovery before a metered call** — the catalogue holds 448 entries, too many to
  recall, and a guessed name costs a round trip that reads like a server fault.
- **Prompt injection** — every tool here returns text somebody else wrote, and a
  research agent is exactly the target. The fixture carries a real-shaped injection in
  an HTML comment.
- **A key on a command line** — the scenario hands the agent a live-looking key to see
  whether it protects it. `--key` lands in shell history and in any log that echoes the
  command; a runner masks only the secrets it was given.

The two remaining ones — async in CI, and branching on exit codes — are the advice most
likely to be ignored under time pressure, which is when it matters.

## The negatives are the point

Ten of the twenty queries should fire **nothing**, and they are near-misses on purpose:
an SEO audit of your *own* site (`seo-aeo-audit` owns it), a Google Ads audit of your
*own* account (`notfair:google-ads-audit`), competitor *UI* research (`lazyweb`,
`refero`), building an MCP server (`mcp-builder`). This machine carries all of them.

**A skill that wins a prompt it should lose is as much a defect as one that never
fires** — and it is the harder one to notice, because it produces an answer.
