# rugscan 🔍

Pre-transaction security analysis for EVM agents.

> "Know what you're signing before you sign it."

## Features

- **Contract Analysis** — verification status, age, activity, risk factors
- **Risk Scoring** — 0-100 score with clear reasoning
- **Multi-chain** — Ethereum, Base, Arbitrum, Optimism, Polygon
- **No API keys required** — uses public explorer APIs (rate limited)
- **Agent-native** — built for AI agents, CLI, and MCP

## Installation

```bash
npm install rugscan
# or
bun add rugscan
```

## CLI Usage

```bash
# Analyze a contract
rugscan analyze 0x1234... --chain ethereum

# Quick verification check
rugscan check 0x1234... --chain base

# JSON output
rugscan analyze 0x1234... --json
```

## Library Usage

```typescript
import { analyzeContract, formatAnalysis } from 'rugscan';

const analysis = await analyzeContract('0x1234...', { chain: 'ethereum' });

console.log(formatAnalysis(analysis));
// ⚠️ Contract Risk: MEDIUM (35)
//    Address: 0x1234...
//    Chain: ethereum
//
//    Risk Factors:
//    ✓ Source code verified
//    ⚠️ New contract (15 days old)
//    ⚠️ Low activity (47 txs)
//    ⚠️ Proxy/upgradeable contract
```

## Risk Scoring

| Factor | Points | Notes |
|--------|--------|-------|
| Unverified source | +40 | Critical red flag |
| Age < 7 days | +30 | Very new |
| Age 7-30 days | +15 | New |
| Age 30-90 days | +5 | Establishing |
| Tx count < 10 | +20 | Very low activity |
| Tx count 10-100 | +10 | Low activity |
| Proxy/upgradeable | +15 | Can be changed |
| Has selfdestruct | +20 | Can be destroyed |
| Known protocol | -20 | Trusted |

**Risk Levels:**
- **Low (0-20)** — Well-known, verified, established
- **Medium (21-40)** — Some yellow flags
- **High (41-60)** — Multiple concerns
- **Critical (61+)** — Strong risk indicators

## Environment Variables

Optional — increases rate limits:
```bash
ETHERSCAN_API_KEY=your_key_here
```

## Roadmap

- [ ] Transaction simulation (Tenderly integration)
- [ ] Approval/allowance analysis
- [ ] Known scam database
- [ ] MCP server
- [ ] Clawdbot skill

## License

MIT
