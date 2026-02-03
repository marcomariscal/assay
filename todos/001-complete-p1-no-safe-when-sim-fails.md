---
status: complete
priority: p1
issue_id: "001"
tags: [code-review, ux, correctness]
dependencies: []
---

# Block SAFE UX when simulation fails

Ensure the CLI never shows a SAFE/OK risk label when the balance simulation failed or was not run.

## Problem Statement

The new simulation truthfulness semantics require that we never present a SAFE state when simulation fails. With AI risk analysis enabled, the UI currently can show SAFE based on AI risk score even when simulation failed, which violates the UX constraint and can mislead users.

## Findings

- `src/cli/ui.ts` `renderRiskSection()` prefers AI risk score when `result.ai` exists, ignoring simulation status.
- `riskLabel()` can return `SAFE` for AI scores < 30, which will be displayed even if `result.simulation` is missing or `success === false`.
- `applySimulationVerdict()` downgrades `analysis.recommendation` to at least `caution`, but the AI risk label bypasses this guard.

## Proposed Solutions

### Option 1: Clamp AI risk label when simulation failed

**Approach:** If simulation failed, override the displayed label to at least `LOW` or a new `NOT SAFE` label, even when AI is enabled.

**Pros:**
- Minimal UI change; preserves AI details while honoring truthfulness rule.
- Clear and local fix.

**Cons:**
- Requires new label mapping logic in `renderRiskSection()`.

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Prefer recommendation-based risk label on sim failure

**Approach:** If simulation failed, use `recommendationRiskLabel(result.recommendation)` even when AI is enabled, and add a note like `Simulation failed`.

**Pros:**
- Consistent with existing recommendation logic.
- No changes to AI risk model.

**Cons:**
- Hides AI risk label in failure cases.

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 3: Introduce explicit `SIMULATION FAILED` risk state

**Approach:** Add a dedicated display state for simulation failures that supersedes AI and recommendation labels.

**Pros:**
- Most explicit UX; impossible to miss.

**Cons:**
- Slightly larger UI change; requires design decision.

**Effort:** 2-4 hours

**Risk:** Low

## Recommended Action

Clamp AI risk labels to never show `SAFE` when calldata is present and simulation failed or was not run. Keep current high-contrast UI and avoid changing broader risk semantics.

## Technical Details

**Affected files:**
- `src/cli/ui.ts` (risk label rendering)

## Resources

- **PR:** https://github.com/marcomariscal/rugscan/pull/1

## Acceptance Criteria

- [x] When `result.simulation` is missing or `success === false`, the UI never displays `SAFE` (or `OK`) risk label, even when AI is enabled.
- [x] The failure state is clearly communicated in the risk section.
- [x] Automated test coverage exists for the failure + AI enabled case.

## Work Log

### 2026-02-03 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed `renderRiskSection()` behavior with AI enabled.
- Identified SAFE label path unaffected by simulation failure.

**Learnings:**
- Simulation verdicts only guard recommendation-based labels; AI labels bypass them.

### 2026-02-03 - Implementation

**By:** Codex

**Actions:**
- Clamped risk label in `src/cli/ui.ts` to avoid `SAFE` when calldata is present and simulation failed/not run.
- Added CLI rendering tests to ensure `SAFE` never appears in the risk line with AI enabled.

**Learnings:**
- A small UI guard is enough to enforce truthfulness even when AI is enabled.

## Notes

- This is directly tied to the “never SAFE when sim fails” UX requirement.
