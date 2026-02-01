# M5: AI Contract Analysis Plan

## Goals
- Explain verified contract source code in plain English.
- Surface concrete risks with evidence and code references.
- Highlight functions of concern for quick inspection.
- Provide confidence and model metadata for traceability.

## 1. Architecture

### Where AI analysis fits
1. **Fetch** verified source code and metadata (existing pipeline step).
2. **Normalize** source (flatten, resolve pragmas, keep file/line maps).
3. **Analyze** (new M5 step).
4. **Report** to CLI output and JSON artifact.

### Trigger conditions
- Only run when:
  - Contract is **verified** and source is available.
  - Source size is within limits (configurable).
  - User explicitly asks via `--ai` or `--deep`.

### Performance and speed
- **Cache** analysis by source hash + model version + prompt version.
- **Stream** partial results to CLI as soon as summary/risk level is ready.
- **Model selection**:
  - Fast pre-screen for high-level risk signals.
  - Deep pass only when needed or explicitly requested.

### Proposed pipeline placement
```
verified_source -> normalized_source -> ai_pre_screen -> (optional) ai_deep -> merged_report
```

## 2. Prompt Engineering

### System prompt (analysis)
```
You are a security-focused smart contract reviewer.
You analyze Solidity source code and produce a structured JSON report.
You must cite risky patterns with specific functions and code snippets.
You must not speculate beyond the provided code.
If you are uncertain, lower confidence and explain why.
```

### User prompt context
Include:
- Contract name
- Chain and address
- Compiler version
- Full verified source (with file names)
- Normalized file/line map

### Output schema
Use the required `AIAnalysis` type exactly.

### Few-shot examples
Include two compact examples in the prompt to anchor output style:
- **Good contract**: standard ERC20 with renounced ownership or timelock.
- **Bad contract**: token with `ownerWithdraw()` or arbitrary `call()`.

Example snippet (short, for prompt only):
```
// Bad example
function sweep(address token, address to, uint256 amount) external onlyOwner {
  IERC20(token).transfer(to, amount);
}
```

## 3. Risk Patterns to Detect

### Required patterns
- Hidden admin functions (`onlyOwner` or role-based drainers).
- Suspicious fund flows (ETH/token transfers to arbitrary address).
- Backdoor patterns (hardcoded addresses, kill switches, pause + drain).
- Reentrancy issues (external calls before state updates).
- Fake decentralization (owner can change fees, mint, blacklist).
- Proxy abuse (upgradeable to unknown or owner-controlled implementation).

### Heuristic signals
- `delegatecall` to owner-controlled addresses.
- Arbitrary `call` with user-supplied data.
- `selfdestruct` or `suicide` on privileged functions.
- Unlimited minting or balance edits.

## 4. Model Strategy

### Model tiers
- **Pre-screen**: fast, low-cost model.
  - Examples: `gpt-4o-mini`, `claude-haiku`.
  - Goal: quick summary + rough risk level + simple flags.
- **Deep analysis**: higher-accuracy model.
  - Examples: `claude-sonnet`, `gpt-4o`.
  - Goal: detailed risks, function-level analysis, better confidence.

### Decision rules
- Always run pre-screen.
- Run deep analysis when:
  - `--deep` is provided.
  - Pre-screen risk is `medium` or higher.
  - Contract uses proxies or complex patterns.

### Cost estimation (config-driven)
Define a per-token cost table in config and compute:
```
estimated_cost = (prompt_tokens + completion_tokens) * cost_per_token
```
Track actual usage when provider returns token counts.

## 5. Output Format

Use the required type:

```typescript
type AIAnalysis = {
  summary: string
  risk_level: 'safe' | 'low' | 'medium' | 'high' | 'critical'
  risks: {
    title: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    explanation: string
    code_snippet?: string
    line_numbers?: [number, number]
  }[]
  functions_of_concern: {
    name: string
    signature: string
    reason: string
  }[]
  positive_signals: string[]
  confidence: number
  model_used: string
  analysis_time_ms: number
}
```

## 6. Integration

### CLI flags
- `--ai`: run pre-screen analysis.
- `--deep`: run deep analysis (implies `--ai`).

### New provider
Create `src/providers/ai.ts`:
- `analyzeContract(source, meta, mode)`
- Handles model routing, prompt assembly, and parsing.

### Caching
- Hash source + model + prompt version:
```
cache_key = sha256(source + model + prompt_version)
```
- Store in `~/.cache/rugscan/ai/<cache_key>.json`.

### Rate limiting
- Token bucket per provider (e.g., 5 req/min default).
- Backoff on `429` and retry with jitter.

## 7. Testing

### Test fixtures
- **Known rugs** (collect from public incident reports):
  - Drainer token with `ownerWithdraw`.
  - Upgradeable proxy where owner can change impl.
  - Token with blacklisting + mint-to-owner.
- **Known safe**:
  - OpenZeppelin ERC20 preset.
  - Simple ERC721 without admin bypass.
  - Timelocked governance contract.

### Metrics
- Accuracy vs labeled dataset.
- False positive rate per risk level.
- Median latency per model.

### Test types
- Unit tests for prompt assembly and schema parsing.
- Snapshot tests for stable analysis outputs.
- Golden tests on curated fixtures.

## 8. Future: Fine-tuning

- Build labeled dataset (rug vs legit) from verified sources.
- Fine-tune a small model for pre-screening.
- Explore on-device inference for offline analysis.

## Implementation Sketch (Pseudo-code)

```typescript
const analysis = await ai.analyzeContract(source, meta, {
  mode: flags.deep ? 'deep' : 'fast',
  cache: true,
  stream: true,
})
```

## Success Criteria
- `--ai` adds analysis output in CLI within 3-5s for typical contracts.
- `--deep` adds detailed risk findings with line references.
- Cached runs return instantly for unchanged sources.
```
