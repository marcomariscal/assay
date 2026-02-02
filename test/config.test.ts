import { describe, expect, test } from "bun:test";
import { writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadConfig } from "../src/config";

function setEnv(key: string, value: string | undefined) {
	if (value === undefined) {
		delete process.env[key];
		return;
	}
	process.env[key] = value;
}

describe("config", () => {
	test("env overrides config file AI keys", async () => {
		const tempPath = path.join(os.tmpdir(), `rugscan-config-${Date.now()}.json`);
		await writeFile(
			tempPath,
			JSON.stringify({
				ai: {
					anthropic_api_key: "file-key",
					default_model: "file-model",
				},
			}),
		);

		const previous = {
			RUGSCAN_CONFIG: process.env.RUGSCAN_CONFIG,
			ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
		};

		try {
			setEnv("RUGSCAN_CONFIG", tempPath);
			setEnv("ANTHROPIC_API_KEY", "env-key");

			const config = await loadConfig();
			expect(config.ai?.anthropic_api_key).toBe("env-key");
			expect(config.ai?.default_model).toBe("file-model");
		} finally {
			setEnv("RUGSCAN_CONFIG", previous.RUGSCAN_CONFIG);
			setEnv("ANTHROPIC_API_KEY", previous.ANTHROPIC_API_KEY);
			await rm(tempPath, { force: true });
		}
	});
});
