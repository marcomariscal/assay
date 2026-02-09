# Issue #41 — Approval diffs engine (wallet-fast) — workflows plan

## Context
Issue: #41

Goal: make approval-change detection **trustworthy + fast** in wallet mode, across:
- ERC-20 approvals (event + allowance diff)
- Permit2 approvals (event + Permit2 allowance diff)
- ERC-721 approvals (`getApproved` + `ApprovalForAll`)
- ERC-1155 approvals (`ApprovalForAll`)

Marco direction to preserve:
1. Approvals must have their **own confidence** field (independent from balances).
2. Approval changes must be **front-and-center** in output.
3. Wallet-fast path must return both balance deltas and approval changes.

---

## Current codebase status (what we can leverage)

### Already present
- `src/simulations/approval-diffs.ts` (WIP, untracked):
  - `buildApprovalDiffs(approvals, client, { beforeBlock, afterBlock })`
  - per-slot pre/post reads for ERC20/Permit2/ERC721/ERC1155
  - fallback behavior + low-confidence notes on read failure
- `src/simulations/logs.ts`:
  - parses approval events into `ParsedApproval`
  - includes Permit2 event parsing and ERC-721/1155 `ApprovalForAll`
- `src/types.ts`:
  - `ApprovalChange` exists
  - `BalanceSimulationResult` currently has single `confidence`
- Wallet-fast balance path exists in `src/simulations/balance.ts` (`simulateWithAnvilWalletFast`)
- CLI section rendering exists in `src/cli/ui.ts` (`🔐 APPROVALS`)

### Current gaps vs issue requirements
- Wallet-fast currently uses **event-only approvals** (no before/after allowance diff integration).
- No separate `approvalsConfidence` field.
- UI does not explicitly treat approvals as a separate-confidence first-class section.
- No direct unit tests around the new approval diff engine module.

---

## Architecture plan

## 1) Data model + API shape

### 1.1 Balance simulation result
Add a separate required confidence field:
- `src/types.ts` `BalanceSimulationResult`
  - keep existing `confidence` (balance/asset confidence)
  - add `approvalsConfidence: ConfidenceLevel`

Mirror this in:
- `src/schema.ts` TypeScript interface + Zod schema
- `src/scan.ts` `mapSimulation()` JSON mapping

### 1.2 Approval change shape (for true diffs)
`approval-diffs.ts` already computes previous state for multiple standards. To preserve that signal in output, extend `ApprovalChange` with optional “before” fields (non-breaking):
- `previousAmount?: bigint`
- `previousApproved?: boolean`
- `previousSpender?: string`

And schema stringified counterparts in `src/schema.ts`:
- `previousAmount?: string`
- `previousApproved?: boolean`
- `previousSpender?: string`

This lets output render **actual change** (e.g., `0 -> UNLIMITED`, `true -> false`) rather than just current state.

---

## 2) Wallet-fast integration flow

Target file: `src/simulations/balance.ts` (`simulateWithAnvilWalletFast`)

### Planned flow (post-receipt)
1. Execute tx and get successful receipt.
2. Parse logs (`parseReceiptLogs`) as today.
3. Build balance deltas as today.
4. Build approvals via `buildApprovalDiffs` (new integration):
   - filter approvals to actor-owned slots: `approval.owner === from`
   - derive block window:
     - `beforeBlock = receipt.blockNumber - 1n` (if available)
     - `afterBlock = receipt.blockNumber`
   - pass wallet-fast anvil client as `ApprovalDiffClient`
5. Merge approval result:
   - `approvals = diffResult.approvals`
   - `approvalsConfidence = diffResult.confidence`
   - append `diffResult.notes` into simulation notes
6. Enrich approval token metadata as today (`applyApprovalMetadata`).
7. Return both:
   - `confidence` (balances)
   - `approvalsConfidence` (approvals)

### Confidence handling rules
- Keep independent accumulators:
  - `balanceConfidence`
  - `approvalsConfidence`
- Shared simulation-level failures can reduce both (e.g., tx failed).
- Approval-read failures reduce **approvalsConfidence only**.
- Balance-read failures reduce **balance confidence only**.

---

## 3) Rendering + UX plan (front-and-center approvals)

Target file: `src/cli/ui.ts`

### 3.1 Approvals section prominence
Keep a dedicated first-class approvals block (not buried in findings), and make lines change-oriented:
- ERC20/Permit2 examples:
  - `Allow <spender> up to <new> <token> (was <prev>)`
  - `Revoke allowance ...` when new amount is zero
- ERC721/1155 ApprovalForAll:
  - `Grant operator for ALL ...` / `Revoke operator for ALL ...`
- ERC721 token approval:
  - `Approve token #123 -> <spender>` / revoke/change variants

