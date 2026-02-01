import { getChainConfig } from "../chains";
import type { Chain, EtherscanData } from "../types";

export async function getContractData(
	address: string,
	chain: Chain,
	apiKey?: string,
): Promise<EtherscanData | null> {
	if (!apiKey) {
		return null;
	}

	const chainConfig = getChainConfig(chain);
	const baseUrl = chainConfig.etherscanApiUrl;

	try {
		// Get source code (includes verification status and name)
		const sourceUrl = `${baseUrl}?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
		const sourceRes = await fetch(sourceUrl);
		const sourceData = await sourceRes.json();

		if (sourceData.status !== "1" || !sourceData.result?.[0]) {
			return null;
		}

		const contractInfo = sourceData.result[0];
		const verified = contractInfo.SourceCode !== "";

		// Get transaction count
		const txCountUrl = `${baseUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${apiKey}`;
		const txCountRes = await fetch(txCountUrl);
		const txCountData = await txCountRes.json();

		// Get creation info (first transaction is usually contract creation)
		let age_days: number | undefined;
		let creator: string | undefined;

		if (txCountData.status === "1" && txCountData.result?.length > 0) {
			const firstTx = txCountData.result[0];
			const creationTime = Number.parseInt(firstTx.timeStamp, 10) * 1000;
			age_days = Math.floor((Date.now() - creationTime) / (1000 * 60 * 60 * 24));
			creator = firstTx.from;
		}

		// Get total tx count
		const txListUrl = `${baseUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&apikey=${apiKey}`;
		const txListRes = await fetch(txListUrl);
		const txListData = await txListRes.json();
		const tx_count = txListData.status === "1" ? txListData.result?.length : undefined;

		return {
			verified,
			name: contractInfo.ContractName || undefined,
			source: verified ? contractInfo.SourceCode : undefined,
			age_days,
			tx_count,
			creator,
		};
	} catch {
		return null;
	}
}
