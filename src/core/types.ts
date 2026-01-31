/**
 * Core types for rugscan
 */

export type Chain =
	| "ethereum"
	| "base"
	| "arbitrum"
	| "optimism"
	| "polygon";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ContractAnalysis {
	address: string;
	chain: Chain;
	verified: boolean;
	sourceAvailable: boolean;
	contractName?: string;

	// Risk factors
	ageDays: number | null;
	txCount: number | null;
	uniqueUsers: number | null;
	isProxy: boolean;
	isUpgradeable: boolean;
	hasSelfDestruct: boolean;

	// External data
	protocol?: string;
	auditStatus?: "audited" | "unaudited" | "unknown";
	knownIssues: string[];

	// Verdict
	riskLevel: RiskLevel;
	riskScore: number;
	riskReasons: string[];
}

export interface TokenTransfer {
	token: string;
	symbol?: string;
	from: string;
	to: string;
	value: string;
	decimals?: number;
}

export interface ApprovalChange {
	token: string;
	symbol?: string;
	spender: string;
	value: string;
	isUnlimited: boolean;
}

export interface SimulationWarning {
	level: "info" | "warning" | "danger";
	message: string;
}

export interface SimulationResult {
	success: boolean;
	revertReason?: string;
	gasUsed: bigint;

	// State changes
	ethTransfers: { from: string; to: string; value: string }[];
	tokenTransfers: TokenTransfer[];
	nftTransfers: { token: string; from: string; to: string; tokenId: string }[];
	approvals: ApprovalChange[];

	// Warnings
	warnings: SimulationWarning[];

	// Human summary
	summary: string;
}

export interface RuGovernment {
	mode: "warn" | "block";
	riskThreshold: RiskLevel;
}
