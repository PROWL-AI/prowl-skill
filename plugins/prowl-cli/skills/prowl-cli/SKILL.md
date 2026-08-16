---
name: prowl-cli
description: Drives the Prowl CLI (`@prowl-ai/cli`) — a shell client for Prowl exposing 448 market-intelligence tools (SEO, backlinks, 60+ SERP engines, ads, web scraping, AI) plus the full Prowl research pipeline, billed pay-as-you-go from a USD wallet. Use when a shell is available and market data is needed in a script, a CI job or a one-off command — competitor research, SERP and keyword data, backlink profiles, ad creative research, pricing and demand validation — without configuring an MCP server.
license: MIT
compatibility: Requires Node.js 18+, the `@prowl-ai/cli` npm package (installed globally or run via npx) and a Prowl API key; makes network calls to prowl.chat.
metadata:
  author: prowl.chat
  version: "0.2.2"
---

# Prowl CLI — market intelligence from the shell

`@prowl-ai/cli` is the command-line client for [Prowl](https://prowl.chat): one binary that reaches **448 market-intelligence tools** across 15 providers, plus the Prowl analysis pipeline. Every metered call debits a USD wallet.

Use this skill when a shell is available. Use the sibling `prowl` plugin instead when the agent should call Prowl as MCP tools inside its own tool loop.

## Setup (one time)

Prowl API keys (`prowl_...`) are **billing-bearing** — treat them as secrets and never commit them.

```bash
npm install -g @prowl-ai/cli
```

**This page documents CLI `0.2.0`, and `0.2.0` is not on npm yet** — the published
versions are `0.1.0` and `0.1.1`, whose only verbs are `auth`, `tools`, `call`,
`analyze`, `wallet` and `version`. Everything below outside that set will answer
`Unknown command` until the release lands. Check with `prowl version` before believing
this page, and prefer the sibling `prowl` plugin meanwhile.

Every command, flag, exit code and default below was read from
`PROWL-AI/prowl-cli` at `master` `b526d96`, not from that release's `--help`.

The human generates a key at [prowl.chat](https://prowl.chat) (MCP Home → API keys), then supplies it one of four ways. They are tried in this order, and the first non-empty one wins:

```bash
prowl tools list --key prowl_...                     # 1. per-invocation flag
export PROWL_API_KEY=prowl_...                       # 2. environment
mkdir -p ~/.prowl && printf %s 'prowl_...' > ~/.prowl/prowl_mcp_token && chmod 600 ~/.prowl/prowl_mcp_token
                                                     # 3. ~/.prowl/prowl_mcp_token
                                                     # 4. ~/.codex/prowl_mcp_token, if a Codex install wrote one
```

Never print the key back to the user, never pass it in a command you echo into a log, and never write it into a repo file.

Requires Node.js >= 18. Verify with `prowl auth status`, which proves the key by making an authenticated call rather than assuming it works.

## Commands

Each command maps to one MCP tool. The CLI reaches **every logical tool the server
registers**, skipping only `prowl_get_tool_info` and `prowl_test_tool` — legacy aliases
of `prowl_tool_info` and `prowl_call_tool`, which `tools info` and `call` already cover.

```
CATALOGUE (free)
  prowl tools list [--category <c>] [--names] [--limit n] [--offset n]
  prowl tools search "<query>" [--category <c>] [--provider <p>] [--limit n] [--offset n]
  prowl tools info <tool_name>
  prowl playbooks

RESEARCH (debits the wallet)
  prowl call <tool_name> --params '<json>' [--session <id>]
  prowl analyze "<query>" [--tier basic|deep|max] [--playbook <id>] [--session <id>]
  prowl session start "<query>" [--tier <t>] [--title <s>] [--watch] [--interval <s>]
  prowl session status <id> | get <id> [--messages] | reset [<id>]
  prowl session list [--limit n] [--offset n]

SCHEDULES (each run debits the wallet)
  prowl schedule create "<query>" [--cadence <c>] [--tier <t>] [--playbook <id>]
                                  [--trigger interval|webhook] [--hour 0-23]
  prowl schedule list [--limit n] [--offset n]
  prowl schedule pause <job_id> | resume <job_id> | cancel <job_id>

OUTPUT (debits the wallet; needs a report on the same --session)
  prowl artifact <infographic|pdf|pptx|audio|video> [--theme <t>] [--session <id>]
  prowl export [--format markdown|html] [--server-path <p>] [--session <id>]

ACCOUNT (free)
  prowl auth status | login | logout
  prowl wallet                              # BROKEN against production — see below
  prowl stats [--session <id>]
  prowl errors [--hours n] [--tool <name>] [--severity <s>] [--source <s>]
               [--class <c>] [--limit n] [--offset n]
  prowl version
```

`--server-path` on `export` writes **on the Prowl server** and returns that absolute
path, which on the hosted endpoint is not a file you can open. For a local copy,
redirect the report instead: `prowl session get <id> > report.md`.

Global flags: `--json` (one machine-readable JSON document on stdout — always use this when parsing), `--key <k>`, `--quiet`, `-h`.
Environment: `PROWL_API_KEY`, `PROWL_BASE_URL`, `PROWL_MCP_URL`, `PROWL_TIMEOUT_MS`.

Recommended flow: `tools search` → `tools info` (check the cost) → `call`. Reach for `analyze` when the goal is a full report rather than one data point. Pass a stable `--session <id>` across consecutive calls to keep the report cache, history and spend scoped to one investigation; `artifact` and `export` read the report cached against that session, so they need a prior `analyze` on the same id.

`tools list` returns category **counts**, not names — pass `--names` or `--category <c>` for names, or prefer `tools search`, which is cheaper and ranks by relevance.

## Tiers, and the downgrade that is not a refusal

`--tier` is the CLI's name for the server's `execution_mode`; it defaults to `basic` and sizes the run.

| Tier | Use for | Calls per run | Time | Requires |
|------|---------|--------------:|------|----------|
| `basic` | one question, fast turnaround | 20–100 | 30–90s | — |
| `deep` | full competitive report, evidence-verified | 40–300 | 3–5 min | Exploit+ subscription |
| `max` | exhaustive, claims adversarially checked | 60–400 | 5–10 min | Blackops+ subscription |

`prowl --help` additionally states hard provider-cost caps of $2.50, $8.00 and $18.00 per
mode. This page does not repeat them as fact: no tool schema, no server response and no
public endpoint carries them, and `prowl.chat/pricing` — which the CLI source cites as
their origin — is a `404`. Treat them as the CLI author's figures until a server
response confirms them.

**A key without the subscription is not refused — it is downgraded to `basic`, and the run executes and bills as `basic`.** Nothing in the output announces this loudly.

**`prowl wallet` is the command meant to warn you, and against production it fails.**
It calls the MCP tool `prowl_get_wallet`, which exists in the Prowl server's source and
which the deployment at `prowl.chat` **does not register** — `tools/list` returns 22
names and that is not one of them. Nor is there a REST fallback: `/api/v1/wallet`
decodes a JWT and answers `401` to a `prowl_` key, and `/api/v1/wallet/balance` answers
`404`. So until the server ships the tool, **ask the human** which subscription is
active before spending on `--tier deep` or `--tier max`, and read spend afterwards with
`prowl stats`.

Check `prowl tools info <tool_name>` before a `call` in a loop — it is free and carries the estimated cost. Confirm with the human before running `--tier max` or a batch that could exceed a few dollars.

## Long runs

`analyze` blocks for 30 seconds to 5 minutes (`max`: up to 10). Two deadlines apply and
they differ by an order of magnitude: **15 minutes** for the commands that can genuinely
take that long — `analyze`, `call`, `artifact`, `export` — and **60 seconds** for
everything else. `PROWL_TIMEOUT_MS` overrides both.

In a script, prefer the async form — the run is detached server-side from the first
call, so a dropped connection costs nothing:

```bash
prowl session start "competitors of stripe.com" --tier deep --watch
```

Without `--watch` it returns a `session_id` immediately; poll with `prowl session status <id>` and read the report with `prowl session get <id>`. With it, the CLI polls every **10 seconds** (`--interval <s>`) and prints the id on stderr *before* the first wait — so a poll loop that dies still leaves you the id of a run that is being billed.

## Playbooks

`--playbook <id>` forces a fixed, persona-tuned report shape:

`geo-visibility-audit` · `competitor-teardown` · `content-engine` · `local-and-reputation` · `mobile-aso` · `amazon-marketplace` · `idea-validation` · `channel-economics-audit`

`prowl playbooks` (free) prints what each one covers.

## Exit codes

`0` ok · `1` runtime/tool error · `2` usage · `3` auth (missing or invalid key) · `4` insufficient balance · `5` network/timeout.

Handle them: `3` means ask the human for a key, `4` means stop and report the refusal rather than retrying — you cannot read the balance to decide otherwise — and `5` is the only one worth a retry. A tool that reports failure as text is mapped onto the same codes, so branching on the exit code is safe.

## Examples

```bash
prowl tools search "backlinks" --limit 5
prowl tools info majestic_get_back_link_data
prowl call extract_domain_from_url --params '{"url":"https://stripe.com/pricing"}'
prowl analyze "competitors of stripe.com" --tier basic --json
prowl analyze "is there demand for an AI receipt scanner" --playbook idea-validation --tier deep
prowl session start "teardown of vercel.com" --tier deep --watch
prowl stats --json
```

## When to use

Competitor and market research, SEO/SERP/keyword data, backlink profiles, ad creative and spend research, pricing and demand validation — from a script, a CI job, or a shell one-liner.

## When not to use

Tasks answerable from the local codebase, or sessions where the Prowl MCP server is already configured — there the `prowl` plugin's tools are the better path.

Full tool reference: [https://prowl.chat/mcp/skill.md](https://prowl.chat/mcp/skill.md)
