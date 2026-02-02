import { describe, expect, test } from "bun:test";
import { createScanHandler } from "../src/server";

const fixturePath = "test/fixtures/scan-response.json";

async function readFixture() {
	return JSON.parse(await Bun.file(fixturePath).text());
}

describe("server", () => {
	test("rejects unauthorized requests", async () => {
		const handler = createScanHandler({ apiKey: "test" });
		const response = await handler(
			new Request("http://localhost/v1/scan", { method: "POST", body: "{}" }),
		);
		expect(response.status).toBe(401);
	});

	test("rejects missing input", async () => {
		const handler = createScanHandler({ apiKey: "test" });
		const response = await handler(
			new Request("http://localhost/v1/scan", {
				method: "POST",
				headers: { authorization: "Bearer test", "content-type": "application/json" },
				body: JSON.stringify({}),
			}),
		);
		expect(response.status).toBe(400);
	});

	test("rejects invalid address", async () => {
		const handler = createScanHandler({ apiKey: "test" });
		const response = await handler(
			new Request("http://localhost/v1/scan", {
				method: "POST",
				headers: { authorization: "Bearer test", "content-type": "application/json" },
				body: JSON.stringify({ address: "not-an-address" }),
			}),
		);
		expect(response.status).toBe(422);
	});

	test("returns AnalyzeResponse for valid scan", async () => {
		const fixture = await readFixture();
		const handler = createScanHandler({
			apiKey: "test",
			scanFn: async () => fixture,
			config: {},
		});
		const response = await handler(
			new Request("http://localhost/v1/scan", {
				method: "POST",
				headers: { authorization: "Bearer test", "content-type": "application/json" },
				body: JSON.stringify({
					address: "0x1111111111111111111111111111111111111111",
					chain: "1",
				}),
			}),
		);
		const body = await response.json();
		expect(response.status).toBe(200);
		expect(body).toEqual(fixture);
	});
});
