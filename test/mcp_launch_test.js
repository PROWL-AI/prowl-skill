'use strict';
/**
 * The launcher in `plugins/prowl/.mcp.json`, executed — not read.
 *
 * The regression this suite exists for: with no API key the launcher used to hand an
 * empty `Authorization: Bearer` to `mcp-remote`, which the server rejects and which
 * sends `mcp-remote` into its OAuth fallback. That fallback opens a browser and waits
 * on a localhost callback, and an MCP server started by an agent does not live long
 * enough to be there when the browser comes back — the port is dead by then, the
 * consent screen redirects into nothing, and the operator is left holding a URL.
 * Measured on this machine 2026-08-22: two such flows in one day, both stranded.
 *
 * So the launcher must REFUSE to start without a key, and say what to do instead.
 *
 * Both halves are checked by running the real artifact. `sh -lc` is a login shell, so
 * on macOS `/etc/profile` runs `path_helper`, which pushes any injected PATH entry to
 * the END — shadowing `npx` by PATH alone does not work. A `.profile` in the fake HOME
 * is sourced after `path_helper` and does win, and that is how the real `npx` argv is
 * captured here. No network: the fake `npx` is all this suite ever executes.
 *
 * The second regression (2026-10-11): the key used to ride in `mcp-remote`'s argv as
 * `Authorization: Bearer <key>`, readable by any same-user `ps`/`pgrep -fl`. Two
 * Prowl keys leaked from this machine exactly that way (2026-10-04, 2026-10-09). The
 * launcher now exports the header value as `PROWL_MCP_AUTH` and passes the literal
 * placeholder `Authorization:${PROWL_MCP_AUTH}`, which `mcp-remote` expands from its
 * own environment. The fake `npx` records that variable beside its argv.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { it, report } = require('./_harness');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = path.join(ROOT, 'plugins', 'prowl', '.mcp.json');

const server = JSON.parse(fs.readFileSync(CONFIG, 'utf8')).mcpServers.prowl;

/** Exit code the launcher uses for "configured wrong" (EX_CONFIG, sysexits.h). */
const EX_CONFIG = 78;

/**
 * Run the real launcher against a throwaway HOME.
 *
 * @param {{files?: Record<string,string>, env?: Record<string,string>}} opts
 *   files — paths relative to the fake HOME, written before the run.
 *   env   — extra environment on top of the minimal set.
 */
function launch(opts = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'prowl-launch-'));
  const bin = path.join(home, '.fakebin');
  const log = path.join(home, 'npx-argv.txt');
  const envLog = path.join(home, 'npx-auth.txt');

  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'npx'), '#!/bin/sh\nprintf "%s\\n" "$@" > "$FAKE_NPX_LOG"\nprintf "%s" "${PROWL_MCP_AUTH-<unset>}" > "$FAKE_NPX_ENV_LOG"\n');
  fs.chmodSync(path.join(bin, 'npx'), 0o755);
  // Sourced after `path_helper`, so this PATH is the one the launcher sees.
  fs.writeFileSync(path.join(home, '.profile'), `PATH="${bin}:$PATH"\nexport PATH\n`);

  for (const [rel, body] of Object.entries(opts.files || {})) {
    const target = path.join(home, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }

  const r = spawnSync(server.command, server.args, {
    env: { HOME: home, PATH: '/usr/bin:/bin', FAKE_NPX_LOG: log, FAKE_NPX_ENV_LOG: envLog, ...(opts.env || {}) },
    encoding: 'utf8',
    timeout: 20000,
  });

  return {
    status: r.status,
    stderr: r.stderr || '',
    npxArgv: fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : null,
    npxAuth: fs.existsSync(envLog) ? fs.readFileSync(envLog, 'utf8') : null,
    cleanup: () => fs.rmSync(home, { recursive: true, force: true }),
  };
}

function withLaunch(opts, fn) {
  const r = launch(opts);
  try {
    fn(r);
  } finally {
    r.cleanup();
  }
}

// ---------------------------------------------------------------- refuses to start

it('exits EX_CONFIG when no key is configured anywhere', () => {
  withLaunch({}, (r) => {
    assert.strictEqual(r.status, EX_CONFIG, `expected ${EX_CONFIG}, got ${r.status}`);
  });
});

it('never reaches npx when no key is configured', () => {
  // The proof that OAuth cannot be entered: `mcp-remote` is the only thing that could
  // open a browser, and it is never executed.
  withLaunch({}, (r) => {
    assert.strictEqual(r.npxArgv, null, 'npx ran without a key');
  });
});

