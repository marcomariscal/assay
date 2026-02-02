# M5: AI Risk Analysis — Implementation Plan

## Goals
- Add optional AI-powered risk analysis behind `--ai`.
- Support BYOK with multi-provider routing (Anthropic, OpenAI, OpenRouter).
- Enforce config precedence: env vars > config file > provider fallback chain.
- Produce structured, parseable AI output: risk score, summary, concerns.
- Fail fast and clearly when no API key is available.

## Non-Goals (explicit)
- Hosted free tier.
- Caching.

## Assumptions / Open Decisions
- **Config file location**: support `RUGSCAN_CONFIG` (explicit path), else `./rugscan.config.json`, else `~/.config/rugscan/config.json`.
- **Provider selection**: choose based on available keys in fallback order, unless `--model` is provided with an explicit provider prefix (see below).
- **Model override format**: accept `--model` in two formats:
  - Plain model name (uses selected provider)
  - `provider:model` (forces provider when possible), where provider is `anthropic`, `openai`, or `openrouter`

If these assumptions are wrong, adjust before implementation.

## Success Criteria
- `rugscan analyze ... --ai` prints AI summary + risk score + concerns.
- When no API keys are found, CLI exits with a clear error and guidance.
- Provider + model selection is deterministic and testable.
- AI parsing is resilient (invalid JSON does not crash the CLI).

---

## 1. Data Model Changes

### New Types (`src/types.ts`)
Add a minimal AI analysis type and attach it to `AnalysisResult`.

```ts
export type AIRiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export interface AIConcern {
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  explanation: string;
}

export interface AIAnalysis {
  risk_score: number; // 0-100
  summary: string;
  concerns: AIConcern[];
  model: string;
  provider: "anthropic" | "openai" | "openrouter";
}

export interface AnalysisResult {
  // existing fields...
  ai?: AIAnalysis;
}
```

Notes:
- Keep this minimal (no caching fields).
- No `as` casts; use type guards for parsing.

---

## 2. Config & Provider Resolution

### Config schema (JSON)
```json
{
  "ai": {
    "anthropic_api_key": "...",
    "openai_api_key": "...",
    "openrouter_api_key": "...",
    "default_model": "claude-sonnet-4-20250514"
  }
}
```

### Resolution order
1. **Env vars (highest priority)**
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `OPENROUTER_API_KEY`
2. **Config file** (`RUGSCAN_CONFIG` > `./rugscan.config.json` > `~/.config/rugscan/config.json`)
3. **Fallback provider order** (first provider with a key):
   - `ANTHROPIC_API_KEY` → `OPENAI_API_KEY` → `OPENROUTER_API_KEY`

### Provider defaults
- Anthropic: `claude-sonnet-4-20250514`
- OpenAI: `gpt-4o`
- OpenRouter: `anthropic/claude-3-haiku`

### Model override
- `--model <model>` overrides provider default.
- If `--model` is in `provider:model` form, it **forces** provider selection and uses the model value.
- If forced provider has no key, return a clear error.

### Implementation changes
- Extend `Config` to include `ai` settings.
- Create a `loadConfig()` helper (new file, e.g. `src/config.ts`) to:
  - Read env vars.
  - Read config file if present.
  - Merge with proper precedence (env overrides file).
- Update `src/cli/index.ts` to use `loadConfig()`.

---

## 3. CLI/UX Updates

### New flags
- `--ai`: enable AI analysis
- `--model <model>`: override model

### Usage text
Add under Options/Environment:
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`
- Example with `--ai` and `--model`

### Output
- Add a new AI section to `renderResultBox()` when `result.ai` exists:
  - Risk score + label (map score to label or use summary only)
  - Summary (1–2 lines)
  - Top concerns (title + severity)

---

## 4. AI Provider Module

### New file
`src/providers/ai.ts`

Responsibilities:
- Determine provider + model based on config + flags.
- Build structured prompt payload.
- Call provider API via `fetch`.
- Parse JSON response using type guards (no `as`).

### Provider APIs (high-level)
- **Anthropic**: `POST https://api.anthropic.com/v1/messages`
- **OpenAI**: `POST https://api.openai.com/v1/chat/completions`
- **OpenRouter**: `POST https://openrouter.ai/api/v1/chat/completions`

Each request:
- Sends a system prompt + user prompt.
- Requests JSON-only output.
- Includes model.

---

## 5. Prompt Design

### System prompt (structured)
- Strictly output JSON (no prose).
- Schema enforcement with required keys.
- No speculation; use provided data only.

### User prompt content
Include:
- Contract metadata (address, chain, verified, name).
- Proxy info (is_proxy, implementation, beacon).
- GoPlus token security (raw values + interpreted findings).
- Existing non-AI findings (list of codes + messages).
- Source code (if verified). If unverified, still allow AI to reason on metadata only.

### Prompt schema (example)
```json
{
  "risk_score": 0-100,
  "summary": "...",
  "concerns": [
    { "title": "...", "severity": "low|medium|high|critical", "explanation": "..." }
  ]
}
```

---

## 6. Response Parsing

### Approach
- `JSON.parse()` response content.
- Validate with type guards:
  - `risk_score` is number 0–100
  - `summary` is non-empty string
  - `concerns` is array of objects with `title`, `severity`, `explanation`
- If invalid:
  - Return `ai` as undefined.
  - Add a warning finding (level: info) indicating AI parsing failed.

No `as` casting; implement explicit predicate functions.

---

## 7. Analyzer Integration

### Flow changes (`src/analyzer.ts`)
- Accept AI config and flags via the `Config` object.
- After core findings are built:
  - If `--ai` flag on, call `ai.analyzeRisk(...)` with:
    - contract metadata
    - findings
    - proxy info
    - GoPlus data
    - source code
  - Attach `ai` to `AnalysisResult` if successful.

### Error behavior
- If AI call fails due to missing key or provider error:
  - Throw only when `--ai` is requested (user intent).
  - Error message should specify required env vars and fallback order.

---

## 8. Tests

### Unit tests
- Config resolution (env > file > fallback chain).
- Provider + model selection.
- Prompt builder output (contains required fields).
- Response parsing with valid and invalid JSON.

### Integration tests
- Mock fetch for each provider endpoint.
- `--ai` with no keys returns clear error.
- `--ai --model openrouter:anthropic/claude-3-haiku` chooses OpenRouter.

---

## 9. Files & Touch Points

Expected additions/edits:
- `src/types.ts` — AI types + `AnalysisResult.ai`.
- `src/config.ts` — config loader (new).
- `src/providers/ai.ts` — AI provider implementation (new).
- `src/analyzer.ts` — call AI analysis.
- `src/cli/index.ts` — flags + config + errors.
- `src/cli/ui.ts` — render AI results.
- `README.md` — document flags + env vars.
- `test/...` — add unit + integration tests.

---

## 10. Implementation Order

1. Add AI types and config loader.
2. Implement provider selection + model override logic.
3. Add AI provider module (prompt + parsing).
4. Wire into analyzer + CLI flags.
5. Update CLI output formatting.
6. Add tests + README updates.
7. Manual smoke test with real keys.

---

## 11. Manual Verification Checklist

- `--ai` with only `ANTHROPIC_API_KEY` uses Anthropic default model.
- `--ai` with only `OPENAI_API_KEY` uses OpenAI default model.
- `--ai` with only `OPENROUTER_API_KEY` uses OpenRouter default model.
- `--ai --model openai:gpt-4o` forces OpenAI and succeeds.
- `--ai` with no keys fails with a clear message and fallback order.
- Output includes risk score, summary, concerns.
