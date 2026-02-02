import type { AnalyzeResponse, ScanFinding } from "../../schema";

export interface SarifLog {
	version: "2.1.0";
	$schema: string;
	runs: SarifRun[];
}

export interface SarifRun {
	tool: {
		driver: {
			name: string;
			rules: SarifRule[];
		};
	};
	results: SarifResult[];
}

export interface SarifRule {
	id: string;
	name?: string;
	shortDescription?: { text: string };
}

export interface SarifResult {
	ruleId: string;
	level?: "error" | "warning" | "note" | "none";
	message: { text: string };
	properties?: Record<string, unknown>;
}

export function formatSarif(response: AnalyzeResponse): SarifLog {
	const findings = response.scan.findings;
	const rules = buildRules(findings);
	return {
		$schema: "https://json.schemastore.org/sarif-2.1.0.json",
		version: "2.1.0",
		runs: [
			{
				tool: {
					driver: {
						name: "rugscan",
						rules,
					},
				},
				results: findings.map((finding) => ({
					ruleId: finding.code,
					level: mapSarifLevel(finding.severity),
					message: { text: finding.message },
					properties: buildProperties(finding),
				})),
			},
		],
	};
}

function buildRules(findings: ScanFinding[]): SarifRule[] {
	const seen = new Set<string>();
	const rules: SarifRule[] = [];
	for (const finding of findings) {
		if (seen.has(finding.code)) continue;
		seen.add(finding.code);
		rules.push({
			id: finding.code,
			name: finding.code,
			shortDescription: { text: finding.message },
		});
	}
	return rules;
}

function buildProperties(finding: ScanFinding): Record<string, unknown> | undefined {
	const properties: Record<string, unknown> = { severity: finding.severity };
	if (finding.details) {
		properties.details = finding.details;
	}
	if (finding.refs) {
		properties.refs = finding.refs;
	}
	return Object.keys(properties).length > 0 ? properties : undefined;
}

function mapSarifLevel(severity: ScanFinding["severity"]): SarifResult["level"] {
	if (severity === "danger") return "error";
	if (severity === "warning") return "warning";
	if (severity === "caution") return "note";
	return "none";
}
