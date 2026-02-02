import { describe, expect, test } from "bun:test";
import { analyzeApproval } from "../../src/approval";
import { MAX_UINT256 } from "../../src/constants";

describe("approval smoke (real contracts)", () => {
	test(
		"APPROVAL_TO_EOA finding",
		async () => {
			const result = await analyzeApproval(
				{
					token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
					spender: "0x0000000000000000000000000000000000000001",
					amount: 1n,
				},
				"ethereum",
			);

			expect(result.findings.some((finding) => finding.code === "APPROVAL_TO_EOA")).toBe(
				true,
			);
		},
		60000,
	);

	test(
		"UNLIMITED_APPROVAL finding",
		async () => {
			const result = await analyzeApproval(
				{
					token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
					spender: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
					amount: MAX_UINT256,
				},
				"ethereum",
			);

			expect(result.flags.isUnlimited).toBe(true);
			expect(
				result.findings.some((finding) => finding.code === "UNLIMITED_APPROVAL"),
			).toBe(true);
		},
		60000,
	);
});
