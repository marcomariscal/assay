import * as defillama from "./providers/defillama";
import * as etherscan from "./providers/etherscan";
import * as goplus from "./providers/goplus";
import * as proxy from "./providers/proxy";
import * as sourcify from "./providers/sourcify";
import type {
	AnalysisResult,
	Chain,
	Confidence,
	Config,
	ContractInfo,
	Finding,
	Recommendation,
} from "./types";

export async function analyze(
	address: string,
	chain: Chain,
	config?: Config,
): Promise<AnalysisResult> {
	const findings: Finding[] = [];
	const confidenceReasons: string[] = [];

	// Normalize address
	const addr = address.toLowerCase();
	const etherscanKey = config?.etherscanKeys?.[chain];
	const rpcUrl = config?.rpcUrls?.[chain];

	// 1. Check if it's actually a contract
	const isContractAddress = await proxy.isContract(addr, chain, rpcUrl);
	if (!isContractAddress) {
		return {
			contract: {
				address: addr,
				chain,
				verified: false,
				is_proxy: false,
			},
			findings: [
				{
					level: "warning",
					code: "LOW_ACTIVITY",
					message: "Address is not a contract (EOA or empty)",
				},
			],
			confidence: { level: "high", reasons: [] },
			recommendation: "caution",
		};
	}

	// 2. Check verification - Sourcify first (free), then Etherscan
	let verified = false;
	let contractName: string | undefined;
	let source: string | undefined;

	const sourcifyResult = await sourcify.checkVerification(addr, chain);
	if (sourcifyResult.verified) {
		verified = true;
		contractName = sourcifyResult.name;
		source = sourcifyResult.source;
	}

	// 3. Get Etherscan data (if key available)
	let age_days: number | undefined;
	let tx_count: number | undefined;

	if (etherscanKey) {
		const etherscanData = await etherscan.getContractData(addr, chain, etherscanKey);
		if (etherscanData) {
			// Use Etherscan verification if Sourcify didn't have it
			if (!verified && etherscanData.verified) {
				verified = true;
				contractName = contractName || etherscanData.name;
				source = source || etherscanData.source;
			}
			age_days = etherscanData.age_days;
			tx_count = etherscanData.tx_count;
		}
	} else {
		confidenceReasons.push("no etherscan key - limited data");
	}

	// 4. Proxy detection
	const proxyInfo = await proxy.detectProxy(addr, chain, rpcUrl);

	// 5. Protocol matching
	const protocolMatch = await defillama.matchProtocol(addr, chain);

	// 6. Token security (if it's a token)
	const tokenSecurity = await goplus.getTokenSecurity(addr, chain);

	// Build findings
	if (!verified) {
		findings.push({
			level: "danger",
			code: "UNVERIFIED",
			message: "Source code not verified - cannot analyze contract logic",
		});
	} else {
		findings.push({
			level: "safe",
			code: "VERIFIED",
			message: `Source code verified${contractName ? `: ${contractName}` : ""}`,
		});
	}

	if (protocolMatch) {
		findings.push({
			level: "safe",
			code: "KNOWN_PROTOCOL",
			message: `Recognized protocol: ${protocolMatch.name}`,
		});
	}

	if (proxyInfo.is_proxy) {
		findings.push({
			level: "warning",
			code: "UPGRADEABLE",
			message: `Upgradeable proxy (${proxyInfo.proxy_type}) - code can change`,
		});
	}

	if (age_days !== undefined && age_days < 7) {
		findings.push({
			level: "warning",
			code: "NEW_CONTRACT",
			message: `Contract deployed ${age_days} days ago`,
		});
	}

	if (tx_count !== undefined && tx_count < 100) {
		findings.push({
			level: "info",
			code: "LOW_ACTIVITY",
			message: `Only ${tx_count} transactions`,
		});
	}

	// Token-specific findings
	if (tokenSecurity) {
		if (tokenSecurity.is_honeypot) {
			findings.push({
				level: "danger",
				code: "HONEYPOT",
				message: "Honeypot detected - tokens cannot be sold",
			});
		}
		if (tokenSecurity.is_mintable) {
			findings.push({
				level: "danger",
				code: "HIDDEN_MINT",
				message: "Owner can mint unlimited tokens",
			});
		}
		if (tokenSecurity.selfdestruct) {
			findings.push({
				level: "danger",
				code: "SELFDESTRUCT",
				message: "Contract can self-destruct",
			});
		}
		if (tokenSecurity.owner_can_change_balance) {
			findings.push({
				level: "danger",
				code: "OWNER_DRAIN",
				message: "Owner can modify balances",
			});
		}
		if (tokenSecurity.is_blacklisted) {
			findings.push({
				level: "warning",
				code: "BLACKLIST",
				message: "Contract has blacklist functionality",
			});
		}
		const maxTax = Math.max(tokenSecurity.buy_tax || 0, tokenSecurity.sell_tax || 0);
		if (maxTax > 0.1) {
			findings.push({
				level: "warning",
				code: "HIGH_TAX",
				message: `High transfer tax: ${(maxTax * 100).toFixed(1)}%`,
			});
		}
	}

	// Determine confidence level
	let confidenceLevel: Confidence["level"] = "high";
	if (!verified) {
		confidenceLevel = "low";
		confidenceReasons.push("source not verified");
	} else if (!etherscanKey) {
		confidenceLevel = "medium";
	}

	// Determine recommendation
	const recommendation = determineRecommendation(findings);

	const contract: ContractInfo = {
		address: addr,
		chain,
		name: contractName,
		verified,
		age_days,
		tx_count,
		is_proxy: proxyInfo.is_proxy,
		implementation: proxyInfo.implementation,
	};

	return {
		contract,
		protocol: protocolMatch?.name,
		findings,
		confidence: {
			level: confidenceLevel,
			reasons: confidenceReasons,
		},
		recommendation,
	};
}

function determineRecommendation(findings: Finding[]): Recommendation {
	const hasDanger = findings.some((f) => f.level === "danger");
	const hasWarning = findings.some((f) => f.level === "warning");
	const hasSafe = findings.some((f) => f.level === "safe");

	if (hasDanger) {
		return "danger";
	}
	if (hasWarning) {
		return hasSafe ? "caution" : "warning";
	}
	return "ok";
}
