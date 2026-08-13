#!/usr/bin/env node
'use strict';
/**
 * `SessionStart` — the sweep, and nothing else.
 *
 * One small file per session accumulates forever otherwise: the kind of litter nobody
 * notices until it is thousands of files in a directory that also holds an API token.
 *
 * It prints **nothing**. A plugin that announces itself at the start of every session
 * is the 854-token cost that got another pack switched off on this machine, and this
 * one has nothing to say that the status line does not say better, later, and only
 * when there is something to report.
 *
 * Fails silent, always exits 0.
 */

const path = require('path');
const os = require('os');

const RETENTION_MS = 1000 * 60 * 60 * 24 * 7;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  try {
    require(path.join(__dirname, '..', 'lib', 'state.js'))
      .prune(os.homedir(), Date.now(), RETENTION_MS);
  } catch (e) {
    /* Nothing to prune is the normal case, and a failed sweep is not worth a word. */
  }
  process.exit(0);
});
