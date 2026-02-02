# Curve Finance Vyper Reentrancy Eval (July 2023)

Context
- Pools: alETH, msETH, pETH
- Chain: Ethereum mainnet
- Date: 2023-07-30
- Loss: ~$70M
- Rationale: Vyper compiler bug broke nonreentrant guards, enabling reentrancy in affected pools.

Sources
- https://hackmd.io/@LlamaRisk/BJzSKHNjn
- https://hackmd.io/@vyperlang/HydCOV5Bd
