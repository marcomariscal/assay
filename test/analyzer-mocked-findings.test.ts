import { describe, expect, mock, test } from "bun:test";

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
		age_days: 2,
		tx_count: 5,
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
			selfdestruct: true,
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

describe("analyzer mocked findings", () => {
	test("flags NEW_CONTRACT and SELFDESTRUCT findings", async () => {
		const result = await analyze(
		"0x0000000000000000000000000000000000000000",
		"ethereum",
		{
			etherscanKeys: { ethereum: "test-key" },
		},
	);

		expect(result.findings.some((finding) => finding.code === "NEW_CONTRACT")).toBe(
			true,
		);
		expect(result.findings.some((finding) => finding.code === "SELFDESTRUCT")).toBe(
			true,
		);
	});
});
