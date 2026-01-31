/**
 * Contract Data Fetching
 * Uses Blockscout (free, no key) as primary source
 */

import type { Chain } from "../core/types.js";
import type { ContractInfo } from "../core/scorer.js";

const BLOCKSCOUT_URLS: Record<Chain, string> = {
	ethereum: "https://eth.blockscout.com/api/v2",
	base: "https://base.blockscout.com/api/v2",
	arbitrum: "https://arbitrum.blockscout.com/api/v2",
	optimism: "https://optimism.blockscout.com/api/v2",
	polygon: "https://polygon.blockscout.com/api/v2",
};

interface BlockscoutContract {
	is_verified?: boolean;
	is_partially_verified?: boolean;
	name?: string;
	source_code?: string;
	verified_at?: string;
	creation_status?: string;
}

interface BlockscoutAddress {
	is_contract?: boolean;
	creation_tx_hash?: string;
}

/**
 * Fetch contract info from Blockscout
 */
export async function getContractInfo(
	address: string,
	chain: Chain,
): Promise<ContractInfo> {
	const baseUrl = BLOCKSCOUT_URLS[chain];

	// Fetch contract verification info
	const contractData = await fetchContractData(baseUrl, address);

	// Fetch address info for creation time
	const addressData = await fetchAddressData(baseUrl, address);

	// Calculate age if we have creation tx
	let ageDays: number | null = null;
	if (addressData.creation_tx_hash) {
		ageDays = await fetchContractAge(baseUrl, addressData.creation_tx_hash);
	}

	// Check for proxy pattern in source
	const isProxy = contractData.source_code
		? /delegatecall|Proxy|implementation/i.test(contractData.source_code)
		: false;

	// Check for selfdestruct
	const hasSelfDestruct = contractData.source_code
		? /selfdestruct|suicide/i.test(contractData.source_code)
		: false;

	return {
		verified: contractData.is_verified || contractData.is_partially_verified || false,
		sourceAvailable: Boolean(contractData.source_code),
		contractName: contractData.name,
		ageDays,
		txCount: null, // TODO: fetch tx count
		isProxy,
		isUpgradeable: isProxy,
		hasSelfDestruct,
		protocol: undefined, // TODO: match known protocols
	};
}

async function fetchContractData(
	baseUrl: string,
	address: string,
): Promise<BlockscoutContract> {
	try {
		const url = `${baseUrl}/smart-contracts/${address}`;
		const res = await fetch(url);

		if (!res.ok) {
			return {};
		}

		return (await res.json()) as BlockscoutContract;
	} catch {
		return {};
	}
}

async function fetchAddressData(
	baseUrl: string,
	address: string,
): Promise<BlockscoutAddress> {
	try {
		const url = `${baseUrl}/addresses/${address}`;
		const res = await fetch(url);

		if (!res.ok) {
			return {};
		}

		return (await res.json()) as BlockscoutAddress;
	} catch {
		return {};
	}
}

async function fetchContractAge(
	baseUrl: string,
	txHash: string,
): Promise<number | null> {
	try {
		const url = `${baseUrl}/transactions/${txHash}`;
		const res = await fetch(url);

		if (!res.ok) {
			return null;
		}

		const data = (await res.json()) as { timestamp?: string };

		if (!data.timestamp) {
			return null;
		}

		const createdAt = new Date(data.timestamp).getTime();
		const now = Date.now();
		const ageDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

		return ageDays;
	} catch {
		return null;
	}
}
