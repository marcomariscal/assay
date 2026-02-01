import type { Chain, TokenSecurity } from "../types";

const GOPLUS_API = "https://api.gopluslabs.io/api/v1";

// Chain ID mapping for GoPlus
const CHAIN_IDS: Record<Chain, string> = {
	ethereum: "1",
	base: "8453",
	arbitrum: "42161",
	optimism: "10",
	polygon: "137",
};

interface GoPlusResponse {
	code: number;
	message: string;
	result: Record<string, GoPlusTokenData>;
}

interface GoPlusTokenData {
	is_honeypot?: string;
	is_mintable?: string;
	can_take_back_ownership?: string;
	hidden_owner?: string;
	selfdestruct?: string;
	buy_tax?: string;
	sell_tax?: string;
	is_blacklisted?: string;
	owner_change_balance?: string;
	is_open_source?: string;
	is_proxy?: string;
}

function toBool(val: string | undefined): boolean {
	return val === "1";
}

function toNumber(val: string | undefined): number | undefined {
	if (!val) return undefined;
	const n = Number.parseFloat(val);
	return Number.isNaN(n) ? undefined : n;
}

export async function getTokenSecurity(
	address: string,
	chain: Chain,
): Promise<TokenSecurity | null> {
	const chainId = CHAIN_IDS[chain];

	try {
		const url = `${GOPLUS_API}/token_security/${chainId}?contract_addresses=${address}`;
		const response = await fetch(url);

		if (!response.ok) {
			return null;
		}

		const data: GoPlusResponse = await response.json();

		if (data.code !== 1 || !data.result) {
			return null;
		}

		const tokenData = data.result[address.toLowerCase()];
		if (!tokenData) {
			return null;
		}

		return {
			is_honeypot: toBool(tokenData.is_honeypot),
			is_mintable: toBool(tokenData.is_mintable),
			can_take_back_ownership: toBool(tokenData.can_take_back_ownership),
			hidden_owner: toBool(tokenData.hidden_owner),
			selfdestruct: toBool(tokenData.selfdestruct),
			buy_tax: toNumber(tokenData.buy_tax),
			sell_tax: toNumber(tokenData.sell_tax),
			is_blacklisted: toBool(tokenData.is_blacklisted),
			owner_can_change_balance: toBool(tokenData.owner_change_balance),
		};
	} catch {
		return null;
	}
}

export async function isToken(address: string, chain: Chain): Promise<boolean> {
	// Quick check if GoPlus has data for this address (indicates it's a token)
	const security = await getTokenSecurity(address, chain);
	return security !== null;
}
