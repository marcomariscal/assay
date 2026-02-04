import { describe, expect, test } from "bun:test";
import { KNOWN_SPENDERS } from "../src/approvals/known-spenders";
import { MAX_UINT256 } from "../src/constants";
import { evaluateDrainerHeuristic } from "../src/heuristics/drainer";
import type { AnalysisResult, BalanceSimulationResult } from "../src/types";

function baseAnalysis(): AnalysisResult {
	return {
		contract: {
			address: "0x1111111111111111111111111111111111111111",
			chain: "ethereum",
			verified: true,
			is_proxy: false,
		},
		findings: [],
		confidence: { level: "high", reasons: [] },
		recommendation: "ok",
	};
}

function analysisWithSimulation(simulation: BalanceSimulationResult): AnalysisResult {
	return {
		...baseAnalysis(),
		simulation,
	};
}

describe("evaluateDrainerHeuristic", () => {
	test("returns empty when simulation is missing", () => {
		const result = evaluateDrainerHeuristic(baseAnalysis());
		expect(result.recommendationFloor).toBeNull();
		expect(result.reasons).toEqual([]);
	});

	test("flags unlimited ERC-20 approval to unknown spender", () => {
		const analysis = analysisWithSimulation({
			success: true,
			assetChanges: [],
			approvals: [
				{
					standard: "erc20",
					token: "0x2222222222222222222222222222222222222222",
					owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					spender: "0x3333333333333333333333333333333333333333",
					amount: MAX_UINT256,
					scope: "token",
				},
			],
			confidence: "high",
			notes: [],
		});

		const result = evaluateDrainerHeuristic(analysis);
		expect(result.recommendationFloor).toBe("caution");
		expect(result.reasons.length).toBe(1);
		expect(result.reasons[0]).toContain("unlimited token approval");
		expect(result.reasons[0]).toContain("0x3333333333333333333333333333333333333333");
	});

	test("does not flag unlimited ERC-20 approval to a known spender", () => {
		const knownSpender = KNOWN_SPENDERS.ethereum[0];
		if (!knownSpender) {
			throw new Error("Missing known spender fixture");
		}

		const analysis = analysisWithSimulation({
			success: true,
			assetChanges: [],
			approvals: [
				{
					standard: "erc20",
					token: "0x2222222222222222222222222222222222222222",
					owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					spender: knownSpender.address,
					amount: MAX_UINT256,
					scope: "token",
				},
			],
			confidence: "high",
			notes: [],
		});

		const result = evaluateDrainerHeuristic(analysis);
		expect(result.recommendationFloor).toBeNull();
		expect(result.reasons).toEqual([]);
	});

	test("flags ApprovalForAll to unknown operator", () => {
		const analysis = analysisWithSimulation({
			success: true,
			assetChanges: [],
			approvals: [
				{
					standard: "erc721",
					token: "0x2222222222222222222222222222222222222222",
					owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					spender: "0x3333333333333333333333333333333333333333",
					scope: "all",
					approved: true,
				},
			],
			confidence: "high",
			notes: [],
		});

		const result = evaluateDrainerHeuristic(analysis);
		expect(result.recommendationFloor).toBe("caution");
		expect(result.reasons[0]).toContain("ApprovalForAll");
	});

	test("flags multiple ERC-20 outflows", () => {
		const analysis = analysisWithSimulation({
			success: true,
			assetChanges: [
				{
					assetType: "erc20",
					address: "0x2222222222222222222222222222222222222222",
					amount: 1n,
					direction: "out",
				},
				{
					assetType: "erc20",
					address: "0x4444444444444444444444444444444444444444",
					amount: 2n,
					direction: "out",
				},
			],
			approvals: [],
			confidence: "high",
			notes: [],
		});

		const result = evaluateDrainerHeuristic(analysis);
		expect(result.recommendationFloor).toBe("caution");
		expect(result.reasons[0]).toContain("multiple ERC-20 outflows");
	});

	test("bumps to warning when unknown broad approval and outflows both present", () => {
		const analysis = analysisWithSimulation({
			success: true,
			nativeDiff: -9_500n * 10n ** 18n,
			assetChanges: [
				{
					assetType: "erc20",
					address: "0x2222222222222222222222222222222222222222",
					amount: 1n,
					direction: "out",
				},
				{
					assetType: "erc20",
					address: "0x4444444444444444444444444444444444444444",
					amount: 2n,
					direction: "out",
				},
			],
			approvals: [
				{
					standard: "erc20",
					token: "0x2222222222222222222222222222222222222222",
					owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					spender: "0x3333333333333333333333333333333333333333",
					amount: MAX_UINT256,
					scope: "token",
				},
			],
			confidence: "high",
			notes: [],
		});

		const result = evaluateDrainerHeuristic(analysis);
		expect(result.recommendationFloor).toBe("warning");
		expect(result.reasons.length).toBeGreaterThanOrEqual(2);
	});
});
