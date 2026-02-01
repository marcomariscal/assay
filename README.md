# rugscan

Pre-transaction security analysis for EVM contracts. Know what you're signing before you sign it.

## Features

- **Contract verification check** — Sourcify (free) + Etherscan
- **Proxy detection** — EIP-1967, UUPS, Beacon, minimal proxies
- **Token security** — Honeypot, hidden mint, blacklist, tax (via GoPlus)
- **Protocol matching** — DeFiLlama integration
- **Confidence levels** — Honest about what we can't see

## Install

```bash
bun add rugscan
```

## CLI Usage

```bash
# Basic analysis
rugscan analyze 0x1234...

# Specify chain
rugscan analyze 0x1234... --chain base
```

### Environment Variables

For full analysis, provide block explorer API keys:

```bash
export ETHERSCAN_API_KEY=your_key
export BASESCAN_API_KEY=your_key
export ARBISCAN_API_KEY=your_key
```

Without keys, analysis uses Sourcify only (limited coverage).

## Library Usage

```typescript
import { analyze } from "rugscan";

const result = await analyze("0x1234...", "ethereum", {
  etherscanKeys: {
    ethereum: process.env.ETHERSCAN_API_KEY,
  },
});

console.log(result.recommendation); // "ok" | "caution" | "warning" | "danger"
console.log(result.findings); // Array of findings with level + code + message
console.log(result.confidence); // { level: "high" | "medium" | "low", reasons: [...] }
```

## Supported Chains

- Ethereum
- Base
- Arbitrum
- Optimism
- Polygon

## Finding Codes

| Code | Level | Meaning |
|------|-------|---------|
| `UNVERIFIED` | danger | No source code available |
| `HONEYPOT` | danger | Can buy, can't sell |
| `HIDDEN_MINT` | danger | Owner can mint unlimited |
| `SELFDESTRUCT` | danger | Contract can self-destruct |
| `OWNER_DRAIN` | danger | Owner can modify balances |
| `BLACKLIST` | warning | Has blacklist functionality |
| `HIGH_TAX` | warning | Transfer tax > 10% |
| `NEW_CONTRACT` | warning | < 7 days old |
| `UPGRADEABLE` | warning | Proxy, code can change |
| `LOW_ACTIVITY` | info | < 100 transactions |
| `VERIFIED` | safe | Source verified |
| `KNOWN_PROTOCOL` | safe | Matched on DeFiLlama |

## Design Philosophy

1. **Any contract, not just tokens** — Works on all contracts
2. **Unverified = danger** — If we can't see the code, that's a red flag
3. **Sourcify first** — Free, no API key required
4. **Honest confidence** — We tell you when data is missing
5. **Findings, not scores** — Facts + severity, no magic numbers

## License

MIT
