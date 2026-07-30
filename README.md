# Prowl Plugin

**One MCP. 408 market-intelligence tools for your agent.**

[![Live](https://img.shields.io/badge/prowl.chat-live-00c853?style=flat-square)](https://prowl.chat)
[![MCP](https://img.shields.io/badge/MCP-prowl.chat%2Fmcp-6e40c9?style=flat-square)](https://prowl.chat/mcp)
[![Tools](https://img.shields.io/badge/tools-408-0969da?style=flat-square)](https://prowl.chat/mcp/skill.md)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[Prowl](https://prowl.chat) is a single MCP endpoint that gives any AI agent (Cursor, Claude Code, Codex, or your own stack) **408 market-intelligence tools across 15 providers** — SEO & backlinks, 60+ SERP engines, ad libraries, web scraping, reviews, AI/LLM mention tracking — plus the full Prowl research pipeline. Your agent calls real data instead of guessing, billed pay-as-you-go from a USD wallet.

This repo is the **installable plugin**: a namespaced `/prowl:*` skill plus a ready-made MCP config. Install it and your coding agent wires up the rest itself.

- MCP URL: `https://prowl.chat/mcp` (Streamable HTTP)
- Auth: `Authorization: Bearer prowl_<your_key>`
- Hosted install playbook: <https://prowl.chat/mcp/install.md>
- Full tool reference: <https://prowl.chat/mcp/skill.md>

## Plugins included

| Plugin | Skill | What it covers |
|--------|-------|----------------|
| `prowl` | `/prowl` | Install and use the Prowl **MCP**: token setup, core tools (`prowl_list_tools`, `prowl_search_tools`, `prowl_tool_info`, `prowl_call_tool`, `prowl_analyze`, async sessions, schedules), tiers, playbooks, verification, and billing. Ships the `.mcp.json`. |
| `prowl-cli` | `/prowl-cli` | Drive the same catalog from the **shell** with [`@prowl-ai/cli`](https://github.com/PROWL-AI/prowl-cli): catalog commands, metered calls, `analyze` tiers and their cost caps, playbooks, `--json` output, exit codes. No MCP server required. |

Install either or both — the MCP plugin for agent tool calls, the CLI plugin for scripts, CI and terminal work.

## Setup

### 1. Get a token (human, one time)

1. Sign up at <https://prowl.chat> ($5 starter credit, no card).
2. Optionally top up the wallet.
3. Generate a `prowl_...` API key under **MCP Home → API keys & config** (shown once).

### 2. Provide the token to the plugin

Either export `PROWL_MCP_TOKEN`, or write a token file:

```bash
mkdir -p ~/.prowl
printf '%s' "prowl_YOUR_KEY" > ~/.prowl/prowl_mcp_token
chmod 600 ~/.prowl/prowl_mcp_token
```

### 3. Install the plugin

**Claude Code**

```bash
claude plugin marketplace add https://github.com/PROWL-AI/prowl-skill
claude plugin install prowl@prowl
claude plugin install prowl-cli@prowl   # optional: the shell client skill
```

**Codex**

```bash
codex plugin marketplace add https://github.com/PROWL-AI/prowl-skill
```

Then ensure `[plugins."prowl@prowl"] enabled = true` in `${CODEX_HOME:-$HOME/.codex}/config.toml` and restart.

The bundled `.mcp.json` connects to `https://prowl.chat/mcp` via `mcp-remote`, reading the token from `PROWL_MCP_TOKEN` or `~/.prowl/prowl_mcp_token`.

### Manual MCP config (any client)

Configure a Streamable HTTP MCP server at `https://prowl.chat/mcp` with header `Authorization: Bearer prowl_YOUR_KEY`. See <https://prowl.chat/mcp/install.md> for per-client snippets (Cursor, Claude Code, Codex, generic).

## Verify

```bash
curl https://prowl.chat/mcp/health
```

Then, from your agent, run `prowl_list_tools` (free) → 408 tools grouped by category.

## What your agent gets

- **22 MCP tools** front the whole catalog — discovery and schema lookup are free; only data calls are metered.
- **3 tiers** for `prowl_analyze` — `basic` / `deep` / `max`, each with a hard provider-cost cap ($2.50 / $8.00 / $18.00). You are never billed more than the reserved hold.
- **8 playbooks** — `geo-visibility-audit`, `competitor-teardown`, `content-engine`, `local-and-reputation`, `mobile-aso`, `amazon-marketplace`, `idea-validation`, `channel-economics-audit`.
- **Verified reports** — a typed evidence ledger extracts claims, attacks them adversarially, then gap-fills what survives. Contradictions and refuted claims ship inside the report.
- **Exports** — Markdown, PDF, PPTX, audio brief, video.

Prefer a terminal? Install the `prowl-cli` plugin above, or use [`@prowl-ai/cli`](https://github.com/PROWL-AI/prowl-cli) directly.

## Security

`prowl_...` keys are billing-bearing — every metered tool call debits your USD wallet. Treat the key as a secret. Token files and `.env` are git-ignored; never commit a key to a public repo.

## License

MIT — see [LICENSE](LICENSE).
