/**
 * rugscan - Pre-transaction security analysis for EVM
 */

// Core
export { analyzeContract, formatAnalysis, isFirstInteraction } from "./core/analyzer.js";
export { calculateRiskScore, scoreToLevel } from "./core/scorer.js";

// Types
export type {
	Chain,
	RiskLevel,
	ContractAnalysis,
	SimulationResult,
	TokenTransfer,
	ApprovalChange,
	SimulationWarning,
} from "./core/types.js";

// Data fetchers (for advanced usage)
export { getContractInfo } from "./data/etherscan.js";
