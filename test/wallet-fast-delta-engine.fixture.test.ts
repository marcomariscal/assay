import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { type Address, isAddress } from "viem";
import {
	buildWalletFastErc20Changes,
	selectWalletFastErc20Tokens,
} from "../src/simulations/delta-engine";
import type { ParsedTransfer } from "../src/simulations/logs";

const recordingsDir = path.join(import.meta.dir, "fixtures", "recordings");

type ExpectedDelta = {
	address: Address;
	amount: bigint;
	direction: "in" | "out";
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function parseFixtureAddress(value: unknown, label: string): Address {
	if (typeof value !== "string" || !isAddress(value)) {
		throw new Error(`Invalid ${label} address in fixture`);
	}
	return value;
}

function parseExpectedDeltas(value: unknown): ExpectedDelta[] {
	if (!Array.isArray(value)) {
		throw new Error("Fixture simulation.assetChanges must be an array");
	}
	const out: ExpectedDelta[] = [];
	for (const entry of value) {
		if (!isRecord(entry)) {
			throw new Error("Fixture asset change must be an object");
		}
		if (entry.assetType !== "erc20") continue;
		const address = parseFixtureAddress(entry.address, "assetChanges.address");
		if (entry.direction !== "in" && entry.direction !== "out") {
			throw new Error("Fixture assetChanges.direction must be in/out");
		}
		if (typeof entry.amount !== "string") {
			throw new Error("Fixture assetChanges.amount must be a string");
		}
		out.push({
			address,
			amount: BigInt(entry.amount),
			direction: entry.direction,
		});
	}
	return out;
}

async function loadRecording(name: string): Promise<{ actor: Address; expected: ExpectedDelta[] }> {
	const calldataPath = path.join(recordingsDir, name, "calldata.json");
	const responsePath = path.join(recordingsDir, name, "analyzeResponse.json");

	const calldataRaw: unknown = JSON.parse(await readFile(calldataPath, "utf-8"));
	const responseRaw: unknown = JSON.parse(await readFile(responsePath, "utf-8"));

	if (!isRecord(calldataRaw)) {
		throw new Error(`Invalid calldata fixture: ${name}`);
	}
	const actor = parseFixtureAddress(calldataRaw.from, "calldata.from");

	if (!isRecord(responseRaw) || !isRecord(responseRaw.scan)) {
		throw new Error(`Invalid analyzeResponse fixture: ${name}`);
	}
	const simulation = responseRaw.scan.simulation;
	if (!isRecord(simulation)) {
		throw new Error(`Missing simulation fixture: ${name}`);
	}

	return {
		actor,
		expected: parseExpectedDeltas(simulation.assetChanges),
	};
}

function buildSyntheticTransfers(
	actor: Address,
	expected: ExpectedDelta[],
	fallbackCounterparty: Address,
): ParsedTransfer[] {
	const transfers: ParsedTransfer[] = [];
	for (const [index, delta] of expected.entries()) {
		transfers.push({
			standard: "erc20",
			token: delta.address,
			from: delta.direction === "out" ? actor : fallbackCounterparty,
			to: delta.direction === "out" ? fallbackCounterparty : actor,
			amount: delta.amount,
			logIndex: index,
		});
	}
	return transfers;
}

let originalFetch: typeof globalThis.fetch;
let networkCallCount = 0;

beforeEach(() => {
	networkCallCount = 0;
	originalFetch = globalThis.fetch;
	globalThis.fetch = async () => {
		networkCallCount += 1;
		throw new Error("Network calls are disabled in wallet-fast delta fixtures");
	};
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	expect(networkCallCount).toBe(0);
});

describe("wallet-fast delta engine (fixture-backed)", () => {
	test("wallet-approve-usdc-unlimited-f7bf0220 preserves zero ERC-20 balance delta", async () => {
		const fixture = await loadRecording("wallet-approve-usdc-unlimited-f7bf0220");
		const actor = fixture.actor;
		const fallbackCounterparty = parseFixtureAddress(
			"0x0000000000000000000000000000000000000001",
			"fallbackCounterparty",
		);
		const transfers = buildSyntheticTransfers(actor, fixture.expected, fallbackCounterparty);

		const selected = selectWalletFastErc20Tokens({
			actor,
			transfers,
			maxTokens: 12,
		});

		const before = new Map<Address, bigint>();
		const after = new Map<Address, bigint>();
		for (const delta of fixture.expected) {
			if (delta.direction === "out") {
				before.set(delta.address, delta.amount);
				after.set(delta.address, 0n);
				continue;
			}
			before.set(delta.address, 0n);
			after.set(delta.address, delta.amount);
		}

		const computed = buildWalletFastErc20Changes({
			actor,
			transfers,
			tokens: selected.tokens,
			before,
			after,
		});

		const normalized = computed.map((change) => ({
			address: change.address,
			amount: change.amount,
			direction: change.direction,
		}));

		expect(normalized).toEqual(fixture.expected);
	});

	test("wallet-uniswap-swap-rlp-to-eth-fb2584e4 preserves ERC-20 outflow delta", async () => {
		const fixture = await loadRecording("wallet-uniswap-swap-rlp-to-eth-fb2584e4");
		const actor = fixture.actor;
		const fallbackCounterparty = parseFixtureAddress(
			"0x0000000000000000000000000000000000000001",
			"fallbackCounterparty",
		);
		const transfers = buildSyntheticTransfers(actor, fixture.expected, fallbackCounterparty);

		const selected = selectWalletFastErc20Tokens({
			actor,
			transfers,
			maxTokens: 12,
		});

		const before = new Map<Address, bigint>();
		const after = new Map<Address, bigint>();
		for (const delta of fixture.expected) {
			if (delta.direction === "out") {
				before.set(delta.address, delta.amount);
				after.set(delta.address, 0n);
				continue;
			}
			before.set(delta.address, 0n);
			after.set(delta.address, delta.amount);
		}

		const computed = buildWalletFastErc20Changes({
			actor,
			transfers,
			tokens: selected.tokens,
			before,
			after,
		});

		const normalized = computed.map((change) => ({
			address: change.address,
			amount: change.amount,
			direction: change.direction,
		}));

		expect(normalized).toEqual(fixture.expected);
	});
});
