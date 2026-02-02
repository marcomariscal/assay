import { describe, expect, test } from "bun:test";
import { isPossibleTyposquat } from "../src/approvals/typosquat";

describe("typosquat detection", () => {
	test("exact match does not trigger", () => {
		const known = [
			{
				name: "Uniswap V2 Router",
				address: "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
			},
		];

		const result = isPossibleTyposquat(known[0].address, known);
		expect(result).toBeNull();
	});

	test("near match with same prefix/suffix triggers", () => {
		const known = [
			{
				name: "Uniswap V2 Router",
				address: "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
			},
		];
		const candidate = "0x7a250d5630b4cf539739df2c5eacb4c659f2488d";

		const result = isPossibleTyposquat(candidate, known);
		expect(result?.match.name).toBe("Uniswap V2 Router");
	});

	test("distance above threshold does not trigger", () => {
		const known = [
			{
				name: "Uniswap V2 Router",
				address: "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
			},
		];
		const candidate = "0x7a250d5630b4cf539739ab3c5dacb4c659f2488d";

		const result = isPossibleTyposquat(candidate, known);
		expect(result).toBeNull();
	});
});
