// Which of the Big Rig's questions are answered by clicking a system on its boards (hud.ts): the
// systems the question names are lit, and a click on one picks it. Kept apart from hud.ts so it can
// be checked without a page (tests/unit/app/rigchoice.test.ts).

import type { Decision } from '../game/trv/engine';

/**
 * True when `d` is answered on the Big Rig's boards, by clicking one of the systems its options
 * name (`rig`): where a minor damage goes, and which damage the Big Rig's Repair clears (BRaFF p6;
 * the same kind as the cars' repair, whose options name cars instead).
 */
export function picksRigSystem(d: Decision | null | undefined): boolean {
  if (!d) return false;
  return d.kind === 'rigDamage' || (d.kind === 'repair' && d.options.some(o => o.rig !== undefined));
}
