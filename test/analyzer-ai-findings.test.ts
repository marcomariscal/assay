import { describe, expect, mock, test } from "bun:test";
import type { AIResult } from "../src/providers/ai";

let mockResult: AIResult = {
	warning: "AI response parsing failed; output omitted",
	warnings: ["risk score mismatch"],
};

mock.module("../src/providers/ai", () => ({
	analyzeRisk: async () => mockResult,
}));

mock.module("../src/providers/proxy", () => ({
	isContract: async () => true,
	detectProxy: async () => ({ is_proxy: false }),
}));

mock.module("../src/providers/sourcify", () => ({
	checkVerification: async () => ({
		verified: true,
		name: "MockToken",
		source: "contract MockToken {}",
	}),
}));

mock.module("../src/providers/etherscan", () => ({
	getContractData: async () => ({
		verified: true,
		name: "MockToken",
		source: "contract MockToken {}",
		age_days: 42,
		tx_count: 200,
	}),
	getAddressLabels: async () => null,
}));

mock.module("../src/providers/goplus", () => ({
	getTokenSecurity: async () => ({
		data: {
			is_honeypot: false,
			is_mintable: false,
			can_take_back_ownership: false,
			hidden_owner: false,
			selfdestruct: false,
			buy_tax: 0,
			sell_tax: 0,
			is_blacklisted: false,
			owner_can_change_balance: false,
		},
	}),
	isToken: async () => true,
}));

mock.module("../src/providers/defillama", () => ({
	matchProtocol: async () => null,
}));

const { analyze } = await import("../src/analyzer");

describe("analyzer AI findings", () => {
	test("flags AI_PARSE_FAILED and AI_WARNING when AI returns warnings", async () => {
		mockResult = {
			warning: "AI response parsing failed; output omitted",
			warnings: ["risk score mismatch"],
		};

		const result = await analyze(
			"0x0000000000000000000000000000000000000000",
			"ethereum",
			{
				etherscanKeys: { ethereum: "test-key" },
				aiOptions: { enabled: true },
			},
		);

		expect(result.findings.some((finding) => finding.code === "AI_PARSE_FAILED")).toBe(
			true,
		);
		expect(result.findings.some((finding) => finding.code === "AI_WARNING")).toBe(true);
	});
});
