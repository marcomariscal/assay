import { describe, expect, test } from "bun:test";
import { applySimulationVerdict } from "../src/simulations/verdict";
import type { ScanInput } from "../src/schema";
import type { AnalysisResult } from "../src/types";

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

function calldataInput(): ScanInput {
	return {
		calldata: {
			to: "0x1111111111111111111111111111111111111111",
			data: "0x",
			chain: "1",
		},
	};
}

describe("applySimulationVerdict", () => {
	test("downgrades ok to caution when simulation missing", () => {
		const analysis = baseAnalysis();
		const result = applySimulationVerdict(calldataInput(), analysis);
		expect(result.recommendation).toBe("caution");
	});

	test("does not downgrade when simulation succeeds", () => {
		const analysis: AnalysisResult = {
			...baseAnalysis(),
			recommendation: "warning",
			simulation: {
				success: true,
				assetChanges: [],
				approvals: [],
				confidence: "high",
				notes: [],
			},
		};
		const result = applySimulationVerdict(calldataInput(), analysis);
		expect(result.recommendation).toBe("warning");
	});

	test("bumps recommendation when drainer-like simulation patterns are detected", () => {
		const analysis: AnalysisResult = {
			...baseAnalysis(),
			simulation: {
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
				approvals: [
					{
						standard: "erc20",
						token: "0x2222222222222222222222222222222222222222",
						owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
						spender: "0x3333333333333333333333333333333333333333",
						amount: (1n << 256n) - 1n,
						scope: "token",
					},
				],
				confidence: "high",
				notes: [],
			},
		};

		const result = applySimulationVerdict(calldataInput(), analysis);
		expect(result.recommendation).toBe("warning");
		expect(result.findings.some((finding) => finding.code === "DRAINER_LIKE_SIMULATION")).toBe(
			true,
		);
	});
});
