/**
 * Contract Analyzer
 * Fetches contract info and produces risk analysis
 */

import type { Chain, ContractAnalysis, RiskLevel } from "./types.js";
import { getContractInfo } from "../data/etherscan.js";
import { calculateRiskScore, scoreToLevel } from "./scorer.js";

export interface AnalyzeOptions {
	chain: Chain;
	skipSimulation?: boolean;
}

/**
 * Analyze a contract for risk factors
 */
export async function analyzeContract(
	address: string,
	options: AnalyzeOptions,
): Promise<ContractAnalysis> {
	const { chain } = options;

	// Fetch contract info from block explorer
	const info = await getContractInfo(address, chain);

	// Calculate risk
	const { score, reasons } = calculateRiskScore(info);
	const riskLevel = scoreToLevel(score);

	return {
		address,
		chain,
		verified: info.verified,
		sourceAvailable: info.sourceAvailable,
		contractName: info.contractName,
		ageDays: info.ageDays,
		txCount: info.txCount,
		uniqueUsers: null, // TODO: requires more API calls
		isProxy: info.isProxy,
		isUpgradeable: info.isUpgradeable,
		hasSelfDestruct: info.hasSelfDestruct,
		protocol: info.protocol,
		auditStatus: "unknown", // TODO: integrate audit DB
		knownIssues: [], // TODO: integrate CVE/exploit DB
		riskLevel,
		riskScore: score,
		riskReasons: reasons,
	};
}

/**
 * Quick check if this is first interaction with a contract
 */
export async function isFirstInteraction(
	_userAddress: string,
	_contractAddress: string,
	_chain: Chain,
): Promise<boolean> {
	// TODO: Check user's tx history with this contract
	// For now, assume first interaction (safer default)
	return true;
}

/**
 * Format analysis for display
 */
export function formatAnalysis(analysis: ContractAnalysis): string {
	const icon = {
		low: "✅",
		medium: "⚠️",
		high: "🔶",
		critical: "🚨",
	}[analysis.riskLevel];

	const lines = [
		`${icon} Contract Risk: ${analysis.riskLevel.toUpperCase()} (${analysis.riskScore})`,
		`   Address: ${analysis.address}`,
		`   Chain: ${analysis.chain}`,
		"",
	];

	if (analysis.contractName) {
		lines.push(`   Name: ${analysis.contractName}`);
	}

	if (analysis.protocol) {
		lines.push(`   Protocol: ${analysis.protocol}`);
	}

	lines.push("");
	lines.push("   Risk Factors:");

	for (const reason of analysis.riskReasons) {
		const prefix = reason.startsWith("✓") ? "   " : "   ";
		lines.push(`${prefix}${reason}`);
	}

	return lines.join("\n");
}
