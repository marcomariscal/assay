# Euler Finance Exploit Eval (March 2023)

Context
- Address: 0x27182842E098f60e3D576794A5bFFb0777E025d3 (EToken)
- Chain: Ethereum mainnet
- Date: 2023-03-13
- Loss: ~$197M
- Rationale: donateToReserves lacked a health check, enabling reserve donation + liquidation manipulation.

Sources
- https://blocksec.com/blog/euler-finance-incident-the-largest-hack-of-2023
- https://hacken.io/discover/euler-finance-hack/
