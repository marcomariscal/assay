# Assay full rename execution plan

Date: 2026-02-09
Branch: `chore/assay-branding-full-rename`

## Goal
Perform a full product rename to **Assay** across code, CLI/API surfaces, config/env names, docs, tests, fixtures, and scripts with no backward-compat aliases unless build/runtime requires them.

## Scope
1. Core/package naming
   - npm package name
   - CLI/bin command name
   - public SDK symbol names
2. Runtime surfaces
   - CLI help text and examples
   - MCP tool names and server identity
   - JSON-RPC proxy naming/messages
   - server/API env var names
3. Config surfaces
   - env vars (`ASSAY_*`)
   - config filenames (`assay.config.json`)
   - default config paths (`~/.config/assay`)
4. Documentation and schemas
   - README + docs + architecture/audit/roadmap/research/plan docs
   - schema docs and examples
5. Tests and fixtures
   - env var references
   - helper and fixture naming
   - expected text/assertions for renamed outputs

## Execution steps
1. Sweep and inventory all rename targets via repository-wide search.
2. Apply full-case rename transforms for lowercase, title case, and upper-case surfaces.
3. Fix collisions/regressions introduced by mechanical replacement.
4. Run validation:
   - `bun run check`
   - `bun test`
5. Commit + push + PR with explicit breaking-change note.

## Compatibility policy
- No compatibility aliases are retained in this pass by default.
- If any alias must be retained to keep runtime/build green, it must be listed explicitly in PR notes with rationale.
