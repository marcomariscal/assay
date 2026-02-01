export type Chain = "ethereum" | "base" | "arbitrum" | "optimism" | "polygon";

export type FindingLevel = "danger" | "warning" | "info" | "safe";

export type FindingCode =
	// Danger
	| "UNVERIFIED"
	| "HONEYPOT"
	| "HIDDEN_MINT"
	| "SELFDESTRUCT"
	| "OWNER_DRAIN"
	// Warning
	| "UNKNOWN_SECURITY"
	| "BLACKLIST"
	| "HIGH_TAX"
	| "NEW_CONTRACT"
	| "UPGRADEABLE"
	// Info
	| "LOW_ACTIVITY"
	| "PROXY"
	// Safe
	| "VERIFIED"
	| "KNOWN_PROTOCOL";

export type Recommendation = "danger" | "warning" | "caution" | "ok";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface Finding {
	level: FindingLevel;
	code: FindingCode;
	message: string;
}

export interface ContractInfo {
	address: string;
	chain: Chain;
	name?: string;
	verified: boolean;
	age_days?: number;
	tx_count?: number;
	is_proxy: boolean;
	implementation?: string;
	beacon?: string;
}

export interface Confidence {
	level: ConfidenceLevel;
	reasons: string[];
}

export interface AnalysisResult {
	contract: ContractInfo;
	protocol?: string;
	findings: Finding[];
	confidence: Confidence;
	recommendation: Recommendation;
}

export interface Config {
	etherscanKeys?: Partial<Record<Chain, string>>;
	rpcUrls?: Partial<Record<Chain, string>>;
}

// Provider interfaces
export interface VerificationResult {
	verified: boolean;
	name?: string;
	source?: string;
}

export interface EtherscanData {
	verified: boolean;
	name?: string;
	source?: string;
	age_days?: number;
	tx_count?: number;
	creator?: string;
}

export interface ProtocolMatch {
	name: string;
	tvl?: number;
}

export interface TokenSecurity {
	is_honeypot: boolean | undefined;
	is_mintable: boolean | undefined;
	can_take_back_ownership: boolean | undefined;
	hidden_owner: boolean | undefined;
	selfdestruct: boolean | undefined;
	buy_tax?: number;
	sell_tax?: number;
	is_blacklisted: boolean | undefined;
	owner_can_change_balance: boolean | undefined;
}

export interface ProxyInfo {
	is_proxy: boolean;
	proxy_type?: "eip1967" | "uups" | "beacon" | "minimal" | "unknown";
	implementation?: string;
	beacon?: string;
}

export interface ProviderResult<T> {
	data: T | null;
	error?: string;
}
