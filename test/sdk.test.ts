import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ScanError, scan, scanAddress } from "../src/sdk";

const fixturePath = "test/fixtures/scan-response.json";

let originalFetch: typeof fetch;

beforeAll(() => {
	originalFetch = globalThis.fetch;
});

afterAll(() => {
	globalThis.fetch = originalFetch;
});

describe("sdk", () => {
	test("scan returns AnalyzeResponse", async () => {
		const fixture = JSON.parse(await Bun.file(fixturePath).text());
		globalThis.fetch = async (_input, init) => {
			const body = init?.body ? JSON.parse(String(init.body)) : null;
			expect(body.address).toBe("0x1111111111111111111111111111111111111111");
			return new Response(JSON.stringify(fixture), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		};

		const response = await scan(
			{ address: "0x1111111111111111111111111111111111111111" },
			{ apiKey: "test", baseUrl: "http://localhost:3000" },
		);
		expect(response).toEqual(fixture);
	});

	test("scanAddress includes chain when provided", async () => {
		const fixture = JSON.parse(await Bun.file(fixturePath).text());
		globalThis.fetch = async (_input, init) => {
			const body = init?.body ? JSON.parse(String(init.body)) : null;
			expect(body.chain).toBe("1");
			return new Response(JSON.stringify(fixture), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		};

		const response = await scanAddress("0x1111111111111111111111111111111111111111", "1", {
			apiKey: "test",
			baseUrl: "http://localhost:3000",
		});
		expect(response.requestId).toBe(fixture.requestId);
	});

	test("scan surfaces API errors", async () => {
		globalThis.fetch = async () => {
			return new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "content-type": "application/json" },
			});
		};

		let error: unknown;
		try {
			await scan({ address: "0x1111111111111111111111111111111111111111" });
		} catch (err) {
			error = err;
		}

		expect(error).toBeInstanceOf(ScanError);
		if (error instanceof ScanError) {
			expect(error.status).toBe(401);
			expect(error.message).toBe("Unauthorized");
		}
	});
});
