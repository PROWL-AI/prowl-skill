# Prowl Plugin

**Real-world market data for your agents.** One MCP endpoint, 444 market data tools.

[![npm](https://img.shields.io/npm/v/@prowl-ai/prowl-skill?style=flat-square&color=cb3837&logo=npm)](https://www.npmjs.com/package/@prowl-ai/prowl-skill)
[![validate](https://img.shields.io/github/actions/workflow/status/PROWL-AI/prowl-skill/validate.yml?branch=main&style=flat-square&label=validate)](https://github.com/PROWL-AI/prowl-skill/actions/workflows/validate.yml)
[![Live](https://img.shields.io/badge/prowl.chat-live-00c853?style=flat-square)](https://prowl.chat)
[![MCP](https://img.shields.io/badge/MCP-prowl.chat%2Fmcp-6e40c9?style=flat-square)](https://prowl.chat/mcp)
[![Tools](https://img.shields.io/badge/tools-444-0969da?style=flat-square)](https://prowl.chat/mcp/skill.md)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[Prowl](https://prowl.chat) is a single MCP endpoint that gives any AI agent (Claude Code, Cursor, Codex or your own stack) **444 market data tools across 17 providers**: search (102 SearchAPI engines), ads, SEO and backlinks, app stores, reviews, social, trends and finance. The agent calls what it needs through `prowl_search_tools` → `prowl_tool_info` → `prowl_call_tool`, each call is billed on its own from one USD wallet, and every number comes back with the tool that returned it.

One call for one number. A report when one call is not enough: `prowl_analyze` plans many calls, cross-checks numeric claims against independent tools and composes the result. No agent of your own? Ask Prowl Agent on [prowl.chat](https://prowl.chat), which runs on the same tools.

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

1. Sign up at <https://prowl.chat> ($15 starter credit, no card).
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

**One command, any machine with Node 18+:**

```bash
npx @prowl-ai/prowl-skill
```

It adds the marketplace, installs both plugins, and tells you what to do next. Then:

```bash
npx @prowl-ai/prowl-skill update       # refresh after a new release
npx @prowl-ai/prowl-skill statusline   # wire the status line (backs up settings first)
npx @prowl-ai/prowl-skill status       # what is installed, what is missing
```

Pipe the key in so it never reaches your shell history:

```bash
printf %s "prowl_YOUR_KEY" | npx @prowl-ai/prowl-skill token
```

Every command takes `--dry-run`, which prints what it would do and changes nothing.

**By hand, if you prefer:**

```bash
claude plugin marketplace add https://github.com/PROWL-AI/prowl-skill
claude plugin install prowl@prowl
claude plugin install prowl-cli@prowl   # optional: the shell client skill
```

**Agents with no plugin channel** (Cursor, and others that read plain skills):

```bash
npx @prowl-ai/prowl-skill plain
```

That copies the skills and nothing else — no hooks, no status widget, no MCP server.
It refuses to run where the plugin is installed, because a plain copy of the same name
shadows a plugin and serves its frozen version forever.

**Codex**

```bash
codex plugin marketplace add https://github.com/PROWL-AI/prowl-skill
```

Then ensure `[plugins."prowl@prowl"] enabled = true` in `${CODEX_HOME:-$HOME/.codex}/config.toml` and restart.

The bundled `.mcp.json` connects to `https://prowl.chat/mcp` via `mcp-remote`, reading the token from `PROWL_MCP_TOKEN` or `~/.prowl/prowl_mcp_token`. The token never appears in a process's arguments: the launcher hands it to `mcp-remote` in the `PROWL_MCP_AUTH` environment variable and passes only the placeholder `Authorization:${PROWL_MCP_AUTH}`, which `mcp-remote` expands itself — so `ps` and `pgrep -fl` show no key.

With no key in either place the server **refuses to start** — it prints the two ways to supply one and exits `78` (`EX_CONFIG`). It deliberately does not fall through to `mcp-remote`'s OAuth: that opens a browser and waits on a `localhost` callback, and an MCP server started by an agent is killed long before the consent screen comes back, leaving the operator holding a redirect into a dead port.

### Manual MCP config (any client)

Configure a Streamable HTTP MCP server at `https://prowl.chat/mcp` with header `Authorization: Bearer prowl_YOUR_KEY`. See <https://prowl.chat/mcp/install.md> for per-client snippets (Cursor, Claude Code, Codex, generic).

## Verify

```bash
curl https://prowl.chat/mcp/health
```

Then, from your agent, run `prowl_list_tools` (free) → 444 tools grouped by category.

## The status widget

A `prowl_analyze` call runs 30 seconds to 5 minutes and an async session runs longer.
For all of that time the terminal shows a spinner, and what it cost appears only
inside a response body nobody reads. The `prowl` plugin ships hooks that fix both.

**It calls no API.** Every figure it shows was already in a response your agent
received, so the widget costs nothing and cannot spend your wallet to draw itself.

On by default, once the plugin is installed:

- a **progress bar in the dock/taskbar** when `prowl_session_status` reports a
  fraction, taken down when the session reports a terminal status
- a **one-time notice** when a call fails or the wallet blocks one — once per kind of
  failure, so an agent retrying five times does not produce five notices

Opt-in, one edit to `~/.claude/settings.json` (a plugin cannot ship a status line):

```
prowl · ⟳ analyze 1:12 · 12 calls 11✓ 1✗ · $0.31 · ctx 42% · ▸ call_tool✓ tool_info✓ search_tools✓
```

See the [`prowl` skill](plugins/prowl/skills/prowl/SKILL.md#the-status-widget) for the
two commands. State lives in `~/.prowl/status/<session_id>.json` beside your token, is
pruned after seven days, and the plugin never writes to your Claude Code settings.

## What your agent gets

- **23 MCP tools** front the whole catalog — discovery and schema lookup are free; only data calls are metered.
- **Reports, when one call is not enough** – `prowl_analyze` plans the calls and composes up to 16 intelligence modules (8 without a subscription). A typed evidence ledger extracts claims, attacks them adversarially, then gap-fills what survives. Contradictions and refuted claims ship inside the report.
- **3 execution modes** for `prowl_analyze` — `basic` (20–100 calls, 30–90s), `deep` (40–300, 3–5 min, needs Exploit+) and `max` (60–400, 5–10 min, needs Blackops+). A key without the subscription is downgraded to `basic` rather than refused.
- **8 playbooks** — `geo-visibility-audit`, `competitor-teardown`, `content-engine`, `local-and-reputation`, `mobile-aso`, `amazon-marketplace`, `idea-validation`, `channel-economics-audit`.
- **Artifacts and exports** — infographic, PDF, PPTX, audio brief and video from `prowl_generate_artifact`; Markdown and HTML from `prowl_export_report`. Both read the report cached against the `session_id` that produced it.

Prefer a terminal? Install the `prowl-cli` plugin above, or use [`@prowl-ai/cli`](https://github.com/PROWL-AI/prowl-cli) directly.

## Security

`prowl_...` keys are billing-bearing — every metered tool call debits your USD wallet. Treat the key as a secret. Token files and `.env` are git-ignored; never commit a key to a public repo.

## License

MIT — see [LICENSE](LICENSE).
