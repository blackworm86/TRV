// The display options (quality, animation speed, grid, action camera, effects, words, map
// view from above), kept in the browser between visits.
// The player's display options (Options menu in the bar), kept in this browser.

import { P } from './presentation';

/** Graphics quality: `auto` picks a level from the frame rate and steps down when it drops. */
export type Quality = 'auto' | 'high' | 'medium' | 'low';
export type Level = Exclude<Quality, 'auto'>;
/** Animation speed: complete (slow, every beat), fast, or skip to the result. */
export type Speed = 'full' | 'fast' | 'skip';
/** How the dice rolled during a turn are thrown: by the game, or by the player with TIRA (handroll.ts). */
export type DiceThrow = 'auto' | 'hand';
/** How a car is moved: one space per click, or a whole path planned with waypoints and run with Vai! (waypoints.ts). */
export type MoveMode = 'step' | 'path';
/**
 * `director2`: the new camera director (shots.ts) films the events; off, the old fixed shots do.
 * The beats are always played as the director's scenes, one at a time, each after the table is truly
 * still (scenePlayer.ts): the option that chose it, `newMotion`, is gone (asked by the user,
 * 2026-11-20: everything on the new motion); a stored value of it is ignored. So is `testCar`, the
 * test car standing in for the Medium Car: the Medium Car itself is now mounted from its parts.
 */
export interface Settings { quality: Quality; speed: Speed; dice: DiceThrow; move: MoveMode; grid: boolean; actionCam: boolean; director2: boolean; effects: boolean; words: boolean; zenith: boolean }
export const SETTINGS_KEY = 'trv-settings';
export const settings: Settings = { quality: 'auto', speed: 'full', dice: 'auto', move: 'step', grid: true, actionCam: true, director2: true, effects: true, words: true, zenith: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>); } catch { /* defaults */ }
export function saveSettings(): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage off */ }
}
/** How fast the beats play for each speed setting (full: 1, back from 0.6, which the user judged too slow on 2026-11-20). */
export const SPEED_SCALE: Record<Speed, number> = P.beats.speedScale;
/** What each quality level changes: render resolution, the lamp's shadow, model texture size, effects. */
export const LEVELS: Record<Level, { pixelRatio: number; shadow: number; texture: number; particles: number }> = {
  high: { pixelRatio: 2, shadow: 4096, texture: 4096, particles: 1 },
  medium: { pixelRatio: 1.25, shadow: 2048, texture: 1024, particles: 0.6 },
  low: { pixelRatio: 0.85, shadow: 0, texture: 512, particles: 0.3 },
};
/** The level in use now (under `auto`, the one the frame rate allows). */
