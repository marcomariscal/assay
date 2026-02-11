# Proxy mode (`assay proxy`)

`assay proxy` runs a local JSON-RPC proxy that forwards requests to an upstream RPC and preflights risky transaction submissions.

Use cases:
- Point a wallet (or any JSON-RPC client) at a local endpoint.
- Intercept `eth_sendTransaction` / `eth_sendRawTransaction` and block/prompt on risk.

## Start a proxy

```bash
assay proxy --upstream <RPC_URL>
```

By default it listens on `http://127.0.0.1:8545`.

**This is the recommended mode for high-stakes transactions** (large approvals, new protocols, unfamiliar contracts). It runs all providers (~10s) for comprehensive coverage:
- Etherscan metadata + phishing labels
- Sourcify source verification
- GoPlus token security
- Protocol recognition (DefiLlama)
- Local simulation (Anvil)

Useful flags:
- `--hostname <host>` (default: `127.0.0.1`)
- `--port <port>` (default: `8545`)
- `--once` (exit after the first intercepted send request)
- `--quiet` (less output)

## Fast mode (`--wallet`)

Fast mode trades provider coverage for latency (~3s budget). Use it for routine, trusted-protocol flows where speed matters more than exhaustive checks.

```bash
assay proxy --upstream <RPC_URL> --wallet
```

### What's skipped in fast mode

| Provider | Default mode | Fast mode (`--wallet`) | Why skipped |
|----------|-------------|----------------------|-------------|
| Etherscan metadata (age, tx count) | ✅ | ❌ | Slow API, not worth blocking wallet sends |
| Etherscan phishing labels | ✅ | ❌ | Large tag export can be very slow |
| GoPlus token security | ✅ | ❌ | External API adds latency |
| Sourcify verification | ✅ | ✅ (1.6s timeout) | Fast enough to keep |
| Protocol recognition | ✅ | ✅ (250ms timeout) | Fast enough to keep |
| Simulation (Anvil/heuristic) | ✅ | ✅ | Core safety check — always runs |

### When to use which mode

| Scenario | Recommended mode |
|----------|-----------------|
| Approving a token for a new/unknown spender | Default (full coverage) |
| Interacting with an unfamiliar protocol | Default (full coverage) |
| Large value transfers or unlimited approvals | Default (full coverage) |
| Routine swaps on Uniswap/Aave/etc. | Fast mode (`--wallet`) |
| Quick dev/test transactions | Fast mode (`--wallet`) |

### Coverage banner

In fast mode, the scan output includes a visible coverage banner:
```
⚡ FAST MODE — reduced provider coverage (Etherscan, GoPlus skipped)
```
And when metadata is unavailable, the context line explains why:
```
Context: verified · age: — · txs: — · metadata: skipped in wallet mode for latency
```

## Allowlist (v1)

You can optionally enforce a local allowlist so transactions are blocked unless they only touch trusted endpoints.

Config example (`assay.config.json` or `~/.config/assay/config.json`):

```json
{
  "allowlist": {
    "to": ["0x..."],
    "spenders": ["0x..."]
  }
}
```

- `allowlist.to`: allowlisted transaction targets (`tx.to`).
- `allowlist.spenders`: allowlisted approval spenders/operators (from simulation + decoded calldata when available).

When a transaction is blocked, the JSON-RPC error uses code `4001` and includes details under `error.data`:
- `error.data.recommendation` + `error.data.simulationSuccess`
- `error.data.allowlist` (when enabled): violations + `unknownApprovalSpenders`

## Offline / RPC-only

See `offline.md` for strict offline semantics when running the proxy (`--offline` / `--rpc-only`).
