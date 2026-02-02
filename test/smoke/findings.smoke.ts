import { describe, expect, test } from "bun:test";
import { analyze } from "../../src/analyzer";

describe("smoke findings (real contracts)", () => {
	test(
		"HONEYPOT finding",
		async () => {
			const result = await analyze(
				"0x208042a2012812f189e4e696e05f08eadb883404",
				"ethereum",
			);

			expect(result.findings.some((finding) => finding.code === "HONEYPOT")).toBe(
				true,
			);
		},
		60000,
	);

	test(
		"PROXY and UPGRADEABLE findings",
		async () => {
			const result = await analyze(
				"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
				"ethereum",
			);

			expect(result.findings.some((finding) => finding.code === "PROXY")).toBe(true);
			expect(result.findings.some((finding) => finding.code === "UPGRADEABLE")).toBe(
				true,
			);
		},
		60000,
	);

	test(
		"VERIFIED finding (UNI)",
		async () => {
			const result = await analyze(
				"0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
				"ethereum",
			);

			expect(result.findings.some((finding) => finding.code === "VERIFIED")).toBe(
				true,
			);
		},
		60000,
	);

	test(
		"KNOWN_PROTOCOL finding (Uniswap Router)",
		async () => {
			const result = await analyze(
				"0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
				"ethereum",
			);

			expect(
				result.findings.some((finding) => finding.code === "KNOWN_PROTOCOL"),
			).toBe(true);
		},
		60000,
	);
});
