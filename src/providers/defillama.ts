import type { Chain, ProtocolMatch } from "../types";

const DEFILLAMA_API = "https://api.llama.fi";

// Chain name mapping for DeFiLlama
const CHAIN_NAMES: Record<Chain, string> = {
	ethereum: "ethereum",
	base: "base",
	arbitrum: "arbitrum",
	optimism: "optimism",
	polygon: "polygon",
};

interface Protocol {
	name: string;
	slug: string;
	tvl: number;
	chains: string[];
	address?: string;
}

let protocolCache: Protocol[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

async function getProtocols(): Promise<Protocol[]> {
	const now = Date.now();
	if (protocolCache && now - cacheTime < CACHE_TTL) {
		return protocolCache;
	}

	try {
		const response = await fetch(`${DEFILLAMA_API}/protocols`);
		if (!response.ok) {
			return protocolCache || [];
		}

		protocolCache = await response.json();
		cacheTime = now;
		return protocolCache;
	} catch {
		return protocolCache || [];
	}
}

export async function matchProtocol(address: string, chain: Chain): Promise<ProtocolMatch | null> {
	const protocols = await getProtocols();
	const chainName = CHAIN_NAMES[chain];
	const normalizedAddress = address.toLowerCase();

	// DeFiLlama doesn't have direct address mapping for most protocols
	// This is a best-effort match based on known addresses
	// In practice, you'd need a separate address->protocol mapping

	for (const protocol of protocols) {
		// Check if protocol operates on this chain
		if (!protocol.chains?.includes(chainName)) {
			continue;
		}

		// Check if address matches (if protocol has address field)
		if (protocol.address?.toLowerCase() === normalizedAddress) {
			return {
				name: protocol.name,
				tvl: protocol.tvl,
			};
		}
	}

	return null;
}
