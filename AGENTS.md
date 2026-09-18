# AGENTS.md

Instructions for an AI agent working in this repository. `CLAUDE.md` and `CONTRIBUTING.md`
are the fuller versions and win where any of the three disagree; this file exists because the
[agent-plugins.org](https://agent-plugins.org) convention expects it at the repository root,
and because an agent reads first and asks second.

## What this is

The Prowl plugin for Claude Code and Codex: two plugins (`plugins/prowl`, `plugins/prowl-cli`),
their skills, the marketplace manifest, and — since v0.3.0 — the **status widget**, which is
the only code here.

The skills are a shopfront for a document this repository does not own.
`https://prowl.chat/mcp/skill.md` is the source of truth for the tool catalogue, the schemas
and the tiers. Anything restated here is a copy, and copies drift.

## The one rule the rest follow from

**Every number and every name here is fetched or computed, never remembered.**

The catalogue count has drifted twice, both times confidently: eight files once carried a
figure the server had stopped serving, and it happened again in September 2026. The figures
are in `CHANGELOG.md` — deliberately not restated here, because prose that keeps an outgoing
number is the drift this rule exists to stop.

`scripts/check-tool-count.js` compares every stated count against the live server, including
the **GitHub repository description**, which is a surface a stranger reads and nothing else
checks. `CHANGELOG.md` is exempt because its counts are history: a check that read them as
current claims would either rewrite the past on every catalogue change or stay red forever.

## The gate, before you claim anything

```bash
npm test               # 12 suites, offline BY DESIGN — no key, no network
npm run check:tools    # every stated count against prowl.chat
npm run check:contract # the registered-tool constant against a live tools/list
npm run check:cli      # the documented CLI surface against the published tarball
```

The three `check:*` commands reach the network on purpose and are separate CI jobs. An
unreachable server is reported as *unknown*, never as drift — a check that could not ask has
learned nothing, and one that reports that as failure gets re-run instead of read.

**CI runs on push and on a weekly schedule.** The schedule matters more than it looks: these
numbers drift because the SERVER moves, not because this repository does, so a quiet
repository has to be able to notice on its own.

## Do not re-anchor a check to match a claim

`check-contract.js` pins the count of registered MCP tools. It was moved to 23 for a
`prowl_get_wallet` the deployment did not serve, moved back to 22 after a live `tools/list`
answered 22, and moved to 23 again hours later when the tool actually shipped — the same value
twice, and only one of the three moves was legitimate. The difference was entirely whether a
live `tools/list` had been read first.

Move a pinned number only after reading the live source, and name that call in the commit.
Editing a check so it agrees with the repository is how a guard becomes decoration.

## Releasing

Version bumps are synchronised across the manifests and the skills; `version_sync_test.js`
fails when they part. A merge to `main` that changes the version cuts the tag and `release.yml`
does the rest.

## What not to do

- Do not restate a tool count, a tool name or a tier anywhere new — link the hosted document.
- Do not make `npm test` need the network or a key.
- Do not print, log or commit an API key.
