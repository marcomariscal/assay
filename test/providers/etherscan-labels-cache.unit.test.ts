import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
	_resetPhishHackCache,
	getAddressLabels,
	getLabelsCacheState,
	type LabelsCacheState,
} from "../../src/providers/etherscan";

const TMP_CACHE_DIR = path.join(import.meta.dir, ".tmp-cache");

let originalFetch: typeof globalThis.fetch;
let originalEnv: string | undefined;

beforeEach(() => {
	originalFetch = globalThis.fetch;
	originalEnv = process.env.ASSAY_CACHE_DIR;
	process.env.ASSAY_CACHE_DIR = TMP_CACHE_DIR;
	_resetPhishHackCache();
	if (existsSync(TMP_CACHE_DIR)) {
		rmSync(TMP_CACHE_DIR, { recursive: true });
	}
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	process.env.ASSAY_CACHE_DIR = originalEnv;
	_resetPhishHackCache();
	if (existsSync(TMP_CACHE_DIR)) {
		rmSync(TMP_CACHE_DIR, { recursive: true });
	}
});

function writeCacheFile(chainId: number, addresses: string[], ageMs = 0) {
	mkdirSync(TMP_CACHE_DIR, { recursive: true });
	const cachePath = path.join(TMP_CACHE_DIR, `etherscan-phish-hack-${chainId}.json`);
	const payload = {
		version: 1,
		updatedAtMs: Date.now() - ageMs,
		addresses,
	};
	writeFileSync(cachePath, `${JSON.stringify(payload)}\n`, "utf-8");
	// If we need to make it look old (stale), we backdate mtime
	if (ageMs > 0) {
		const { utimesSync } = require("node:fs") as typeof import("node:fs");
		const backDate = new Date(Date.now() - ageMs);
		utimesSync(cachePath, backDate, backDate);
	}
}

function stubFetchNeverCalled(): void {
	globalThis.fetch = async () => {
		throw new Error("fetch should not have been called");
	};
}

function stubFetchTimeout(): void {
	globalThis.fetch = async (_input, init) => {
		// Simulate abort/timeout
		const signal = (init as RequestInit | undefined)?.signal;
		if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
		throw new DOMException("Aborted", "AbortError");
	};
}

function stubFetchPhishHack(addresses: string[]): void {
	const csvLink = "https://example.com/export.csv";
	const csvContent = addresses.map((a) => `"${a}","Phish / Hack"`).join("\n");

	globalThis.fetch = async (input) => {
		const url = typeof input === "string" ? input : input.toString();
		if (url.includes("exportaddresstags")) {
			return new Response(JSON.stringify({ link: csvLink }), { status: 200 });
		}
		if (url === csvLink) {
			return new Response(csvContent, { status: 200 });
		}
		// nametag endpoint returns not-ok to trigger fallback
		return new Response("", { status: 403 });
	};
}

function stubFetchExclusive(): void {
	globalThis.fetch = async (input) => {
		const url = typeof input === "string" ? input : input.toString();
		if (url.includes("nametag")) {
			return new Response(
				JSON.stringify({
					status: "0",
					message: "NOTOK",
					result: "Error! API Exclusive endpoint",
				}),
				{ status: 200 },
			);
		}
		return new Response("", { status: 403 });
	};
}

describe("etherscan labels disk cache", () => {
	test("getLabelsCacheState returns cold when no cache file exists", () => {
		const state: LabelsCacheState = getLabelsCacheState("ethereum");
		expect(state).toBe("cold");
	});

	test("getLabelsCacheState returns warm for recent cache", () => {
		writeCacheFile(1, ["0x0000000000000000000000000000000000000001"]);
		const state = getLabelsCacheState("ethereum");
		expect(state).toBe("warm");
	});

	test("getLabelsCacheState returns stale for old cache", () => {
		const twentyFiveHoursMs = 25 * 60 * 60 * 1000;
		writeCacheFile(1, ["0x0000000000000000000000000000000000000001"], twentyFiveHoursMs);
		const state = getLabelsCacheState("ethereum");
		expect(state).toBe("stale");
	});

	test("warm disk cache avoids network fetch", async () => {
		const phishAddr = "0x000011387eb24f199e875b1325e4805efd3b0000";
		writeCacheFile(1, [phishAddr]);
		stubFetchNeverCalled();

		const result = await getAddressLabels(phishAddr, "ethereum", undefined, {
			timeoutMs: 500,
			cache: true,
		});

		expect(result).not.toBeNull();
		expect(result?.labels).toContain("Phish / Hack");
	});

	test("cold cache fetches from network and writes cache file", async () => {
		const phishAddr = "0x000011387eb24f199e875b1325e4805efd3b0000";
		stubFetchPhishHack([phishAddr]);

		const result = await getAddressLabels(phishAddr, "ethereum", undefined, {
			timeoutMs: 5_000,
			cache: true,
		});

		expect(result).not.toBeNull();
		expect(result?.labels).toContain("Phish / Hack");

		// Cache file should now exist
		const cacheFile = path.join(TMP_CACHE_DIR, "etherscan-phish-hack-1.json");
		expect(existsSync(cacheFile)).toBe(true);
	});

	test("cold cache + timeout returns null (no detection)", async () => {
		stubFetchTimeout();

		const result = await getAddressLabels(
			"0x000011387eb24f199e875b1325e4805efd3b0000",
			"ethereum",
			undefined,
			{ timeoutMs: 100, cache: true },
		);

		expect(result).toBeNull();
	});

	test("stale cache still returns data even if refresh fails", async () => {
		const phishAddr = "0x000011387eb24f199e875b1325e4805efd3b0000";
		const twentyFiveHoursMs = 25 * 60 * 60 * 1000;
		writeCacheFile(1, [phishAddr], twentyFiveHoursMs);
		stubFetchTimeout();

		const result = await getAddressLabels(phishAddr, "ethereum", undefined, {
			timeoutMs: 500,
			cache: true,
		});

		expect(result).not.toBeNull();
		expect(result?.labels).toContain("Phish / Hack");
	});

	test("non-matching address returns null even with warm cache", async () => {
		const phishAddr = "0x000011387eb24f199e875b1325e4805efd3b0000";
		writeCacheFile(1, [phishAddr]);
		stubFetchNeverCalled();

		const result = await getAddressLabels(
			"0x0000000000000000000000000000000000000001",
			"ethereum",
			undefined,
			{ timeoutMs: 500, cache: true },
		);

		expect(result).toBeNull();
	});
});

describe("nametag exclusive endpoint detection", () => {
	test("API Exclusive response caches non-support and falls back to phish list", async () => {
		const phishAddr = "0x000011387eb24f199e875b1325e4805efd3b0000";
		writeCacheFile(1, [phishAddr]);
		stubFetchExclusive();

		const result = await getAddressLabels(phishAddr, "ethereum", "fake-api-key", {
			timeoutMs: 2_000,
			cache: true,
		});

		expect(result).not.toBeNull();
		expect(result?.labels).toContain("Phish / Hack");
	});

	test("without API key, nametag endpoint is skipped entirely", async () => {
		const phishAddr = "0x000011387eb24f199e875b1325e4805efd3b0000";
		writeCacheFile(1, [phishAddr]);

		let nametagCalled = false;
		globalThis.fetch = async (input) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url.includes("nametag")) {
				nametagCalled = true;
			}
			return new Response("", { status: 403 });
		};

		await getAddressLabels(phishAddr, "ethereum", undefined, {
			timeoutMs: 2_000,
			cache: true,
		});

		expect(nametagCalled).toBe(false);
	});
});
