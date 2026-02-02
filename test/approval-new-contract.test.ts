import { describe, expect, mock, test } from "bun:test";
import type { AnalysisResult } from "../src/types";

let mockAnalysis: AnalysisResult = {
	contract: {
		address: "0x0000000000000000000000000000000000000000",
		chain: "ethereum",
		verified: true,
		is_proxy: false,
		age_days: 2,
		tx_count: 1,
	},
	findings: [],
	confidence: { level: "high", reasons: [] },
	recommendation: "ok",
};

mock.module("../src/analyzer", () => ({
	analyze: async () => mockAnalysis,
}));

mock.module("../src/providers/proxy", () => ({
	isContract: async () => true,
}));

const { analyzeApproval } = await import("../src/approval");

describe("approval analysis (new contract)", () => {
	test("flags approval to newly deployed spender", async () => {
		mockAnalysis = {
			...mockAnalysis,
			contract: {
				...mockAnalysis.contract,
				age_days: 3,
			},
		};

		const result = await analyzeApproval(
			{
				token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
				spender: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
				amount: 1n,
			},
			"ethereum",
		);

		expect(result.flags.spenderNew).toBe(true);
		expect(
			result.findings.some((finding) => finding.code === "APPROVAL_TO_NEW_CONTRACT"),
		).toBe(true);
	});
});
