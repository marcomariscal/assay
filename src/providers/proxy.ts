import { type Address, createPublicClient, http } from "viem";
import { arbitrum, base, mainnet, optimism, polygon } from "viem/chains";
import { getChainConfig } from "../chains";
import type { Chain, ProxyInfo } from "../types";

// EIP-1967 storage slots
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const BEACON_SLOT = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";

// Old OpenZeppelin proxy slot (pre-EIP-1967)
const OLD_OZ_IMPLEMENTATION_SLOT = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3";

// Minimal proxy (EIP-1167) bytecode prefix
const MINIMAL_PROXY_PREFIX = "363d3d373d3d3d363d73";

const VIEM_CHAINS = {
	ethereum: mainnet,
	base: base,
	arbitrum: arbitrum,
	optimism: optimism,
	polygon: polygon,
};

function getClient(chain: Chain, rpcUrl?: string) {
	const chainConfig = getChainConfig(chain);
	return createPublicClient({
		chain: VIEM_CHAINS[chain],
		transport: http(rpcUrl || chainConfig.rpcUrl),
	});
}

async function getStorageAt(
	client: ReturnType<typeof getClient>,
	address: Address,
	slot: `0x${string}`,
): Promise<string | null> {
	try {
		const value = await client.getStorageAt({ address, slot });
		if (!value || value === "0x0000000000000000000000000000000000000000000000000000000000000000") {
			return null;
		}
		// Extract address from storage value (last 20 bytes)
		return `0x${value.slice(-40)}`;
	} catch {
		return null;
	}
}

async function getBytecode(
	client: ReturnType<typeof getClient>,
	address: Address,
): Promise<string | null> {
	try {
		const code = await client.getCode({ address });
		return code || null;
	} catch {
		return null;
	}
}

export async function detectProxy(
	address: string,
	chain: Chain,
	rpcUrl?: string,
): Promise<ProxyInfo> {
	const client = getClient(chain, rpcUrl);
	const addr = address as Address;

	// Check EIP-1967 implementation slot
	const implementation = await getStorageAt(client, addr, IMPLEMENTATION_SLOT);
	if (implementation && implementation !== "0x0000000000000000000000000000000000000000") {
		return {
			is_proxy: true,
			proxy_type: "eip1967",
			implementation,
		};
	}

	// Check beacon slot
	const beacon = await getStorageAt(client, addr, BEACON_SLOT);
	if (beacon && beacon !== "0x0000000000000000000000000000000000000000") {
		return {
			is_proxy: true,
			proxy_type: "beacon",
			implementation: beacon, // This is the beacon, not the impl
		};
	}

	// Check old OpenZeppelin proxy slot (pre-EIP-1967)
	const oldOzImpl = await getStorageAt(client, addr, OLD_OZ_IMPLEMENTATION_SLOT);
	if (oldOzImpl && oldOzImpl !== "0x0000000000000000000000000000000000000000") {
		return {
			is_proxy: true,
			proxy_type: "eip1967", // Same pattern, just older slot
			implementation: oldOzImpl,
		};
	}

	// Check for minimal proxy (EIP-1167)
	const bytecode = await getBytecode(client, addr);
	if (bytecode) {
		const cleanCode = bytecode.slice(2).toLowerCase();
		if (cleanCode.startsWith(MINIMAL_PROXY_PREFIX.toLowerCase())) {
			// Extract implementation address from bytecode
			const implAddr = `0x${cleanCode.slice(MINIMAL_PROXY_PREFIX.length, MINIMAL_PROXY_PREFIX.length + 40)}`;
			return {
				is_proxy: true,
				proxy_type: "minimal",
				implementation: implAddr,
			};
		}
	}

	return { is_proxy: false };
}

export async function isContract(address: string, chain: Chain, rpcUrl?: string): Promise<boolean> {
	const client = getClient(chain, rpcUrl);
	const bytecode = await getBytecode(client, address as Address);
	return bytecode !== null && bytecode !== "0x";
}
