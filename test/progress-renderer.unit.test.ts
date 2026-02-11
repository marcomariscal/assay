import { describe, expect, test } from "bun:test";
import { createProgressRenderer } from "../src/cli/ui";

function captureStdout(run: () => void): string {
	const writes: string[] = [];
	const originalWrite = process.stdout.write.bind(process.stdout);
	const captureWrite: typeof process.stdout.write = (chunk, encoding, callback) => {
		if (typeof chunk === "string") {
			writes.push(chunk);
		} else {
			writes.push(Buffer.from(chunk).toString());
		}
		if (typeof encoding === "function") {
			encoding();
		}
		if (typeof callback === "function") {
			callback();
		}
		return true;
	};

	process.stdout.write = captureWrite;
	try {
		run();
	} finally {
		process.stdout.write = originalWrite;
	}

	return writes.join("");
}

describe("progress renderer", () => {
	test("suppresses low-signal success lines when configured", () => {
		const output = captureStdout(() => {
			const render = createProgressRenderer(false, { suppressLowSignalSuccess: true });
			render({ provider: "Etherscan", status: "success", message: "no data" });
			render({ provider: "DeFiLlama", status: "success", message: "no match" });
			render({ provider: "Etherscan phishing list", status: "success", message: "checked" });
		});

		expect(output).toBe("");
	});

	test("keeps high-signal and error lines even when suppression is enabled", () => {
		const output = captureStdout(() => {
			const render = createProgressRenderer(false, { suppressLowSignalSuccess: true });
			render({ provider: "RPC", status: "success", message: "interacting with contract" });
			render({ provider: "Sourcify", status: "error", message: "timeout" });
		});

		expect(output).toContain("RPC");
		expect(output).toContain("interacting with contract");
		expect(output).toContain("Sourcify");
		expect(output).toContain("timeout");
	});
});
