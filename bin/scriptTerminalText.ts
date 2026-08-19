/**
 * Makes deployment-authored text safe to print in an operator's terminal.
 *
 * Scene titles, world names and the rest of a deployment's metadata are written by whoever deployed
 * the scene. Printing them raw hands that person the terminal: a CSI sequence can recolour the
 * output, move the cursor back over lines already written, or erase them, and a newline alone is
 * enough to forge a line the script never emitted -- `Errored worlds: 0` under a report that found
 * plenty. These scripts disable and re-enable places on the strength of what an operator reads in
 * that report, so the report has to be text and nothing else.
 *
 * Written as escapes rather than the characters themselves so that reading this file shows what it
 * matches.
 */

/* eslint-disable no-control-regex --
 * Matching control characters is the entire purpose of this module. The rule exists to catch a regex
 * that matches them by accident, which is the opposite of what these three do.
 */

/**
 * CONTROL below is what makes the output safe: it replaces every C0 and C1 byte, the escape
 * introducer included, so nothing downstream can begin a sequence. The two patterns above it exist to
 * keep what is left readable -- strip a colour sequence whole and a title reads as "Danger" instead of
 * "?[31mDanger?[0m" -- which is why they run first and why removing either changes appearance rather
 * than safety.
 */

/** CSI sequences: colour, cursor movement, erase. */
const CSI_SEQUENCE = /\u001b\[[0-9;?]*[ -/]*[@-~]/g
/** Every other escape introducer, including the OSC that retitles a window. */
const ESCAPE_INTRODUCER = /\u001b[@-Z\\-_]/g
/** C0 and C1 controls, DEL included. Newline, carriage return and tab are in here on purpose. */
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g

/** Long enough to recognize a place by, short enough not to flood a line. */
const MAX_LENGTH = 120

export function forTerminal(value: string | null | undefined): string {
  if (value === null || value === undefined) return "(none)"

  const stripped = value
    .replace(CSI_SEQUENCE, "")
    .replace(ESCAPE_INTRODUCER, "")
    // Replaced rather than dropped: two titles differing only in a control character should not
    // print as one string.
    .replace(CONTROL, "�")

  return stripped.length > MAX_LENGTH
    ? `${stripped.slice(0, MAX_LENGTH)}…`
    : stripped
}
