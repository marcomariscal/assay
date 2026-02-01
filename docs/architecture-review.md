# Rugscan architecture review (pre-transaction security tool)

## Assumptions
- This review is based on the architecture description provided in the request and the public README.
- The tool runs locally for users and calls public APIs over HTTPS when required.
- No server-side component stores or forwards user transaction calldata unless explicitly configured.

## Architecture overview
Rugscan is a pre-transaction security tool with two analysis layers. Layer 1 (contract analysis) is allowed to use cloud AI because the contract source is public. Layer 2 (transaction simulation) must be local-only because pending user transactions reveal private intent. Data sources include Sourcify, Etherscan, GoPlus, DeFiLlama, and cloud AI for contract source analysis.

## Change assessment
The split between public-contract analysis and private-transaction simulation is a clear boundary that maps to data sensitivity. It is aligned with a least-privilege approach: public inputs can be sent to external services, while private inputs are confined to local execution.

## Compliance check (architectural principles)
- Separation of concerns: strong. Layer 1 focuses on static/public analysis; Layer 2 focuses on dynamic/private simulation.
- Dependency inversion: moderate. External APIs are direct dependencies; consider adapters to standardize failures and rate limits.
- Interface stability: OK. Findings and confidence model in README are stable and well-scoped.
- Boundary enforcement: needs explicit runtime enforcement to prevent accidental TX data egress.

## Privacy model soundness
- The model is conceptually sound: contract addresses and verified source are public, while transaction calldata and user wallet are private.
- The main risk is not the model itself, but enforcement. Any accidental logging, telemetry, or AI prompt leakage can break privacy.

## Attack vectors and leakage risks
1. Hidden data egress via logs
   - Debug logs, analytics, crash reports, and error telemetry can leak calldata or wallet addresses.
   - Mitigation: scrub or avoid logging any raw calldata; use structured, redacted logs by default.

2. Indirect leakage via AI prompt context
   - If the prompt template concatenates “context” that includes user-provided fields, calldata could be sent to cloud AI.
   - Mitigation: strict allow-list of prompt fields (only verified source, ABI, and public metadata). Add automated checks.

3. API provider correlation
   - Even public contract queries can correlate a user’s interest in a token at a time window; this can be sensitive.
   - Mitigation: optional proxy/tunnel, configurable providers, or local cache to reduce repeated external calls.

4. Local simulation providers with external dependencies
   - If using a hosted simulation API (Alchemy) with user’s key, the provider still sees calldata.
   - Mitigation: emphasize local fork/eth_call by default; clearly label “hosted simulation” as privacy-reducing.

5. Supply chain and dependency leaks
   - Dependencies could emit telemetry or do remote calls that include user inputs.
   - Mitigation: dependency audit; lockfiles; restrict outbound network from the local runner if possible.

6. Frontend exfiltration
   - If a UI is introduced, browser extensions or analytics scripts can leak TX data.
   - Mitigation: no analytics by default; content security policy; local-only mode with zero third-party scripts.

7. Cache persistence
   - Caching calldata or simulation results on disk could expose user intent if the machine is shared.
   - Mitigation: avoid persistent caches for private data; add opt-in encrypted cache with clear TTL.

8. Privacy boundary confusion
   - Users may not understand that “contract analysis” uses cloud AI.
   - Mitigation: explicit UI/CLI flags and disclaimers for cloud AI; default off for strict privacy mode.

## Structural improvements
1. Explicit data classification layer
   - Introduce a central “data classification” module that tags inputs as public or private.
   - Enforce routing rules at a single gate (e.g., a policy guard that blocks private data from cloud calls).

2. Provider adapters
   - Wrap each data source in a provider adapter with standardized response types, errors, and retry policies.
   - This reduces tight coupling to API quirks and makes it easier to swap providers or run offline.

3. Separate execution contexts
   - Run Layer 2 in a separate process with no outbound network access if possible (local sandbox).
   - This provides a hard boundary rather than relying only on code discipline.

4. Confidence and provenance metadata
   - Attach provenance to findings (source, time, provider) so users know which results are cloud-derived or local.
   - This helps users make informed decisions about privacy and reliability.

## AI prompt design for contract analysis
Goals: precise, safe, and reproducible results without hallucinated claims.

Recommended prompt structure:
- System role: “You are a security auditor of EVM contract source. Use only the provided source and ABI.”
- Input sections: contract source (verified), ABI, compiler version, and known public metadata (chain, address).
- Required output schema: findings array with severity, function names, code refs, and confidence level.
- Explicit prohibitions: “Do not infer owner wallet activity or transaction intent.”

Quality controls:
- Provide a fixed rubric (reentrancy, access control, upgradeability, owner privileges, economic exploits).
- Ask for “evidence lines” (file + function + relevant snippet) to reduce hallucinations.
- Require a “not enough info” response when evidence is missing.
- Use deterministic temperature for consistency in automated scanning.

Privacy controls:
- Only allow contract source and public metadata into the prompt.
- Enforce a strict schema validation before prompt dispatch.
- Add unit tests that verify blocked fields (calldata, wallet address) never appear in prompt payloads.

## Rate limits and API failure handling
- Use adaptive backoff and jitter per provider; do not cascade failures across the pipeline.
- Implement provider-specific budgets and caching for public contract data.
- Support “degraded mode” results: return partial findings with explicit “missing data” reasons.
- Track provider health and surface to users (e.g., “GoPlus unavailable, skipping token checks”).
- For Etherscan-like APIs, batch or throttle with per-chain limits to avoid rate-limit bans.

## Risk analysis (priority)
- High: accidental TX calldata sent to cloud AI or logs.
- Medium: hosted simulation providers seeing calldata.
- Medium: partial data leading to false confidence if provenance is not visible.
- Low: public contract analysis leakage (still may be sensitive via timing correlation).

## Recommendations (actionable)
1. Add a “privacy policy guard” module that blocks any private data from outbound calls.
2. Implement a strict allow-list for AI prompt payloads with unit tests.
3. Offer a “strict local” mode that disables all cloud AI and third-party analytics.
4. Tag every finding with provenance and confidence that reflects data availability.
5. Centralize API adapters with consistent retry/backoff and failure semantics.

## Open questions
- Will users be able to opt out of cloud AI analysis entirely?
- Is there a plan to add a UI or browser extension that could introduce new leakage surfaces?
- Do you need a reproducible audit trail or signed report for compliance?