### 3.2 Confidence display
- Balance section continues to show note from `simulation.confidence`.
- Approvals section gets its own note from `simulation.approvalsConfidence`.
- If approvals are unknown/partial, wording should explicitly say approvals are uncertain.

### 3.3 Risk + policy uncertainty logic
Current `INCONCLUSIVE` logic is based on `simulation.confidence` only.
Update to consider both confidences:
- inconclusive when calldata exists and either:
  - simulation missing/failed, or
  - `confidence !== "high"`, or
  - `approvalsConfidence !== "high"`

Message should remain explicit that balances and/or approvals may be unknown.

---

## 4) Test strategy (deterministic, fixture-backed)

## 4.1 Unit tests for approval diff engine (new)
Add `test/approval-diffs.unit.test.ts` with mocked `ApprovalDiffClient`:
- ERC20 allowance diff: `0 -> N`, `N -> 0`, unchanged
- Permit2 allowance diff (`uint160` amount extraction)
- ERC721 token approval diff (`getApproved` changes)
- ERC721/1155 `ApprovalForAll` boolean diffs
- dedupe same slot by latest `logIndex`
- read failure path: fallback approval + low confidence + note

No network calls; pure deterministic mocks.

## 4.2 Wallet-fast integration tests
- Extend fixture-backed wallet tests to assert approvals confidence + changes are present.
- Minimum acceptance coverage:
  - `wallet-approve-usdc-unlimited-f7bf0220` shows explicit approval change in output and simulation payload.

Practical options:
- add wallet-mode contract test around `renderResultBox` using the recording fixture’s analysis payload.
- add e2e fixture (`ASSAY_FORK_E2E=1`) for approval txs to verify integrated Anvil path.

## 4.3 Schema/contract tests
Update tests that construct `BalanceSimulationResult` literals:
- `test/cli-risk-simulation-failure.test.ts`
- `test/simulation-verdict.test.ts`
- `test/simulation-drainer-heuristics.test.ts`
- `test/viem-transport.unit.test.ts`
- `test/north-star-ux.contract.test.ts`
- proxy integration tests with inline simulation payloads

Add assertions for `approvalsConfidence` where relevant.

## 4.4 Snapshot updates
Update snapshot fixtures where rendering changes:
- `test/__snapshots__/ui-recordings.snapshot.test.ts.snap`
- relevant `test/fixtures/recordings/*/rendered.txt` if canonical wording/order changes

---

## 5) Performance plan (<5s wallet-fast total)

Budget guardrails:
- Reuse existing wallet-fast budget (`budgetMs`, default 5000ms).
- Add timing entries for approval diff stage (e.g. `simulation.walletFast.approvals`).
- If budget is exhausted before approval reads complete:
  - fall back to parsed-event approvals
  - set `approvalsConfidence` to at most `medium`
  - append deterministic note explaining fallback

Call-volume controls (if needed):
- Optional cap on approval slots processed in wallet-fast (e.g. first N by log order), with explicit note + confidence downgrade when truncated.

---

## 6) File-level change plan

Likely touched files:
- `src/types.ts`
- `src/schema.ts`
- `src/scan.ts`
- `src/simulations/balance.ts`
- `src/simulations/approval-diffs.ts` (adopt tracked module + any API refinements)
- `src/cli/ui.ts`
- `src/simulations/verdict.ts` (ensure `buildSimulationNotRun` includes approvals confidence)
- tests listed above
- optional docs update: `docs/north-star-ux.md` (uncertainty semantics with separate approval confidence)

---

## 7) Risks / unknowns

1. **Historical reads at `beforeBlock`**
   - Some RPC/fork setups may fail historical state reads for certain contracts.
   - Mitigation: fallback event-based approvals + explicit low/medium approvals confidence.

2. **Approval event coverage limits**
   - Engine is event-seeded; non-standard contracts that mutate approval state without standard events can be missed.
   - Mitigation: explicit “best-effort” notes and confidence downgrade.

3. **Slot explosion in complex txs**
   - Many approval events can increase read calls.
   - Mitigation: budget-aware fallback + optional slot cap.

4. **UX wording drift vs north-star snapshots**
   - Rendering improvements will likely require coordinated fixture/snapshot updates.

---

## 8) Validation checklist

Before merge:
- `bun run check`
- `bun run test`
- (recommended) `bun run build` (to catch TS contract drift in `src/**/*`)

Acceptance checks:
- Wallet-fast output includes approval changes + dedicated approvals confidence.
- Balance and approvals confidence can diverge (independent behavior verified in tests).
- USDC unlimited approval wallet recording shows approval change prominently.
- No `as` casts introduced.
- Deterministic tests only (no cloud calls).
