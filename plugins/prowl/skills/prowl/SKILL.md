---
name: prowl
description: Connects this agent to the Prowl MCP — a single MCP endpoint exposing 448 market-intelligence tools (SEO, backlinks, ads, SERP, web scraping, AI) plus the full Prowl analysis pipeline, billed pay-as-you-go from a USD wallet. Use when researching competitors, pulling SEO/SERP/keyword/backlink data, analyzing ad creative or spend, comparing pricing or funnels, validating a product idea, or any task that needs real market data instead of guesses.
license: MIT
compatibility: Requires network access to prowl.chat and a Prowl API token; the bundled MCP config runs `npx mcp-remote` (needs Node.js 18+).
metadata:
  author: prowl.chat
  version: "0.4.1"
---

# Prowl — market intelligence for your agent

Prowl is a single MCP endpoint that exposes **448 market-intelligence API tools** across 15 providers (DataForSEO, SearchAPI, SerpApi, SpyFu, Majestic, Foreplay, Firecrawl, Exa, Perplexity, Gemini, …) plus the full Prowl pipeline — `prowl_analyze`, async research sessions, recurring schedules, artifacts and exports. Call real data instead of guessing.

Prefer the sibling `prowl-cli` skill when the work belongs in a shell script or a CI job; use this one when the agent should call Prowl as MCP tools inside its own tool loop.

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
| `prowl_list_tools` | Category **counts**; pass `category` or `names=true` for names | free |
| `prowl_search_tools` | Semantic search over the catalog | free |
| `prowl_tool_info` | JSON input schema + estimated cost for one tool | free |
| `prowl_call_tool` | Invoke any single tool | metered |
| `prowl_analyze` | Full multi-agent research report in one shot | metered, sized by `execution_mode` |
| `prowl_list_playbooks` | The 8 fixed, persona-tuned report shapes | free |
| `prowl_start_session` / `prowl_session_status` / `prowl_get_session` / `prowl_list_sessions` | Async deep research: kick off, poll, read back | metered |
| `prowl_generate_artifact` / `prowl_export_report` | Infographic, PDF, PPTX, audio, video; Markdown/HTML export | metered |
| `prowl_schedule_create` / `_list` / `_pause` / `_resume` / `_cancel` | Recurring hunts | metered per run |
| `prowl_get_stats` / `prowl_get_error_feed` / `prowl_reset_session` | Run accounting, failures, state reset | free |

MCP tool args are **flat**, not nested.

`prowl_list_tools` answers with category counts by default — the full name list
costs about 4k tokens and is returned only for `names=true` or a single
`category`. Reach for `prowl_search_tools` to find a tool by intent; it is the
cheap path and ranks by relevance.

Recommended flow: `prowl_search_tools` → `prowl_tool_info` → `prowl_call_tool` for one fact; `prowl_analyze` for a complete strategy report. Pass a stable `session_id` across calls to keep the report cache and conversation memory scoped to one conversation — `prowl_generate_artifact` and `prowl_export_report` read the report cached against that session, so they need a prior `prowl_analyze` on the same id.

Full reference: [https://prowl.chat/mcp/skill.md](https://prowl.chat/mcp/skill.md)

## Resources and prompts

The server also serves three read-only resources — `prowl://tools` (catalogue
summary: category counts and names, not schemas), `prowl://stats` and
`prowl://report` — and three prompt templates: `competitor_analysis`
(`domain`, optional `focus_areas`), `seo_audit` (`domain`) and
`ad_creative_research` (`domain`, optional `platforms`).

The resources read the **default** session's cache, because the resource protocol
carries no per-call context. To inspect one session, call `prowl_get_stats` with
its `session_id` instead.

## Tiers

`prowl_analyze`, `prowl_start_session` and `prowl_schedule_create` take
**`execution_mode`** — not `tier`. The parameter sizes the run. An unknown key is
ignored, so a call that sends `tier` runs at the default and reports back as if it
had not.

| `execution_mode` | Use for | Calls per run | Time | Requires |
|------|---------|--------------:|------|----------|
| `basic` | One question, fast turnaround | 20–100 | 30–90s | — |
| `deep` | Full competitive report, evidence-verified | 40–300 | 3–5 min | Exploit+ subscription |
| `max` | Exhaustive, claims adversarially checked | 60–400 | 5–10 min | Blackops+ subscription |

**A key without the subscription is not refused — it is downgraded.** `deep` and
`max` resolve to `basic`, and the run executes and bills as `basic` with a notice
on the stream. Nothing free reports the entitlement in advance: no registered tool
answers it and no REST route accepts an API key (see *Billing*). So on a key whose
plan you do not know, ask the human which subscription is active before spending on
`deep` or `max` — the alternative is inferring it afterwards from a thinner report
than the one you asked for.

## Playbooks

Pass `playbook_id` to `prowl_analyze` to force a fixed report shape instead of a dynamically composed one:

`geo-visibility-audit` · `competitor-teardown` · `content-engine` · `local-and-reputation` · `mobile-aso` · `amazon-marketplace` · `idea-validation` · `channel-economics-audit`

Call `prowl_list_playbooks` (free) for what each one covers.

## Verify

1. List MCP tools; confirm `prowl_list_tools`, `prowl_tool_info`, `prowl_call_tool`, `prowl_analyze`.
2. Run `prowl_list_tools` (free) → category counts summing to `total_tools: 448`. (It returns counts, not names — pass `names=true` for the full list.)
3. Connectivity check (no auth): `curl https://prowl.chat/mcp/health`. It answers
   `status`, `server`, `version`, `transport` and `endpoint` — and nothing else, so
   do not read a tool count out of it.

## Billing

- **Subscription pool** (plan renewal, burns at period end) + **extra pool** (top-ups, never expires).
- Each `prowl_call_tool` response carries a `billing` object (`estimated_cost_usd`, `actual_cost_usd`, `debited`).
- Insufficient balance blocks the call before it runs — top up at MCP Home.
- **A `prowl_` key cannot read its own balance.** No registered tool returns one,
  `GET /api/v1/wallet` decodes a **JWT** and answers `401` to an API key, and
  `GET /api/v1/wallet/balance` does not exist (`404`). Spend is legible only
  afterwards — from the `billing` object on each call, from `prowl_get_stats`, or
  by a human at MCP Home. Plan a batch against a figure the human supplies, not
  one this key can fetch.
- A scoped key can also be capped below the wallet — per-category allowlists and
  daily or lifetime spend limits are set when the key is minted. Their refusals are
  **terminal**: `Error: API key is not allowed to call tools in category` and
  `Error: API key spend limit reached` will not succeed on retry, and a revoked key
  answers `401` while an IP outside the allowlist answers `403`.

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
