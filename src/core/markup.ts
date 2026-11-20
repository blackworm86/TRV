/**
 * Text put inside HTML or SVG markup, with its special characters escaped, so a name or a rule's
 * text never breaks the markup, in an element or in an attribute. One copy for the whole game
 * (2026-11-20: there were eleven, some leaving quotes as they were).
 * Example: `<b title="${esc(name)}">${esc(name)}</b>`.
 */
export const esc = (s: string): string => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
