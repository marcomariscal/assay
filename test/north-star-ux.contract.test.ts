import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderHeading, renderResultBox } from "../src/cli/ui";
import type { AnalyzeResponse } from "../src/schema";
import type {
	AnalysisResult,
	BalanceSimulationResult,
	Chain,
	ConfidenceLevel,
	Finding,
	FindingLevel,
	Recommendation,
} from "../src/types";

const recordingsDir = path.join(import.meta.dir, "fixtures", "recordings");

const BUNDLES = [
	"north-star__swap-sim-ok",
	"north-star__swap-sim-failed",
	"north-star__approve-unlimited-sim-not-run",
] as const;

type RenderContext = { hasCalldata?: boolean; sender?: string };

function stripAnsi(input: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequences
	return input.replace(/\x1b\[[0-9;]*m/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isChain(value: unknown): value is Chain {
	return (
		value === "ethereum" ||
		value === "base" ||
		value === "arbitrum" ||
		value === "optimism" ||
		value === "polygon"
	);
}

function isRecommendation(value: unknown): value is Recommendation {
	return value === "ok" || value === "caution" || value === "warning" || value === "danger";
}

function isFindingLevel(value: unknown): value is FindingLevel {
	return value === "danger" || value === "warning" || value === "info" || value === "safe";
}

function isConfidenceLevel(value: unknown): value is ConfidenceLevel {
	return value === "high" || value === "medium" || value === "low";
}

function isFinding(value: unknown): value is Finding {
	if (!isRecord(value)) return false;
	if (!isFindingLevel(value.level)) return false;
	if (typeof value.code !== "string" || value.code.length === 0) return false;
	if (typeof value.message !== "string" || value.message.length === 0) return false;
	if ("details" in value && value.details !== undefined && !isRecord(value.details)) return false;
	if ("refs" in value && value.refs !== undefined && !Array.isArray(value.refs)) return false;
	return true;
}

function isBalanceSimulationResult(value: unknown): value is BalanceSimulationResult {
	if (!isRecord(value)) return false;
	if (typeof value.success !== "boolean") return false;
	if (!Array.isArray(value.assetChanges)) return false;
	if (!Array.isArray(value.approvals)) return false;
	if (!isConfidenceLevel(value.confidence)) return false;
	if (!Array.isArray(value.notes)) return false;
	if (
		"revertReason" in value &&
		value.revertReason !== undefined &&
		typeof value.revertReason !== "string"
	) {
		return false;
	}
	return true;
}

function isAnalysisResult(value: unknown): value is AnalysisResult {
	if (!isRecord(value)) return false;
	if (!isRecord(value.contract)) return false;
	if (typeof value.contract.address !== "string" || value.contract.address.length === 0)
		return false;
	if (!isChain(value.contract.chain)) return false;
	if (typeof value.contract.verified !== "boolean") return false;
	if (typeof value.contract.is_proxy !== "boolean") return false;

	if (!Array.isArray(value.findings) || !value.findings.every(isFinding)) return false;
	if (!isRecord(value.confidence)) return false;
	if (!isConfidenceLevel(value.confidence.level)) return false;
	if (!Array.isArray(value.confidence.reasons)) return false;
	if (!isRecommendation(value.recommendation)) return false;
	if ("intent" in value && value.intent !== undefined && typeof value.intent !== "string")
		return false;
	if ("protocol" in value && value.protocol !== undefined && typeof value.protocol !== "string")
		return false;
	if ("simulation" in value && value.simulation !== undefined && value.simulation !== null) {
		if (!isBalanceSimulationResult(value.simulation)) return false;
	}
	return true;
}

function isRenderContext(value: unknown): value is RenderContext {
	if (!isRecord(value)) return false;
	if (
		"hasCalldata" in value &&
		value.hasCalldata !== undefined &&
		typeof value.hasCalldata !== "boolean"
	) {
		return false;
	}
	if ("sender" in value && value.sender !== undefined && typeof value.sender !== "string") {
		return false;
	}
	return true;
}

function isAnalyzeResponse(value: unknown): value is AnalyzeResponse {
	if (!isRecord(value)) return false;
	if (typeof value.requestId !== "string") return false;
	if (!isRecord(value.scan)) return false;
	return true;
}

describe("north-star pre-sign UX (contract)", () => {
	test("recording bundles render required headings + deterministic inconclusive semantics", async () => {
		for (const bundle of BUNDLES) {
			const dir = path.join(recordingsDir, bundle);
			const analysisRaw = JSON.parse(await readFile(path.join(dir, "analysis.json"), "utf-8"));
			const contextRaw = JSON.parse(await readFile(path.join(dir, "context.json"), "utf-8"));
			const responseRaw = JSON.parse(
				await readFile(path.join(dir, "analyzeResponse.json"), "utf-8"),
			);
			const expectedRaw = await readFile(path.join(dir, "rendered.txt"), "utf-8");

			expect(isAnalysisResult(analysisRaw)).toBe(true);
			expect(isRenderContext(contextRaw)).toBe(true);
			expect(isAnalyzeResponse(responseRaw)).toBe(true);
			if (!isAnalysisResult(analysisRaw) || !isRenderContext(contextRaw)) {
				throw new Error(`Invalid fixtures in ${bundle}`);
			}

			const analysis = analysisRaw;
			const context = contextRaw;

			const actual = `${renderHeading(`Tx scan on ${analysis.contract.chain}`)}\n\n${renderResultBox(analysis, context)}\n`;
			const normalizedActual = stripAnsi(actual);
			const normalizedExpected = stripAnsi(expectedRaw);

			// 1) Lock the output (fixtures are golden recordings)
			expect(normalizedActual).toBe(normalizedExpected);

			// 2) Required section headings exist and are ordered
			const requiredHeadings = ["🧾 CHECKS", "💰 BALANCE CHANGES", "🔐 APPROVALS", "📊 RISK"];
			let lastIndex = -1;
			for (const heading of requiredHeadings) {
				expect(normalizedActual).toContain(heading);
				const index = normalizedActual.indexOf(heading);
				expect(index).toBeGreaterThan(lastIndex);
				lastIndex = index;
			}

			// 3) INCONCLUSIVE semantics (simulation uncertain => explicit line)
			const simulationUncertain =
				Boolean(context.hasCalldata) &&
				(!analysis.simulation ||
					!analysis.simulation.success ||
					analysis.simulation.confidence !== "high");
			if (simulationUncertain) {
				expect(normalizedActual).toContain("INCONCLUSIVE");
			} else {
				expect(normalizedActual).not.toContain("INCONCLUSIVE");
			}
		}
	});
});
