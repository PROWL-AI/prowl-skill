---
name: prowl-cli
description: Drives the Prowl CLI (`@prowl-ai/cli`) — a shell client for Prowl exposing 408 market-intelligence tools (SEO, backlinks, 60+ SERP engines, ads, web scraping, AI) plus the full Prowl research pipeline, billed pay-as-you-go from a USD wallet. Use when a shell is available and market data is needed in a script, a CI job or a one-off command — competitor research, SERP and keyword data, backlink profiles, ad creative research, pricing and demand validation — without configuring an MCP server.
license: MIT
compatibility: Requires Node.js 18+, the `@prowl-ai/cli` npm package (installed globally or run via npx) and a Prowl API key; makes network calls to prowl.chat.
metadata:
  author: prowl.chat
  version: "0.1.0"
---

# Prowl CLI — market intelligence from the shell

`@prowl-ai/cli` is the command-line client for [Prowl](https://prowl.chat): one binary that reaches **408 market-intelligence tools** across 15 providers, plus the Prowl analysis pipeline. Every metered call debits a USD wallet.

Use this skill when a shell is available. Use the sibling `prowl` plugin instead when the agent should call Prowl as MCP tools inside its own tool loop.

## Setup (one time)

Prowl API keys (`prowl_...`) are **billing-bearing** — treat them as secrets and never commit them.

```bash
npm install -g @prowl-ai/cli
```

The human generates a key at [prowl.chat](https://prowl.chat) (MCP Home → API keys), then supplies it one of three ways:

```bash
export PROWL_API_KEY=prowl_...                       # environment
prowl tools list --key prowl_...                     # per-invocation flag
mkdir -p ~/.prowl && printf %s 'prowl_...' > ~/.prowl/prowl_mcp_token && chmod 600 ~/.prowl/prowl_mcp_token
```

Never print the key back to the user, never pass it in a command you echo into a log, and never write it into a repo file.

Requires Node.js >= 18.

## Commands

```
prowl auth status | login | logout
prowl tools list                            # 408 tools by category (free)
prowl tools search "<query>"                # semantic catalog search (free)
prowl tools info <tool_name>                # input schema + estimated cost (free)
prowl call <tool_name> --params '<json>'    # invoke one tool (wallet debit)
prowl analyze "<query>" [--tier basic|deep|max] [--playbook <id>] [--session <id>]
prowl wallet                                # balance
prowl version
```

Global flags: `--json` (one machine-readable JSON document on stdout — always use this when parsing), `--key <k>`, `-h`.

Recommended flow: `tools search` → `tools info` (check the cost) → `call`. Reach for `analyze` when the goal is a full report rather than one data point. Pass a stable `--session <id>` across consecutive `analyze` calls to keep the report cache and conversation history scoped to one investigation.

## Tiers and cost control

`analyze` defaults to `--tier basic`. Each tier holds a hard provider-cost cap for the run — billing never exceeds the reserved hold.

| Tier | Use for | Cap |
|------|---------|----:|
| `basic` | one question, fast turnaround | $2.50 |
| `deep` | full competitive report | $8.00 |
| `max` | exhaustive, research-grade | $18.00 |

Check `prowl tools info <tool>` before a `call` in a loop, and `prowl wallet` before a batch. Confirm with the human before running `--tier max` or a batch that could exceed a few dollars.

## Playbooks

`--playbook <id>` forces a fixed, persona-tuned report shape:

`geo-visibility-audit` · `competitor-teardown` · `content-engine` · `local-and-reputation` · `mobile-aso` · `amazon-marketplace` · `idea-validation` · `channel-economics-audit`

## Exit codes

`0` ok · `1` runtime/tool error · `2` usage · `3` auth (missing or invalid key) · `4` insufficient balance · `5` network/timeout.

Handle them: `3` means ask the human for a key, `4` means stop and report the balance rather than retrying, `5` is the only one worth a retry.

## Examples

```bash
prowl tools search "backlinks"
prowl tools info majestic_get_back_link_data
prowl call extract_domain_from_url --params '{"url":"https://stripe.com/pricing"}'
prowl analyze "competitors of stripe.com" --tier basic --json
prowl analyze "is there demand for an AI receipt scanner" --playbook idea-validation --tier deep
```

## When to use

Competitor and market research, SEO/SERP/keyword data, backlink profiles, ad creative and spend research, pricing and demand validation — from a script, a CI job, or a shell one-liner.

## When not to use

Tasks answerable from the local codebase, or sessions where the Prowl MCP server is already configured — there the `prowl` plugin's tools are the better path.

Full tool reference: [https://prowl.chat/mcp/skill.md](https://prowl.chat/mcp/skill.md)
