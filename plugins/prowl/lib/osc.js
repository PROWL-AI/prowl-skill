'use strict';
/**
 * The two terminal sequences this plugin emits, and the allowlist that keeps them
 * from being silently dropped.
 *
 * Claude Code honours OSC 0, 1, 2, 9, 99, 777 and a bare BEL in a hook's
 * `terminalSequence`, and **silently ignores** the field when it carries anything
 * else. Silently is the operative word: a module that built a sequence outside that
 * set would ship a feature that never fires and never complains, so this validates
 * before returning rather than trusting itself.
 *
 * Every control byte is written as an escape, never as itself — a literal ESC in a
 * source file survives exactly as long as nothing reformats it.
 *
 * Pure: values in, a string out, `''` when there is nothing safe to emit.
 */

const ALLOWED_OSC = [0, 1, 2, 9, 99, 777];

const ESC = '\u001b';
const BEL = '\u0007';

/**
 * Text safe to place inside an OSC payload.
 *
 * A semicolon separates an OSC 777 sequence's own fields and a control byte can end
 * the sequence early. Both turn a notification into terminal garbage, and the second
 * is an injection — the message is text that came back from a server.
 */
function sanitise(text, limit) {
  return String(text || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/;/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit || 120);
}

/** Is every sequence in this string inside the allowlist? Every one, not the first. */
function isAllowed(seq) {
  let rest = String(seq == null ? '' : seq);
  if (!rest) return false;
  while (rest.length) {
    if (rest[0] === BEL) { rest = rest.slice(1); continue; }
    const m = new RegExp(`^${ESC}\\](\\d+);[^${ESC}${BEL}]*${BEL}`).exec(rest);
    if (!m || !ALLOWED_OSC.includes(Number(m[1]))) return false;
    rest = rest.slice(m[0].length);
  }
  return true;
}

/**
 * The taskbar/dock progress bar, from a fraction the server actually reported.
 *
 * State 1 is "normal progress". The percentage is rounded to an integer because the
 * sequence carries one, and clamped only inside 0..100 — a value outside 0..1 never
 * reaches here, because the adapter refuses it rather than guessing whether 42 meant
 * a percent.
 */
function progress(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return '';
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const seq = `${ESC}]9;4;1;${pct}${BEL}`;
  return isAllowed(seq) ? seq : '';
}

/** Take the bar down. Sent when the thing it was describing has finished. */
function progressClear() {
  const seq = `${ESC}]9;4;0;${BEL}`;
  return isAllowed(seq) ? seq : '';
}

/**
 * A desktop notification.
 *
 * Reserved for the wallet gate. A ping on every finished call is a ping that gets
 * muted, and then the one that matters is muted with it.
 */
function notify(title, body) {
  const t = sanitise(title, 60);
  const b = sanitise(body, 160);
  if (!b) return '';
  const seq = `${ESC}]777;notify;${t || 'Prowl'};${b}${BEL}`;
  return isAllowed(seq) ? seq : '';
}

module.exports = { progress, progressClear, notify, isAllowed, sanitise, ALLOWED_OSC, ESC, BEL };
