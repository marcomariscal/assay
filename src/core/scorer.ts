/**
 * Risk Scoring Logic
 */

import type { RiskLevel } from "./types.js";

export interface ContractInfo {
	verified: boolean;
	sourceAvailable: boolean;
	contractName?: string;
	ageDays: number | null;
	txCount: number | null;
	isProxy: boolean;
	isUpgradeable: boolean;
	hasSelfDestruct: boolean;
	protocol?: string;
}

export interface RiskResult {
	score: number;
	reasons: string[];
}

/**
 * Calculate risk score from contract info
 * Higher score = higher risk
 */
export function calculateRiskScore(info: ContractInfo): RiskResult {
	let score = 0;
	const reasons: string[] = [];

	// Unverified source (+40)
	if (!info.verified) {
		score += 40;
		reasons.push("❌ Unverified source code");
	} else {
		reasons.push("✓ Source code verified");
	}

	// Contract age
	if (info.ageDays !== null) {
		if (info.ageDays < 7) {
			score += 30;
			reasons.push(`⚠️ Very new contract (${info.ageDays} days old)`);
		} else if (info.ageDays < 30) {
			score += 15;
			reasons.push(`⚠️ New contract (${info.ageDays} days old)`);
		} else if (info.ageDays < 90) {
			score += 5;
			reasons.push(`✓ Contract age: ${info.ageDays} days`);
		} else {
			reasons.push(`✓ Established contract (${info.ageDays} days old)`);
		}
	} else {
		score += 10;
		reasons.push("⚠️ Could not determine contract age");
	}

	// Transaction count
	if (info.txCount !== null) {
		if (info.txCount < 10) {
			score += 20;
			reasons.push(`⚠️ Very low activity (${info.txCount} txs)`);
		} else if (info.txCount < 100) {
			score += 10;
			reasons.push(`⚠️ Low activity (${info.txCount} txs)`);
		} else if (info.txCount < 1000) {
			reasons.push(`✓ Moderate activity (${info.txCount} txs)`);
		} else {
			reasons.push(`✓ High activity (${info.txCount.toLocaleString()} txs)`);
		}
	}

	// Proxy/upgradeable (+15)
	if (info.isProxy || info.isUpgradeable) {
		score += 15;
		reasons.push("⚠️ Proxy/upgradeable contract");
	}

	// Self-destruct (+20)
	if (info.hasSelfDestruct) {
		score += 20;
		reasons.push("❌ Contains selfdestruct");
	}

	// Known protocol (-20)
	if (info.protocol) {
		score = Math.max(0, score - 20);
		reasons.push(`✓ Known protocol: ${info.protocol}`);
	}

	return { score, reasons };
}

/**
 * Convert numeric score to risk level
 */
export function scoreToLevel(score: number): RiskLevel {
	if (score <= 20) return "low";
	if (score <= 40) return "medium";
	if (score <= 60) return "high";
	return "critical";
}
