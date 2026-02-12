import { describe, expect, test } from "bun:test";
import type { DecodedCall } from "../src/analyzers/calldata/decoder";
import { buildIntent } from "../src/intent";

describe("intent templates", () => {
	test("builds ERC20 approve intent", () => {
		const call: DecodedCall = {
			selector: "0x095ea7b3",
			signature: "approve(address,uint256)",
			functionName: "approve",
			source: "known-abi",
			standard: "erc20",
			args: {
				spender: "0x0000000000000000000000000000000000000001",
				amount: "1000",
			},
		};

		const intent = buildIntent(call, { contractName: "USDC" });
		expect(intent).toBe("Approve 0x0000000000000000000000000000000000000001 to spend 1000 USDC");
	});

	test("builds Aave borrow intent", () => {
		const call: DecodedCall = {
			selector: "0x12345678",
			signature: "borrow(address,uint256,uint256,uint16,address)",
			functionName: "borrow",
			source: "signature-db",
			args: [
				"0x0000000000000000000000000000000000000010",
				"2500",
				"2",
				"0",
				"0x0000000000000000000000000000000000000011",
			],
		};

		const intent = buildIntent(call, {});
		expect(intent).toBe("Borrow 2500 0x0000000000000000000000000000000000000010 from Aave");
	});

	test("builds router multicall intent", () => {
		const call: DecodedCall = {
			selector: "0x5ae401dc",
			signature: "multicall(uint256,bytes[])",
			functionName: "multicall",
			source: "local-selector",
			args: [],
		};

		const intent = buildIntent(call, {});
		expect(intent).toBe("Router multicall");
	});

	test("builds 1inch swap intent", () => {
		const call: DecodedCall = {
			selector: "0x07ed2379",
			signature:
				"swap(address,address,(address,address,address,address,uint256,uint256,uint256),bytes,bytes)",
			functionName: "swap",
			source: "local-selector",
			args: [],
		};

		const intent = buildIntent(call, {});
		expect(intent).toBe("1inch aggregated swap");
	});

	test("builds Safe execTransaction intent", () => {
		const call: DecodedCall = {
			selector: "0x6a761202",
			signature:
				"execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)",
			functionName: "execTransaction",
			source: "local-selector",
			args: {
				to: "0x0000000000000000000000000000000000000001",
				value: "0",
			},
			argNames: [
				"to",
				"value",
				"data",
				"operation",
				"safeTxGas",
				"baseGas",
				"gasPrice",
				"gasToken",
				"refundReceiver",
				"signatures",
			],
		};

		const intent = buildIntent(call, {});
		expect(intent).toBe("Safe: execute transaction to 0x0000000000000000000000000000000000000001");
	});

	test("builds Universal Router execute intent from decoded command plan", () => {
		const call: DecodedCall = {
			selector: "0x3593564c",
			signature: "execute(bytes,bytes[],uint256)",
			functionName: "execute",
			source: "local-selector",
			args: {
				commands: "0x0b1004",
				commandsDecoded: [
					{ index: 0, opcode: "0x0b", command: "WRAP_ETH", allowRevert: false },
					{ index: 1, opcode: "0x10", command: "V4_SWAP", allowRevert: false },
					{ index: 2, opcode: "0x04", command: "SWEEP", allowRevert: false },
				],
			},
		};

		const intent = buildIntent(call, {});
		expect(intent).toBe("Uniswap Universal Router: WRAP_ETH → V4_SWAP → SWEEP");
	});
});
