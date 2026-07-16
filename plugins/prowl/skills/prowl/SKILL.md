---
name: prowl
description: Connects this agent to the Prowl MCP — a single MCP endpoint exposing 385 market-intelligence tools (SEO, ads, SERP, web scraping, AI) plus the full Prowl analysis pipeline, billed pay-as-you-go from a USD wallet. Use when researching competitors, pulling SEO/SERP/keyword data, analyzing ad creative or spend, comparing pricing or funnels, or any task that needs real market data instead of guesses.
license: MIT
compatibility: Requires network access to prowl.chat and a Prowl API token; the bundled MCP config runs `npx mcp-remote` (needs Node.js 18+).
metadata:
  author: prowl.chat
  version: "0.2.0"
---

# Prowl — market intelligence for your agent

Prowl is a single MCP endpoint that exposes **385 marketing-intelligence API tools** (DataForSEO, SearchAPI, SerpAPI, web scraping, SEO, ads, AI) plus the full Prowl pipeline (`prowl_analyze`, async research sessions, artifacts). Call real data instead of guessing.

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

| Tool | Purpose |
|------|---------|
| `prowl_list_tools` | Browse the 385 tools by category (free) |
| `prowl_tool_info` | JSON input schema + estimated cost for one tool |
| `prowl_call_tool` | Invoke any single tool, metered (wallet debit) |
| `prowl_analyze` | Full multi-agent competitive report in one shot |
| `prowl_start_session` / `prowl_session_status` / `prowl_get_session` | Async deep research: kick off, poll, read back |

Recommended flow: `prowl_list_tools` → `prowl_tool_info` → `prowl_call_tool`. Use `prowl_analyze` for a complete strategy report. Pass a stable `session_id` across calls to keep per-conversation memory.

Full reference: [https://prowl.chat/mcp/skill.md](https://prowl.chat/mcp/skill.md)

## Verify

1. List MCP tools; confirm `prowl_list_tools`, `prowl_tool_info`, `prowl_call_tool`, `prowl_analyze`.
2. Run `prowl_list_tools` (free) → 385 tools grouped by category.
3. Connectivity check (no auth): `curl https://prowl.chat/mcp/health`.

## Billing

- **Subscription pool** (plan renewal, burns at period end) + **extra pool** (top-ups, never expires).
- Each `prowl_call_tool` response carries a `billing` object (`estimated_cost_usd`, `actual_cost_usd`, `debited`).
- Insufficient balance blocks the call before it runs — top up at MCP Home.

## When to use

Competitive/market intelligence, SEO/SERP/keyword research, ad creative & spend research, pricing/funnel analysis — anything needing real numbers.

## When not to use

Generic coding with no research/data component, or tasks fully answerable from the local codebase.
