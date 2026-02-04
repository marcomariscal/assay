import { KNOWN_SPENDERS } from "../approvals/known-spenders";
import { MAX_UINT256 } from "../constants";
import type { AnalysisResult, ApprovalChange, Recommendation } from "../types";

export interface DrainerHeuristicResult {
	recommendationFloor: Recommendation | null;
	reasons: string[];
}

const NATIVE_NEAR_TOTAL_OUTFLOW_THRESHOLD_WEI = 9_000n * 10n ** 18n;

export function evaluateDrainerHeuristic(analysis: AnalysisResult): DrainerHeuristicResult {
	const simulation = analysis.simulation;
	if (!simulation || !simulation.success) {
		return { recommendationFloor: null, reasons: [] };
	}

	const chain = analysis.contract.chain;

	const approvalReasons = findUnknownBroadApprovalReasons(simulation.approvals, chain);
	const outflowReasons = findLargeOutflowReasons(simulation);

	const reasons = [...approvalReasons, ...outflowReasons];
	if (reasons.length === 0) {
		return { recommendationFloor: null, reasons: [] };
	}

	const hasUnknownBroadApproval = approvalReasons.length > 0;
	const hasLargeOutflow = outflowReasons.length > 0;

	let recommendationFloor: Recommendation = "caution";
	if (hasUnknownBroadApproval && hasLargeOutflow) {
		recommendationFloor = "warning";
	}

	return { recommendationFloor, reasons };
}

function findUnknownBroadApprovalReasons(
	approvals: ApprovalChange[],
	chain: AnalysisResult["contract"]["chain"],
): string[] {
	const reasons: string[] = [];
	const seen = new Set<string>();
	for (const approval of approvals) {
		if (!isBroadApproval(approval)) continue;
		if (isKnownSpender(chain, approval.spender)) continue;
		const key = `${approval.standard}|${approval.token.toLowerCase()}|${approval.spender.toLowerCase()}|${approval.scope ?? "token"}`;
		if (seen.has(key)) continue;
		seen.add(key);

		if (approval.scope === "all") {
			reasons.push(
				`Simulation: broad NFT approval (ApprovalForAll) to unknown operator ${approval.spender} for ${approval.token}.`,
			);
			continue;
		}

		reasons.push(
			`Simulation: unlimited token approval to unknown spender ${approval.spender} for ${approval.token}.`,
		);
	}
	return reasons;
}

function isBroadApproval(approval: ApprovalChange): boolean {
	if (approval.standard === "erc20") {
		return approval.amount === MAX_UINT256;
	}
	if (approval.scope === "all") {
		return approval.approved !== false;
	}
	return false;
}

function isKnownSpender(chain: AnalysisResult["contract"]["chain"], spender: string): boolean {
	const known = KNOWN_SPENDERS[chain];
	const normalized = spender.toLowerCase();
	return known.some((entry) => entry.address.toLowerCase() === normalized);
}

function findLargeOutflowReasons(simulation: NonNullable<AnalysisResult["simulation"]>): string[] {
	const reasons: string[] = [];

	const nativeDiff = simulation.nativeDiff;
	if (nativeDiff !== undefined && nativeDiff < 0n) {
		const outflow = -nativeDiff;
		if (outflow >= NATIVE_NEAR_TOTAL_OUTFLOW_THRESHOLD_WEI) {
			reasons.push(
				`Simulation: near-total native currency outflow detected (${outflow.toString()} wei).`,
			);
		}
	}

	const outTokens = new Set<string>();
	for (const change of simulation.assetChanges) {
		if (change.assetType !== "erc20") continue;
		if (!change.address) continue;
		if (!change.amount || change.amount <= 0n) continue;
		if (change.direction !== "out") continue;
		outTokens.add(change.address.toLowerCase());
	}
	if (outTokens.size >= 2) {
		reasons.push(
			`Simulation: multiple ERC-20 outflows detected (${outTokens.size} different tokens sent out).`,
		);
	}

	return reasons;
}

export function bumpRecommendationToFloor(
	current: Recommendation,
	floor: Recommendation,
): Recommendation {
	const order: Recommendation[] = ["ok", "caution", "warning", "danger"];
	const currentIndex = order.indexOf(current);
	const floorIndex = order.indexOf(floor);
	if (currentIndex === -1 || floorIndex === -1) {
		return floor;
	}
	return currentIndex < floorIndex ? floor : current;
}
