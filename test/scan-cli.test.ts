import { describe, expect, test } from "bun:test";

async function runCli(args: string[], envOverrides: Record<string, string | undefined> = {}) {
	const env = { ...process.env, ...envOverrides };
	const proc = Bun.spawn(["bun", "run", "src/cli/index.ts", ...args], {
		stdout: "pipe",
		stderr: "pipe",
		env,
	});
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const exitCode = await proc.exited;
	return { exitCode, stdout, stderr };
}

describe("cli scan", () => {
	test(
		"--format json outputs AnalyzeResponse",
		async () => {
			const result = await runCli([
				"scan",
				"0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
				"--format",
				"json",
				"--quiet",
			]);

			expect(result.exitCode).toBe(0);
			const parsed = JSON.parse(result.stdout);
			expect(parsed.requestId).toBeDefined();
			expect(parsed.scan?.input?.address).toBeDefined();
			expect(parsed.scan?.recommendation).toBeDefined();
		},
		120000,
	);

	test(
		"--fail-on caution returns exit code 2 for caution findings",
		async () => {
			const result = await runCli([
				"scan",
				"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
				"--format",
				"json",
				"--fail-on",
				"caution",
				"--quiet",
			]);

			expect(result.exitCode).toBe(2);
		},
		120000,
	);

	test(
		"--format sarif outputs SARIF log",
		async () => {
			const result = await runCli([
				"scan",
				"0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
				"--format",
				"sarif",
				"--quiet",
			]);
			expect(result.exitCode).toBe(0);
			const parsed = JSON.parse(result.stdout);
			expect(parsed.version).toBe("2.1.0");
			expect(parsed.runs?.length).toBe(1);
		},
		120000,
	);

	test(
		"--calldata accepts JSON input",
		async () => {
			const calldata = JSON.stringify({
				to: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
				data: "0x",
				chain: "1",
			});
			const result = await runCli([
				"scan",
				"--calldata",
				calldata,
				"--format",
				"json",
				"--quiet",
			]);

		expect(result.exitCode).toBe(0);
		const parsed = JSON.parse(result.stdout);
		expect(parsed.scan?.input?.calldata?.to).toBe(
			"0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
		);
	},
	120000,
);
});
