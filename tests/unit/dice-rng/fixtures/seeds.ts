// Registered seeds for the statistical tests of GDD #2 (Acceptance Criteria, "Test statistici").
// Algorithm: chacha20-rfc8439, version 1. A fixed seed makes each statistical test a
// deterministic regression, not a new statistical trial on every run.
//
// If a registered seed fails, do NOT swap it silently: run the 20 diagnostic seeds below and
// follow the GDD (0 failures → re-register with a commit; 1 → 100 seeds; 2+ → defect).
// Every change of algorithm (ADR-A) re-registers these with id, version and observed values.

/** Critical chi-square values at p = 1e-4 (scipy.stats.chi2.isf(1e-4, df)). */
export const CHI2_CRITICAL_P1E4 = {
  df1: 15.136705226623397,
  df5: 25.744831959055876,
  df23: 57.07464313855529,
} as const;

// Observed on 2026-11-15 with chacha20-rfc8439 v1:
//   AC-06  χ² = 9.8322 (df 5)   AC-10  χ² = 1.1175 (df 1)
//   AC-13a χ² = 5.6034 (df 5), 39.5778 (df 23)

/** AC-06: d6, 600 000 rolls. */
export const SEED_AC06 = '5eed0006a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c';
/** AC-10: label on 2 of 6 faces, 600 000 rolls. */
export const SEED_AC10 = '5eed0010a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c';
/** AC-13a: shuffles of 3 (60 000) and of 4 (240 000) elements. */
export const SEED_AC13 = '5eed0013a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c';
/** AC-19: rolled with n = 65 175 until F1 rejects a draw. */
export const SEED_AC19 = '5eed0019a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c';
/** AC-21: the "intermediate" seed. */
export const SEED_AC21 = '5eed0021a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c';

/** Diagnostic seeds (outside the suite) for a failing registered seed. */
export const DIAGNOSTIC_SEEDS: readonly string[] = Array.from({ length: 20 }, (_, i) =>
  `d1a9${i.toString(16).padStart(4, '0')}`.padEnd(64, '0'),
);
