import { describe, expect, test } from "bun:test";
import { renderResultBox } from "../src/cli/ui";
import type { AnalysisResult } from "../src/types";

function stripAnsi(input: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequence
	return input.replace(/\x1b\[[0-9;]*m/g, "");
}

function baseAnalysis(): AnalysisResult {
	return {
		contract: {
			address: "0x1111111111111111111111111111111111111111",
			chain: "ethereum",
			verified: true,
			confidence: "high",
			is_proxy: false,
		},
		findings: [],
		recommendation: "ok",
	};
}

describe("cli risk label with simulation failures", () => {
	test("simulation failed + calldata never shows SAFE", () => {
		const analysis: AnalysisResult = {
			...baseAnalysis(),
			simulation: {
				success: false,
				revertReason: "Simulation failed",
				balances: { changes: [], confidence: "low" },
				approvals: { changes: [], confidence: "low" },
				notes: ["Simulation failed"],
			},
		};

		const output = stripAnsi(renderResultBox(analysis, { hasCalldata: true }));
		const riskLine = output.split("\n").find((line) => line.includes("📊 RISK:"));
		expect(riskLine).toBeDefined();
		expect(riskLine).not.toContain("SAFE");
		expect(riskLine).toContain("LOW");
		expect(output).not.toContain("- None detected");
	});

	test("simulation missing + calldata never shows SAFE", () => {
		const analysis: AnalysisResult = {
			...baseAnalysis(),
		};

		const output = stripAnsi(renderResultBox(analysis, { hasCalldata: true }));
		const riskLine = output.split("\n").find((line) => line.includes("📊 RISK:"));
		expect(riskLine).toBeDefined();
		expect(riskLine).not.toContain("SAFE");
		expect(riskLine).toContain("LOW");
		expect(output).not.toContain("- None detected");
	});

	test("simulation success (low confidence) + calldata never shows SAFE", () => {
		const analysis: AnalysisResult = {
			...baseAnalysis(),
			simulation: {
				success: true,
				balances: { changes: [], confidence: "low" },
				approvals: { changes: [], confidence: "low" },
				notes: [],
			},
		};

		const output = stripAnsi(renderResultBox(analysis, { hasCalldata: true }));
		const riskLine = output.split("\n").find((line) => line.includes("📊 RISK:"));
		expect(riskLine).toBeDefined();
		expect(riskLine).not.toContain("SAFE");
		expect(riskLine).toContain("LOW");
		expect(output).toContain("Could not verify all balance changes; treat this as higher risk.");
		expect(output).toContain("Approval coverage is incomplete; treat this as higher risk.");
	});
});
