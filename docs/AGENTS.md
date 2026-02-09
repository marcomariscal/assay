# Agent integrations (assay)

This doc describes **supported integration modes** for using assay as a preflight security gate before submitting EVM transactions.

> Scope note: assay is **EVM / Ethereum JSON-RPC only** right now.
> The integration points below specifically target `eth_sendTransaction` and `eth_sendRawTransaction`.

## Mode 1 (preferred): In-process wrapper (agent-native)

### viem (recommended)

Wrap your existing `viem` transport and block risky transactions *before* they hit the RPC.

- Intercepts:
  - `eth_sendTransaction`
  - `eth_sendRawTransaction`
- Runs the full assay pipeline in-process (`scanWithAnalysis`).
- If risky/unknown, throws `AssayTransportError` containing:
  - `analyzeResponse` (structured)
  - `renderedSummary` (human-readable string)

Example:

```ts
import { createWalletClient, http } from "viem"
import { mainnet } from "viem/chains"
import { createAssayViemTransport, AssayTransportError } from "assay"

const upstream = http(process.env.RPC_URL!)

const transport = createAssayViemTransport({
  upstream,
  config: {
    // Provide RPC URLs / keys as needed for richer analysis + simulation.
    // rpcUrls: { ethereum: process.env.RPC_URL! },
  },
  threshold: "warning",
  onRisk: ({ renderedSummary }) => {
    // Agents can log or surface this in UI.
    console.error(renderedSummary)
  },
})

const client = createWalletClient({ chain: mainnet, transport })

// Any request that hits eth_sendTransaction / eth_sendRawTransaction will be preflight-scanned.
try {
  await client.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: "0x...",
        to: "0x...",
        value: "0x0",
        data: "0x",
      },
    ],
  })
} catch (err) {
  if (err instanceof AssayTransportError) {
    console.error(err.renderedSummary)
  }
  throw err
}
```

### ethers (provider wrapper)

If you use `ethers`, the same pattern applies: wrap the Provider (or `send`/`perform` path)
so calls to `eth_sendTransaction` / `eth_sendRawTransaction` first run `scanWithAnalysis`,
then either forward (safe) or throw (risky/unknown).

This repo currently ships the viem wrapper as the “serious” integration path.

## Mode 2: CLI preflight gate

Run assay as a **preflight check** in an agent/tool workflow before signing/sending.

- `assay scan ... --fail-on <threshold>` exits non-zero when recommendation >= threshold.
- Useful when you can’t easily wrap a provider, or you want a one-shot shell step.

Example (pseudocode):

```bash
assay scan --calldata @tx.json --fail-on warning
# if exit code is 0, proceed to send transaction
```

## Mode 3: Legacy executor compatibility (evm-wallet)

For tools that expect an RPC URL and submit transactions directly (e.g. “executor” style tools),
use a local JSON-RPC proxy:

- Start `assay proxy --upstream <RPC_URL>` locally.
- Point the executor at the proxy.

Proposed convenience wrapper:

```bash
assay exec -- <command>
```

Behavior:

1. Start a local assay proxy bound to `127.0.0.1:<port>`.
2. Run `<command>` with `RPC_URL` (and/or common aliases like `ETH_RPC_URL`) set to the proxy URL.
3. Proxy intercepts `eth_sendTransaction` / `eth_sendRawTransaction` and blocks risky/unknown.

Notes:
- The proxy layer explicitly handles **JSON-RPC notifications** (requests without `id`) by forwarding them upstream and **never returning a response**.
- This mode is intended for compatibility and migration; in-process integration is preferred.
