# Prowl Plugin

**One MCP. 385 market-intelligence tools for your agent.**

Prowl is a single MCP endpoint that gives any AI agent (Cursor, Claude Code, Codex, or your own stack) 385 market-intelligence tools — SEO, ads, SERP, web scraping, AI — plus the full Prowl analysis pipeline. Your agent calls real data instead of guessing, billed pay-as-you-go from a USD wallet.

- MCP URL: `https://prowl.chat/mcp` (Streamable HTTP)
- Auth: `Authorization: Bearer prowl_<your_key>`
- Hosted install playbook: <https://prowl.chat/mcp/install.md>
- Full tool reference: <https://prowl.chat/mcp/skill.md>

## Skill included

**`/prowl`** — Install and use the Prowl MCP: token setup, core tools (`prowl_list_tools`, `prowl_tool_info`, `prowl_call_tool`, `prowl_analyze`, async sessions), verification, and billing.

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

Then, from your agent, run `prowl_list_tools` (free) to see all 385 tools.

## Security

`prowl_...` keys are billing-bearing — every metered tool call debits your USD wallet. Treat the key as a secret. Token files and `.env` are git-ignored; never commit a key to a public repo.

## License

MIT — see [LICENSE](LICENSE).
