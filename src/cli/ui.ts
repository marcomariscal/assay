import pc from "picocolors";
import { MAX_UINT256 } from "../constants";
import type {
	AIConcern,
	AIAnalysis,
	AnalysisResult,
	ApprovalAnalysisResult,
	ApprovalContext,
	ApprovalTx,
	Chain,
	Finding,
	Recommendation,
} from "../types";

const COLORS = {
	ok: pc.green,
	warning: pc.yellow,
	danger: pc.red,
	dim: pc.gray,
};

type ProviderStatus = "start" | "success" | "error";

export interface ProviderEvent {
	provider: string;
	status: ProviderStatus;
	message?: string;
}

const SPINNER_FRAMES = ["◐", "◓", "◑", "◒"];

function stripAnsi(input: string): string {
	return input.replace(/\x1b\[[0-9;]*m/g, "");
}

function visibleLength(input: string): number {
	return stripAnsi(input).length;
}

function padRight(input: string, width: number): string {
	const length = visibleLength(input);
	if (length >= width) return input;
	return `${input}${" ".repeat(width - length)}`;
}

class Spinner {
	private timer: ReturnType<typeof setInterval> | null = null;
	private frameIndex = 0;
	private lastLineLength = 0;
	private text = "";

	constructor(private enabled: boolean) {}

	start(text: string) {
		this.stop();
		this.text = text;
		if (!this.enabled) {
			process.stdout.write(`${text}\n`);
			return;
		}
		this.render();
		this.timer = setInterval(() => this.render(), 80);
	}

	succeed(text: string) {
		this.stop();
		this.writeLine(text, true);
	}

	fail(text: string) {
		this.stop();
		this.writeLine(text, true);
	}

	private stop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	private render() {
		const frame = SPINNER_FRAMES[this.frameIndex % SPINNER_FRAMES.length];
		this.frameIndex += 1;
		this.writeLine(`${COLORS.dim(frame)} ${this.text}`, false);
	}

	private writeLine(line: string, newline: boolean) {
		if (!this.enabled) {
			process.stdout.write(line + (newline ? "\n" : ""));
			return;
		}

		const length = visibleLength(line);
		const clear = this.lastLineLength > length ? " ".repeat(this.lastLineLength - length) : "";
		process.stdout.write(`\r${line}${clear}${newline ? "\n" : ""}`);
		this.lastLineLength = newline ? 0 : length;
	}
}

export function createProgressRenderer(enabled: boolean) {
	const spinner = new Spinner(enabled);
	return (event: ProviderEvent) => {
		switch (event.status) {
			case "start":
				spinner.start(`${COLORS.dim("Checking")} ${event.provider}...`);
				break;
			case "success": {
				const detail = event.message ? ` ${COLORS.dim(`(${event.message})`)}` : "";
				spinner.succeed(`${COLORS.ok("✓")} ${event.provider}${detail}`);
				break;
			}
			case "error": {
				const detail = event.message ? ` ${COLORS.dim(`(${event.message})`)}` : "";
				spinner.fail(`${COLORS.danger("✗")} ${event.provider}${detail}`);
				break;
			}
		}
	};
}

function recommendationStyle(recommendation: Recommendation) {
	switch (recommendation) {
		case "danger":
			return { label: "DANGER", icon: "🚨", color: COLORS.danger };
		case "warning":
			return { label: "WARNING", icon: "⚠️", color: COLORS.warning };
		case "caution":
			return { label: "CAUTION", icon: "⚡", color: COLORS.warning };
		case "ok":
		default:
			return { label: "OK", icon: "✅", color: COLORS.ok };
	}
}

function formatFindingLine(finding: Finding): string {
	const style =
		finding.level === "danger"
			? { icon: "🚨", color: COLORS.danger }
			: finding.level === "warning"
				? { icon: "⚠️", color: COLORS.warning }
				: finding.level === "safe"
					? { icon: "✓", color: COLORS.ok }
					: { icon: "ℹ️", color: COLORS.dim };

	const message = `${style.icon} ${finding.message}`;
	const code = COLORS.dim(`[${finding.code}]`);
	return `${style.color(message)} ${code}`.trimEnd();
}

function renderBox(title: string, sections: string[][]): string {
	const allLines = [title, ...sections.flat()];
	const width = allLines.reduce((max, line) => Math.max(max, visibleLength(line)), 0);
	const horizontal = "─".repeat(width + 2);

	const top = `╭${horizontal}╮`;
	const bottom = `╰${horizontal}╯`;
	const divider = `├${horizontal}┤`;

	const lines: string[] = [top];
	lines.push(`│ ${padRight(title, width)} │`);
	sections.forEach((section, index) => {
		lines.push(divider);
		for (const line of section) {
			lines.push(`│ ${padRight(line, width)} │`);
		}
		if (index === sections.length - 1) {
			return;
		}
	});
	lines.push(bottom);
	return lines.join("\n");
}

function riskLabel(score: number): string {
	if (score >= 85) return "CRITICAL";
	if (score >= 70) return "HIGH";
	if (score >= 50) return "MEDIUM";
	if (score >= 30) return "LOW";
	return "SAFE";
}

function severityColor(severity: AIConcern["severity"]) {
	if (severity === "medium") return COLORS.warning;
	return COLORS.danger;
}

function renderAISection(ai: AIAnalysis): string[] {
	const lines: string[] = [];
	lines.push(` AI: ${ai.provider} / ${ai.model}`);
	lines.push(` Risk score: ${ai.risk_score} (${riskLabel(ai.risk_score)})`);
	lines.push(` Summary: ${ai.summary}`);
	if (ai.concerns.length > 0) {
		lines.push(" Concerns:");
		for (const concern of ai.concerns) {
			const color = severityColor(concern.severity);
			lines.push(
				`  ${color(concern.severity.toUpperCase())} ${concern.title} (${concern.category}) - ${concern.explanation}`,
			);
		}
	} else {
		lines.push(COLORS.dim(" Concerns: None"));
	}
	return lines;
}

export function renderResultBox(result: AnalysisResult): string {
	const { label, icon, color } = recommendationStyle(result.recommendation);
	const title = ` ${color(`${icon} ${label}`)}`;

	const contractLabel = result.contract.name ?? result.contract.address;
	const contractLines: string[] = [];
	contractLines.push(` Contract: ${contractLabel}`);
	contractLines.push(` Chain: ${result.contract.chain}`);

	const verifiedMark = result.contract.verified ? COLORS.ok("✓") : COLORS.danger("✗");
	contractLines.push(` Verified: ${verifiedMark}`);

	if (result.contract.name) {
		contractLines.push(COLORS.dim(` Address: ${result.contract.address}`));
	}

	if (result.protocol) {
		contractLines.push(` Protocol: ${result.protocol}`);
	}

	if (result.contract.age_days !== undefined) {
		contractLines.push(COLORS.dim(` Age: ${result.contract.age_days} days`));
	}
	if (result.contract.tx_count !== undefined) {
		contractLines.push(COLORS.dim(` Transactions: ${result.contract.tx_count}`));
	}
	if (result.contract.is_proxy) {
		const proxyLabel = result.contract.implementation
			? `Yes (${result.contract.implementation})`
			: "Yes";
		contractLines.push(COLORS.dim(` Proxy: ${proxyLabel}`));
	}

	const confidence = result.confidence.level.toUpperCase();
	contractLines.push(COLORS.dim(` Confidence: ${confidence}`));
	for (const reason of result.confidence.reasons) {
		contractLines.push(COLORS.dim(` Reason: ${reason}`));
	}

	const findingsLines: string[] = [];
	findingsLines.push(" Findings:");
	if (result.findings.length === 0) {
		findingsLines.push(COLORS.dim("  None"));
	} else {
		for (const finding of result.findings) {
			findingsLines.push(` ${formatFindingLine(finding)}`);
		}
	}

	const sections = [contractLines, findingsLines];
	if (result.ai) {
		sections.push(renderAISection(result.ai));
	}

	return renderBox(title, sections);
}

function formatApprovalAmount(amount: bigint): string {
	return amount === MAX_UINT256 ? "max" : amount.toString();
}

export function renderApprovalBox(
	tx: ApprovalTx,
	chain: Chain,
	context: ApprovalContext | undefined,
	result: ApprovalAnalysisResult,
): string {
	const { label, icon, color } = recommendationStyle(result.recommendation);
	const title = ` ${color(`${icon} ${label}`)}`;

	const approvalLines: string[] = [];
	approvalLines.push(` Token: ${tx.token}`);
	approvalLines.push(` Spender: ${tx.spender}`);
	approvalLines.push(` Amount: ${formatApprovalAmount(tx.amount)}`);
	approvalLines.push(` Chain: ${chain}`);

	if (context?.expectedSpender) {
		approvalLines.push(COLORS.dim(` Expected: ${context.expectedSpender}`));
	}
	if (context?.calledContract) {
		approvalLines.push(COLORS.dim(` Called: ${context.calledContract}`));
	}

	const findingsLines: string[] = [];
	findingsLines.push(" Findings:");
	if (result.findings.length === 0) {
		findingsLines.push(COLORS.dim("  None"));
	} else {
		for (const finding of result.findings) {
			findingsLines.push(` ${formatFindingLine(finding)}`);
		}
	}

	const spenderLines: string[] = [];
	const spenderLabel =
		result.spenderAnalysis.contract.name ?? result.spenderAnalysis.contract.address;
	spenderLines.push(` Spender contract: ${spenderLabel}`);
	const verifiedMark = result.spenderAnalysis.contract.verified
		? COLORS.ok("✓")
		: COLORS.danger("✗");
	spenderLines.push(` Verified: ${verifiedMark}`);
	if (result.spenderAnalysis.protocol) {
		spenderLines.push(` Protocol: ${result.spenderAnalysis.protocol}`);
	}
	if (result.spenderAnalysis.contract.age_days !== undefined) {
		spenderLines.push(COLORS.dim(` Age: ${result.spenderAnalysis.contract.age_days} days`));
	}
	const spenderRecommendation = recommendationStyle(result.spenderAnalysis.recommendation);
	spenderLines.push(
		` Recommendation: ${spenderRecommendation.color(spenderRecommendation.label)}`,
	);

	return renderBox(title, [approvalLines, findingsLines, spenderLines]);
}

export function renderHeading(text: string): string {
	return COLORS.dim(text);
}

export function renderError(text: string): string {
	return COLORS.danger(text);
}
