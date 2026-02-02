import { describe, expect, test } from "bun:test";
import { formatSarif } from "../src/cli/formatters/sarif";
import { analyzeResponseSchema } from "../src/schema";

const responseFixturePath = "test/fixtures/scan-response.json";
const sarifFixturePath = "test/fixtures/scan-sarif.json";

describe("sarif formatter", () => {
	test("formats SARIF consistently", async () => {
		const responseRaw = JSON.parse(await Bun.file(responseFixturePath).text());
		const response = analyzeResponseSchema.parse(responseRaw);
		const expected = JSON.parse(await Bun.file(sarifFixturePath).text());
		const formatted = formatSarif(response);
		expect(formatted).toEqual(expected);
	});
});
