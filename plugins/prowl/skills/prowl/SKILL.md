---
name: prowl
description: Connects this agent to the Prowl MCP — a single MCP endpoint exposing 448 market-intelligence tools (SEO, backlinks, ads, SERP, web scraping, AI) plus the full Prowl analysis pipeline, billed pay-as-you-go from a USD wallet. Use when researching competitors, pulling SEO/SERP/keyword/backlink data, analyzing ad creative or spend, comparing pricing or funnels, validating a product idea, or any task that needs real market data instead of guesses.
license: MIT
compatibility: Requires network access to prowl.chat and a Prowl API token; the bundled MCP config runs `npx mcp-remote` (needs Node.js 18+).
metadata:
  author: prowl.chat
  version: "0.3.0"
---

# Prowl — market intelligence for your agent

Prowl is a single MCP endpoint that exposes **448 market-intelligence API tools** across 15 providers (DataForSEO, SearchAPI, SerpApi, SpyFu, Majestic, Foreplay, Firecrawl, Exa, Perplexity, Gemini, …) plus the full Prowl pipeline — `prowl_analyze`, async research sessions, recurring schedules, artifacts and exports. Call real data instead of guessing.

- MCP URL: `https://prowl.chat/mcp`
- Transport: Streamable HTTP
- Auth header: `Authorization: Bearer prowl_<your_key>`

## Setup (one time)

Prowl API keys (`prowl_...`) are billing-bearing — every metered call debits a USD wallet. Treat the key as a secret; never commit it to a public repo.

1. The human signs up at [https://prowl.chat](https://prowl.chat) (gets $5 starter credit), optionally tops up the wallet, and generates a `prowl_...` key (shown once) under **MCP Home → API keys & config**.
2. Provide the key to this plugin via either:
   - environment variable `PROWL_MCP_TOKEN`, or
   - a token file at `~/.prowl/prowl_mcp_token` (`mkdir -p ~/.prowl && printf '%s' "prowl_YOUR_KEY" > ~/.prowl/prowl_mcp_token && chmod 600 ~/.prowl/prowl_mcp_token`).
3. The bundled `.mcp.json` reads the token automatically and connects via `mcp-remote`.

For manual per-client setup (Cursor `.cursor/mcp.json`, Claude Code `claude mcp add`, Codex `config.toml`, generic MCP), see the hosted playbook: [https://prowl.chat/mcp/install.md](https://prowl.chat/mcp/install.md).

## Core tools

22 MCP tools front the catalog. The ones that matter day to day:

| Tool | Purpose | Cost |
|------|---------|------|
| `prowl_list_tools` | Browse the 448 tools by category | free |
| `prowl_search_tools` | Semantic search over the catalog | free |
| `prowl_tool_info` | JSON input schema + estimated cost for one tool | free |
| `prowl_call_tool` | Invoke any single tool | metered |
| `prowl_analyze` | Full multi-agent research report in one shot | metered, tier-capped |
| `prowl_list_playbooks` | The 8 fixed, persona-tuned report shapes | free |
| `prowl_start_session` / `prowl_session_status` / `prowl_get_session` | Async deep research: kick off, poll, read back | metered |
| `prowl_generate_artifact` / `prowl_export_report` | Visuals, infographics, audio; Markdown/PDF/PPTX export | metered |
| `prowl_schedule_create` / `_list` / `_pause` / `_resume` / `_cancel` | Recurring hunts | metered per run |
| `prowl_get_stats` / `prowl_get_error_feed` / `prowl_reset_session` | Run accounting, failures, state reset | free |

MCP tool args are **flat**, not nested.

Recommended flow: `prowl_search_tools` → `prowl_tool_info` → `prowl_call_tool` for one fact; `prowl_analyze` for a complete strategy report. Pass a stable `session_id` across calls to keep the report cache and conversation memory scoped to one conversation.

Full reference: [https://prowl.chat/mcp/skill.md](https://prowl.chat/mcp/skill.md)

## Tiers

`prowl_analyze` and `prowl_start_session` take a `tier`, which sets the tool budget and the hard provider-cost cap for the run:

| Tier | Use for | Provider cost cap |
|------|---------|------------------:|
| `basic` | One question, fast turnaround | $2.50 |
| `deep` | Full competitive report | $8.00 |
| `max` | Exhaustive, research-grade | $18.00 |

You are never billed more than the reserved hold.

## Playbooks

Pass `playbook_id` to `prowl_analyze` to force a fixed report shape instead of a dynamically composed one:

`geo-visibility-audit` · `competitor-teardown` · `content-engine` · `local-and-reputation` · `mobile-aso` · `amazon-marketplace` · `idea-validation` · `channel-economics-audit`

Call `prowl_list_playbooks` (free) for what each one covers.

## Verify

1. List MCP tools; confirm `prowl_list_tools`, `prowl_tool_info`, `prowl_call_tool`, `prowl_analyze`.
2. Run `prowl_list_tools` (free) → 448 tools grouped by category.
3. Connectivity check (no auth): `curl https://prowl.chat/mcp/health`.

## Billing

- **Subscription pool** (plan renewal, burns at period end) + **extra pool** (top-ups, never expires).
- Each `prowl_call_tool` response carries a `billing` object (`estimated_cost_usd`, `actual_cost_usd`, `debited`).
- Insufficient balance blocks the call before it runs — top up at MCP Home.

## The status widget

Installed with the plugin, on by default, and it calls no API — every figure it shows
was already in a response this agent received.

While a call runs it records it; when the call returns it records the debit the server
reported. Two things reach the operator without being asked for: a **taskbar/dock
progress bar** when `prowl_session_status` reports a fraction, and a **one-time
notice** when a call fails or the wallet blocks one. A repeated failure is said once —
an agent retrying five times must not produce five notices.

A line at the bottom of the terminal shows the rest: the in-flight call and how long it
has been running, calls / ok / failed, spend, and the last five tools with their
verdicts. No plugin manifest can declare a `statusLine`, so the operator wires it once,
in `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"$HOME/.prowl/prowl-statusline.js\"",
    "refreshInterval": 2
  }
}
```

Copy the script to that stable path, so a plugin update — whose cache directory
carries the version — cannot break a line the operator wired:

```bash
mkdir -p ~/.prowl
cp "$(find ~/.claude/plugins -path '*prowl/statusline/prowl-statusline.js' | head -1)" ~/.prowl/
```

The copy finds the plugin's library on its own; `PROWL_LIB` overrides the search if
the plugin lives somewhere unusual. Finding nothing, it prints nothing.

`refreshInterval` matters: status-line updates go quiet while the session waits, which
is exactly when a Prowl call is in flight and the elapsed segment must keep moving.
Remove the line again by deleting the `statusLine` field, or with `/statusline clear`.

State lives in `~/.prowl/status/<session_id>.json` beside the token, is pruned after
seven days, and nothing is ever written to `~/.claude/settings.json` by the plugin.

## When to use

Competitive/market intelligence, SEO/SERP/keyword/backlink research, ad creative & spend research, pricing/funnel analysis, review mining, AI-search (GEO/AEO) visibility, product-idea validation — anything needing real numbers.

## When not to use

Generic coding with no research/data component, or tasks fully answerable from the local codebase.
