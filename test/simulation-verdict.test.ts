import { describe, expect, test } from "bun:test";
import type { ScanInput } from "../src/schema";
import { applySimulationVerdict } from "../src/simulations/verdict";
import type { AnalysisResult } from "../src/types";

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

	test("downgrades ok to caution when simulation reverts", () => {
		const analysis: AnalysisResult = {
			...baseAnalysis(),
			simulation: {
				success: false,
				revertReason: "execution reverted: transferFrom failed",
				balances: { changes: [], confidence: "low" },
				approvals: { changes: [], confidence: "low" },
				notes: ["reverted"],
			},
		};
		const result = applySimulationVerdict(calldataInput(), analysis);
		expect(result.recommendation).toBe("caution");
	});

	test("does not downgrade danger when simulation not run", () => {
		const analysis: AnalysisResult = {
			...baseAnalysis(),
			recommendation: "danger",
			simulation: {
				success: false,
				revertReason: "Simulation not run",
				balances: { changes: [], confidence: "none" },
				approvals: { changes: [], confidence: "none" },
				notes: ["Simulation not run"],
			},
		};
		const result = applySimulationVerdict(calldataInput(), analysis);
		expect(result.recommendation).toBe("danger");
	});

	test("does not downgrade when simulation succeeds", () => {
		const analysis: AnalysisResult = {
			...baseAnalysis(),
			recommendation: "warning",
			simulation: {
				success: true,
				balances: { changes: [], confidence: "high" },
				approvals: { changes: [], confidence: "high" },
				notes: [],
			},
		};
		const result = applySimulationVerdict(calldataInput(), analysis);
		expect(result.recommendation).toBe("warning");
	});
});
