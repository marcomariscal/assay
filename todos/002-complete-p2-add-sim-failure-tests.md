---
status: complete
priority: p2
issue_id: "002"
tags: [code-review, tests, correctness]
dependencies: []
---

# Add tests for simulation failure verdicts

Add coverage to ensure recommendation and UI semantics are enforced when simulations fail or are not run.

## Problem Statement

New simulation truthfulness logic is core correctness behavior, but it currently lacks targeted tests. This makes regressions likely (e.g., SAFE/OK showing on failure, recommendation not downgraded).

## Findings

- No tests currently cover `applySimulationVerdict()` or its integration in `scanWithAnalysis()`.
- UI paths for failed simulation with calldata are untested (balance section warnings and approvals partial/unknown).
- The new `buildSimulationNotRun()` path is untested.

## Proposed Solutions

### Option 1: Unit tests for `applySimulationVerdict()`

**Approach:** Add tests in `test/scan-apply-simulation-verdict.test.ts` that exercise:
- `simulation.success = false` → recommendation is at least `caution`
- `simulation.success = true` → recommendation unchanged

**Pros:**
- Fast and focused.

**Cons:**
- Doesn’t validate UI semantics.

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Integration tests via scan output

**Approach:** Construct `ScanInput` with calldata and a mocked simulation result to validate output recommendation + simulation notes.

**Pros:**
- Covers real execution path.

**Cons:**
- Slightly more setup for mocks.

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 3: CLI rendering test for failure UX

**Approach:** Snapshot/expectation tests for `renderResultBox()` when simulation fails, including "Simulation failed" and "Approvals unknown/partial".

**Pros:**
- Guards the UX requirement directly.

**Cons:**
- Snapshot tests can be brittle if UI text changes.

**Effort:** 2-4 hours

**Risk:** Low

## Recommended Action

Add focused unit tests for simulation verdict downgrades and CLI risk label rendering when simulation fails or is not run.

## Technical Details

**Affected files:**
- `src/scan.ts` (simulation verdict logic)
- `src/cli/ui.ts` (risk/balance/approval rendering)
- `test/*` (new or updated tests)

## Resources

- **PR:** https://github.com/marcomariscal/rugscan/pull/1

## Acceptance Criteria

- [x] Tests cover recommendation downgrade when simulation fails or is not run.
- [x] Tests cover success path (no downgrade).
- [x] If UI requirements are validated, tests confirm SAFE/OK is not displayed on failure.

## Work Log

### 2026-02-03 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed test suite for simulation truthfulness coverage.
- Identified missing targeted tests.

**Learnings:**
- New behavior is currently unprotected by tests.

### 2026-02-03 - Implementation

**By:** Codex

**Actions:**
- Added unit tests for `applySimulationVerdict` in `test/simulation-verdict.test.ts`.
- Added CLI risk label tests for AI + simulation failure scenarios in `test/cli-risk-simulation-failure.test.ts`.

**Learnings:**
- Small direct unit tests guard the core truthfulness rules without heavy integration overhead.

## Notes

- This is a guardrail against regressions in core semantics.
