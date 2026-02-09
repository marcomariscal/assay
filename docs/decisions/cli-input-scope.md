# CLI input scope (M8)

Date: 2026-02-02
Status: proposed

## Assumptions
- The CLI is primarily for developers, CI, and bots/agents, not wallet end-users.
- Pre-sign scanning needs unsigned intent (to/data/value/chain), not tx hashes.
- Users who only have raw hex or ABI can transform inputs with external tools.

## Who actually uses the CLI
- Devs testing contracts and scripts.
- Bots/agents that assemble tx intents from code or RPC.
- Power users copying from wallets are a minority and better served by UI later.

## What they actually have
- Devs: a transaction request object (to/data/value/chainId) in code.
- Agents: a structured tx payload (often JSON from an RPC or internal model).
- Wallet users: usually do not have calldata in a reliable, copyable format.

## Decision: minimal viable input surface for M8
Support exactly two input shapes:

1) Address scan (existing usage)
- `assay scan <address> [--chain <chain>]`

2) Calldata scan (canonical JSON)
- `assay scan --calldata <json|@file|-> [--chain <chain>]`

Calldata JSON schema (canonical):
```json
{ "to": "0x...", "data": "0x...", "value": "0", "chain": "1" }
```
- Required: `to`, `data`
- Optional: `value`, `chain`
- `--chain` overrides `chain` when both are provided.

## Explicitly out of scope for M8
- Raw hex + context strings
- ABI + args encoding
- JSON-RPC blob extraction
- Flag-based `--to/--data/--value` inputs

## Rationale and tradeoffs
- One canonical JSON schema keeps CLI/REST/SDK aligned and stable.
- Parsing/validation is simpler and less error-prone.
- Tradeoff: manual copy/paste is less convenient, but that is not the CLI's core user.
- External tools (`cast`, `viem`, `jq`) can convert other formats when needed.

## Unix philosophy check
- Do one thing well: accept a single, explicit schema.
- Let users transform inputs upstream rather than expanding CLI complexity.
