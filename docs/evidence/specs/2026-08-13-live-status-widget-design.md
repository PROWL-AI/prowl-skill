# Design — the live status widget

Contracts locked at stage 3. Everything below is what the code must honour; the plan
turns each row into a task.

## Shape

```
plugins/prowl/
  hooks/
    hooks.json          the wiring — PreToolUse, PostToolUse, SessionStart
    pre-tool-use.js     opens a record
    post-tool-use.js    closes it, speaks when it matters
    session-start.js    prunes, and says nothing
  lib/
    state.js            the session file: read, append, close, prune
    prowl.js            the adapter: a payload becomes a typed record
    render.js           records become a line, a block, or nothing
    osc.js              terminal sequences, allowlisted
  statusline/
    prowl-statusline.js opt-in; the only component that sees tokens
```

The three hook scripts contain no decisions. Each reads stdin, calls one pure
function, writes at most one JSON object, and exits 0. That split is why the suite can
be honest: every refusal, every number and every string is a function of a payload,
fixtured without a `HOME` and without a network.

## The session file

`~/.prowl/status/<session_id>.json`, and `~/.prowl/` because the token file already
lives there — this plugin has one home on the machine, not two.

```json
{
  "session_id": "abc123",
  "updated_at": "2026-08-13T15:20:00.000Z",
  "open": { "<tool_use_id>": { "tool": "prowl_analyze", "at": "…" } },
  "recent": [ { "tool": "prowl_call_tool", "ok": true, "ms": 4210, "usd": 0.0125, "at": "…" } ],
  "totals": { "calls": 12, "ok": 11, "failed": 1, "usd": 0.3104 },
  "progress": { "session_id": "sess_…", "value": 0.42, "at": "…" },
  "spoken": [ "<error fingerprint>" ]
}
```

Rules the shape enforces:

- **`open` is keyed by `tool_use_id`.** A count of in-flight calls is the number of
  keys — a thing counted over what it is about, not over the events that produced it.
  A stack would break on the first nested call and a counter would leak on the first
  crash.
- **`recent` holds five.** The sixth push drops the oldest; the array is the record,
  and its length is the display rule.
- **`totals` are summed from the records at write time**, and every `usd` in them was
  returned by the server. No estimate is ever added to this field.
- **`spoken` is why a repeated error is said once.** A fingerprint, not the message.
- **`progress` has a `value` only when a response carried one.** Absent stays absent.

**Writes are atomic**: a temporary file in the same directory, then `rename`. Two
hooks firing in the same instant must not leave half a JSON document, and a rename on
the same filesystem is the only primitive that guarantees it. A read that cannot parse
the file returns an empty state — a corrupt file is a state with nothing in it, never
an exception in somebody's turn.

## The adapter — `lib/prowl.js`

```js
classify(payload) -> null | {kind, tool, id, usd?, progress?, error?, gate?}
```

Pure, total, and it never throws. `kind` is one of `open`, `close`. The rest is
whatever the payload actually proved:

| Field | Where it comes from | When it is absent |
|---|---|---|
| `usd` | `billing.actual_cost_usd` inside the parsed `tool_response.content` | free tools, and any response whose body does not carry one |
| `progress` | `progress` (0..1) in a `prowl_session_status` response | every other tool, and a session that reported none |
| `error` | `tool_response.type === "error"`, or an `error` field in the body | a successful call |
| `gate` | an insufficient-balance error, recognised by its wording **and** by its shape | any other error |

`tool_response.content` is a string. It is parsed with `JSON.parse` inside a `try`, and
a body that is not JSON yields a record with no `usd` and no `progress` rather than a
thrown hook. **A number that could not be read is not a zero** — it is an absence, and
the renderer prints absence differently.

## The renderer — `lib/render.js`

```js
line(state, opts)  -> ''  | one status-line row
block(record)      -> ''  | a short chat notice
```

Grammar, borrowed wholesale from the family's status line because it has already been
found wrong twice in ways this repeats:

- **Every number is borrowed.** The renderer computes nothing it was not given.
- **Absent is a word, never a zero.** `$—` and `$0.00` say different things and must
  never render alike.
- **Nothing to say prints nothing.** A session that has not called Prowl renders `''`.

The line, when there is something in it:

```
prowl ⟳ analyze 1:12 · 12 calls 11✓ 1✗ · $0.31 · 42% · ▸call_tool✓ tool_info✓ search✓ analyze✗ health✓
```

Segments appear only when their source exists: no in-flight call, no `⟳`; no billing
figure yet, no `$`; no `context_window` in the payload, no token segment.

`block()` speaks in the chat, and only for the two things worth interrupting for: a
call that failed, and a wallet gate. Both once per fingerprint.

## Terminal sequences — `lib/osc.js`

Two, both validated against an allowlist before they leave the process, because Claude
Code silently ignores a sequence outside the documented set and a module emitting one
would ship a feature that never fires:

- `OSC 9;4` — the dock/taskbar progress bar, from `progress.value`. Sent only when a
  response carried a fraction; never from an elapsed time, which would be a guess
  wearing a progress bar's clothes.
- `OSC 777` — a desktop notification, for a wallet gate only. A ping on every finished
  call is a ping that gets muted, and then the one that matters is muted with it.

## The status line — `statusline/prowl-statusline.js`

Opt-in, wired by the operator with one documented command. It is the only component
that sees `cost.total_cost_usd` and `context_window.*`, because those exist in no hook
payload. It reads the session file by `session_id` from its own stdin payload — the
shape the status-line documentation itself prescribes, since a pid changes on every
invocation.

Installation guidance names `refreshInterval`, and the reason is in the reference: the
event-driven triggers go quiet while the session waits, which is exactly when a call
is in flight and the elapsed segment must still move.

## What this deliberately does not do

- **It never calls Prowl.** Every number it shows was already in a response the agent
  received. A hook that polled the API would spend the operator's money to draw a
  widget.
- **It does not track subagents.** The boundary for a background agent is not
  decidable from tool calls alone (carry-over C-01).
- **It writes nothing into `~/.claude/settings.json`.** The plugin channel exists so
  that it does not have to.
