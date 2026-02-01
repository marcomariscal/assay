/**
 * Core types for rugscan
 */
type Chain = "ethereum" | "base" | "arbitrum" | "optimism" | "polygon";
type RiskLevel = "low" | "medium" | "high" | "critical";
interface ContractAnalysis {
	address: string;
	chain: Chain;
	verified: boolean;
	sourceAvailable: boolean;
	contractName?: string;
	ageDays: number | null;
	txCount: number | null;
	uniqueUsers: number | null;
	isProxy: boolean;
	isUpgradeable: boolean;
	hasSelfDestruct: boolean;
	protocol?: string;
	auditStatus?: "audited" | "unaudited" | "unknown";
	knownIssues: string[];
	riskLevel: RiskLevel;
	riskScore: number;
	riskReasons: string[];
}
interface TokenTransfer {
	token: string;
	symbol?: string;
	from: string;
	to: string;
	value: string;
	decimals?: number;
}
interface ApprovalChange {
	token: string;
	symbol?: string;
	spender: string;
	value: string;
	isUnlimited: boolean;
}
interface SimulationWarning {
	level: "info" | "warning" | "danger";
	message: string;
}
interface SimulationResult {
	success: boolean;
	revertReason?: string;
	gasUsed: bigint;
	ethTransfers: {
		from: string;
		to: string;
		value: string;
	}[];
	tokenTransfers: TokenTransfer[];
	nftTransfers: {
		token: string;
		from: string;
		to: string;
		tokenId: string;
	}[];
	approvals: ApprovalChange[];
	warnings: SimulationWarning[];
	summary: string;
}

/**
 * Contract Analyzer
 * Fetches contract info and produces risk analysis
 */

interface AnalyzeOptions {
	chain: Chain;
	skipSimulation?: boolean;
}
/**
 * Analyze a contract for risk factors
 */
declare function analyzeContract(
	address: string,
	options: AnalyzeOptions,
): Promise<ContractAnalysis>;
/**
 * Quick check if this is first interaction with a contract
 */
declare function isFirstInteraction(
	_userAddress: string,
	_contractAddress: string,
	_chain: Chain,
): Promise<boolean>;
/**
 * Format analysis for display
 */
declare function formatAnalysis(analysis: ContractAnalysis): string;

/**
 * Risk Scoring Logic
 */

interface ContractInfo {
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
interface RiskResult {
	score: number;
	reasons: string[];
}
/**
 * Calculate risk score from contract info
 * Higher score = higher risk
 */
declare function calculateRiskScore(info: ContractInfo): RiskResult;
/**
 * Convert numeric score to risk level
 */
declare function scoreToLevel(score: number): RiskLevel;

/**
 * Contract Data Fetching
 * Uses Blockscout (free, no key) as primary source
 */

/**
 * Fetch contract info from Blockscout
 */
declare function getContractInfo(address: string, chain: Chain): Promise<ContractInfo>;

export {
	type ApprovalChange,
	type Chain,
	type ContractAnalysis,
	type RiskLevel,
	type SimulationResult,
	type SimulationWarning,
	type TokenTransfer,
	analyzeContract,
	calculateRiskScore,
	formatAnalysis,
	getContractInfo,
	isFirstInteraction,
	scoreToLevel,
};
