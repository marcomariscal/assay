import { describe, expect, test } from "bun:test";
import { simulateWithAnvilWalletFast } from "../src/simulations/balance";

describe("wallet-fast approvals confidence", () => {
	test("does not downgrade approvals confidence when budget is exhausted with no approval events", async () => {
		const from = "0x1111111111111111111111111111111111111111";
		const to = "0x2222222222222222222222222222222222222222";
		const receipt = {
			status: "success",
			blockNumber: 100n,
			gasUsed: 21_000n,
			effectiveGasPrice: 1n,
			logs: [],
		};
		const client = {
			getBalance: async () => 1_000_000n,
			sendUnsignedTransaction: async () => "0xabc",
			waitForTransactionReceipt: async () => receipt,
			readContract: async () => 0n,
			call: async () => null,
		};

		const result = await simulateWithAnvilWalletFast({
			tx: {
				to,
				from,
				data: "0x",
				value: "0",
				chain: "ethereum",
			},
			client,
			from,
			to,
			data: "0x",
			txValue: 0n,
			notes: [],
			balanceConfidence: "high",
			approvalsConfidence: "high",
			budgetMs: 0,
		});

		expect(result.approvals.changes).toEqual([]);
		expect(result.approvals.confidence).toBe("high");
		expect(result.notes).toContain(
			"Wallet-fast budget (0ms) reached; skipped ERC-20 metadata lookups.",
		);
		expect(
			result.notes.some((note) =>
				note.includes("reached before approval state reads; using event-derived approvals"),
			),
		).toBe(false);
	});
});
