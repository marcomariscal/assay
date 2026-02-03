import { describe, expect, test } from "bun:test";
import { analyzeApproval } from "../src/approval";
import { MAX_UINT256 } from "../src/constants";

describe("approval analysis", () => {
	test("flags EOA spender, mismatch, and unlimited approval", async () => {
		const result = await analyzeApproval(
			{
				token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
				spender: "0x0000000000000000000000000000000000000001",
				amount: MAX_UINT256,
			},
			"ethereum",
			{
				expectedSpender: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
			},
		);

		expect(result.flags.isUnlimited).toBe(true);
		expect(result.flags.targetMismatch).toBe(true);
		expect(result.findings.some((finding) => finding.code === "APPROVAL_TO_EOA")).toBe(true);
		expect(result.findings.some((finding) => finding.code === "UNLIMITED_APPROVAL")).toBe(true);
		expect(result.findings.some((finding) => finding.code === "APPROVAL_TARGET_MISMATCH")).toBe(
			true,
		);
	}, 120000);

	test("flags unverified spender contract", async () => {
		const spender = "0x7768a894e6d0160530c0b386c0a963989239f107";
		const result = await analyzeApproval(
			{
				token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
				spender,
				amount: 1n,
			},
			"ethereum",
			{
				expectedSpender: spender,
			},
		);

		expect(result.flags.spenderUnverified).toBe(true);
		expect(result.findings.some((finding) => finding.code === "APPROVAL_TO_UNVERIFIED")).toBe(true);
	}, 120000);

	test("flags approval to dangerous contract", async () => {
		const spender = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
		const result = await analyzeApproval(
			{
				token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
				spender,
				amount: 1n,
			},
			"ethereum",
			{
				expectedSpender: spender,
			},
		);

		expect(
			result.findings.some((finding) => finding.code === "APPROVAL_TO_DANGEROUS_CONTRACT"),
		).toBe(true);
	}, 120000);

	test("flags possible typosquat spender", async () => {
		const result = await analyzeApproval(
			{
				token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
				spender: "0x7a250d5630b4cf539739df2c5eacb4c659f2488d",
				amount: 1n,
			},
			"ethereum",
		);

		expect(result.flags.possibleTyposquat).toBe(true);
		expect(result.findings.some((finding) => finding.code === "POSSIBLE_TYPOSQUAT")).toBe(true);
	}, 120000);
}, 120000);