it('names both ways to supply a key, and says why it is not using OAuth', () => {
  withLaunch({}, (r) => {
    assert.ok(/prowl-skill token/.test(r.stderr), `remedy missing from stderr: ${r.stderr}`);
    assert.ok(/PROWL_MCP_TOKEN/.test(r.stderr), `env var missing from stderr: ${r.stderr}`);
    assert.ok(/OAuth/.test(r.stderr), `OAuth refusal unexplained: ${r.stderr}`);
  });
});

it('treats an empty key file as no key', () => {
  withLaunch({ files: { '.prowl/prowl_mcp_token': '' } }, (r) => {
    assert.strictEqual(r.status, EX_CONFIG);
    assert.strictEqual(r.npxArgv, null);
  });
});

it('treats a whitespace-only key file as no key', () => {
  withLaunch({ files: { '.prowl/prowl_mcp_token': '  \n\t\n' } }, (r) => {
    assert.strictEqual(r.status, EX_CONFIG);
    assert.strictEqual(r.npxArgv, null);
  });
});

it('treats a whitespace-only PROWL_MCP_TOKEN as no key', () => {
  withLaunch({ env: { PROWL_MCP_TOKEN: '   ' } }, (r) => {
    assert.strictEqual(r.status, EX_CONFIG);
    assert.strictEqual(r.npxArgv, null);
  });
});

// ------------------------------------------------------- starts, with the key it found

/** The literal argument: `mcp-remote` expands the placeholder from its own environment. */
const HEADER_ARG = 'Authorization:${PROWL_MCP_AUTH}';

/** Every source the launcher documents, in the order it consults them. */
const SOURCES = [
  ['PROWL_MCP_TOKEN', { env: { PROWL_MCP_TOKEN: 'prowl_env' } }, 'prowl_env'],
  ['~/.prowl/prowl_mcp_token', { files: { '.prowl/prowl_mcp_token': 'prowl_plugin\n' } }, 'prowl_plugin'],
  ['~/.codex/prowl_mcp_token', { files: { '.codex/prowl_mcp_token': 'prowl_codex\n' } }, 'prowl_codex'],
];

for (const [label, opts, expected] of SOURCES) {
  it(`starts mcp-remote with the key from ${label}`, () => {
    withLaunch(opts, (r) => {
      assert.ok(r.npxArgv, `npx never ran for ${label} (exit ${r.status}): ${r.stderr}`);
      assert.ok(r.npxArgv.includes('mcp-remote'), `not mcp-remote: ${r.npxArgv}`);
      assert.strictEqual(r.npxAuth, `Bearer ${expected}`, `PROWL_MCP_AUTH did not carry the key from ${label}`);
      assert.ok(r.npxArgv.includes(HEADER_ARG), `header placeholder missing: ${JSON.stringify(r.npxArgv)}`);
    });
  });

  it(`keeps the key from ${label} out of mcp-remote's argv`, () => {
    withLaunch(opts, (r) => {
      assert.ok(r.npxArgv, `npx never ran for ${label}`);
      const leaked = r.npxArgv.filter((a) => a.includes(expected));
      assert.deepStrictEqual(leaked, [], `key in argv, visible to ps: ${JSON.stringify(leaked)}`);
    });
  });
}

it('prefers the env var over both files', () => {
  withLaunch(
    {
      env: { PROWL_MCP_TOKEN: 'prowl_env' },
      files: { '.prowl/prowl_mcp_token': 'prowl_plugin', '.codex/prowl_mcp_token': 'prowl_codex' },
    },
    (r) => {
      assert.strictEqual(r.npxAuth, 'Bearer prowl_env');
    },
  );
});

it('prefers the plugin file over the Codex file', () => {
  withLaunch(
    { files: { '.prowl/prowl_mcp_token': 'prowl_plugin', '.codex/prowl_mcp_token': 'prowl_codex' } },
    (r) => {
      assert.strictEqual(r.npxAuth, 'Bearer prowl_plugin');
    },
  );
});

it('still points at the hosted endpoint over http-first transport', () => {
  withLaunch({ env: { PROWL_MCP_TOKEN: 'prowl_env' } }, (r) => {
    assert.ok(r.npxArgv.includes('https://prowl.chat/mcp'), JSON.stringify(r.npxArgv));
    assert.ok(r.npxArgv.includes('http-first'), JSON.stringify(r.npxArgv));
  });
});

report('mcp launch');
