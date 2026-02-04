import { describe, expect, test } from "bun:test";
import { simulateBalance } from "../src/simulations/balance";

describe("simulateBalance", () => {
	test("missing anvil returns simulation not run with Foundry hint", async () => {
		const result = await simulateBalance(
			{
				to: "0x1111111111111111111111111111111111111111",
				from: "0x2222222222222222222222222222222222222222",
				data: "0x",
				value: "0x0",
				chain: "1",
			},
			"ethereum",
			{
				simulation: {
					enabled: true,
					anvilPath: "__definitely_not_anvil__",
				},
			},
		);

		expect(result.success).toBe(false);
		expect(result.revertReason).toBe("Simulation not run");
		const notes = result.notes.join("\n");
		expect(notes).toContain("Anvil not found");
		expect(notes).toContain("Foundry");
	});
});
