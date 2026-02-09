import { describe, expect, test } from "bun:test";
import type { Address } from "viem";
import { PERMIT2_CANONICAL_ADDRESS } from "../src/permit2";
import { type ApprovalDiffClient, buildApprovalDiffs } from "../src/simulations/approval-diffs";
import type { ParsedApproval } from "../src/simulations/logs";

const OWNER = "0x1111111111111111111111111111111111111111";
const SPENDER_A = "0x2222222222222222222222222222222222222222";
const SPENDER_B = "0x3333333333333333333333333333333333333333";
const SPENDER_C = "0x4444444444444444444444444444444444444444";
const TOKEN_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TOKEN_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TOKEN_C = "0xcccccccccccccccccccccccccccccccccccccccc";
const NFT_A = "0xdddddddddddddddddddddddddddddddddddddddd";
const NFT_B = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const BEFORE_BLOCK = 100n;
const AFTER_BLOCK = 101n;

type ReadValue = unknown | Error;

function readKey(args: {
	address: Address;
	functionName: string;
	args?: readonly unknown[];
	blockNumber?: bigint;
}): string {
	const parts = [
		args.address.toLowerCase(),
		args.functionName,
		(args.blockNumber ?? 0n).toString(),
		...(args.args ?? []).map((value) => formatArg(value)),
	];
	return parts.join("|");
}

function formatArg(value: unknown): string {
	if (typeof value === "string") {
		return value.toLowerCase();
	}
	if (typeof value === "bigint") {
		return value.toString();
	}
	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}
	return JSON.stringify(value);
}

function createMockClient(values: Map<string, ReadValue>): ApprovalDiffClient {
	return {
		readContract: async (args) => {
			const key = readKey(args);
			const value = values.get(key);
			if (value === undefined) {
				throw new Error(`Missing mock for ${key}`);
			}
			if (value instanceof Error) {
				throw value;
			}
			return value;
		},
	};
}

function setRead(
	values: Map<string, ReadValue>,
	args: {
		address: Address;
		functionName: string;
		args?: readonly unknown[];
		blockNumber: bigint;
	},
	result: ReadValue,
): void {
	values.set(readKey(args), result);
}

function erc20Approval(input: {
	token: Address;
	spender: Address;
	amount: bigint;
	logIndex: number;
}): ParsedApproval {
	return {
		standard: "erc20",
		token: input.token,
		owner: OWNER,
		spender: input.spender,
		amount: input.amount,
		scope: "token",
		logIndex: input.logIndex,
	};
}

describe("buildApprovalDiffs", () => {
	test("builds ERC20 allowance diffs for increase, revoke, and skips unchanged", async () => {
		const values = new Map<string, ReadValue>();
		setRead(
			values,
			{
				address: TOKEN_A,
				functionName: "allowance",
				args: [OWNER, SPENDER_A],
				blockNumber: BEFORE_BLOCK,
			},
			0n,
		);
		setRead(
			values,
			{
				address: TOKEN_A,
				functionName: "allowance",
				args: [OWNER, SPENDER_A],
				blockNumber: AFTER_BLOCK,
			},
			25n,
		);

		setRead(
			values,
			{
				address: TOKEN_B,
				functionName: "allowance",
				args: [OWNER, SPENDER_B],
				blockNumber: BEFORE_BLOCK,
			},
			77n,
		);
		setRead(
			values,
			{
				address: TOKEN_B,
				functionName: "allowance",
				args: [OWNER, SPENDER_B],
				blockNumber: AFTER_BLOCK,
			},
			0n,
		);

		setRead(
			values,
			{
				address: TOKEN_C,
				functionName: "allowance",
				args: [OWNER, SPENDER_C],
				blockNumber: BEFORE_BLOCK,
			},
			9n,
		);
		setRead(
			values,
			{
				address: TOKEN_C,
				functionName: "allowance",
				args: [OWNER, SPENDER_C],
				blockNumber: AFTER_BLOCK,
			},
			9n,
		);

		const result = await buildApprovalDiffs(
			[
				erc20Approval({ token: TOKEN_A, spender: SPENDER_A, amount: 25n, logIndex: 1 }),
				erc20Approval({ token: TOKEN_B, spender: SPENDER_B, amount: 0n, logIndex: 2 }),
				erc20Approval({ token: TOKEN_C, spender: SPENDER_C, amount: 9n, logIndex: 3 }),
			],
			createMockClient(values),
			{ beforeBlock: BEFORE_BLOCK, afterBlock: AFTER_BLOCK },
		);

		expect(result.confidence).toBe("high");
		expect(result.notes).toEqual([]);
		expect(result.approvals).toHaveLength(2);
		expect(result.approvals).toContainEqual({
			standard: "erc20",
			token: TOKEN_A,
			owner: OWNER,
			spender: SPENDER_A,
			scope: "token",
			previousAmount: 0n,
			amount: 25n,
		});
		expect(result.approvals).toContainEqual({
			standard: "erc20",
			token: TOKEN_B,
			owner: OWNER,
			spender: SPENDER_B,
			scope: "token",
			previousAmount: 77n,
			amount: 0n,
		});
	});

	test("reads Permit2 allowance amount from uint160 tuple result", async () => {
		const values = new Map<string, ReadValue>();
		const permit2 = PERMIT2_CANONICAL_ADDRESS;
		setRead(
			values,
			{
				address: permit2,
				functionName: "allowance",
				args: [OWNER, TOKEN_A, SPENDER_A],
				blockNumber: BEFORE_BLOCK,
			},
			[15n, 0n, 1n],
		);
		setRead(
			values,
			{
				address: permit2,
				functionName: "allowance",
				args: [OWNER, TOKEN_A, SPENDER_A],
				blockNumber: AFTER_BLOCK,
			},
			[100n, 2n, 3n],
		);

		const result = await buildApprovalDiffs(
			[
				{
					standard: "permit2",
					token: TOKEN_A,
					owner: OWNER,
					spender: SPENDER_A,
					amount: 100n,
					scope: "token",
					logIndex: 1,
				},
			],
			createMockClient(values),
			{ beforeBlock: BEFORE_BLOCK, afterBlock: AFTER_BLOCK },
		);

		expect(result.confidence).toBe("high");
		expect(result.approvals).toEqual([
			{
				standard: "permit2",
				token: TOKEN_A,
				owner: OWNER,
				spender: SPENDER_A,
				scope: "token",
				previousAmount: 15n,
				amount: 100n,
			},
		]);
	});

	test("builds ERC721 token approval diff from getApproved pre/post reads", async () => {
		const values = new Map<string, ReadValue>();
		setRead(
			values,
			{
				address: NFT_A,
				functionName: "getApproved",
				args: [123n],
				blockNumber: BEFORE_BLOCK,
			},
			SPENDER_A,
		);
		setRead(
			values,
			{
				address: NFT_A,
				functionName: "getApproved",
				args: [123n],
				blockNumber: AFTER_BLOCK,
			},
			SPENDER_B,
		);

		const result = await buildApprovalDiffs(
			[
				{
					standard: "erc721",
					token: NFT_A,
					owner: OWNER,
					spender: SPENDER_B,
					tokenId: 123n,
					scope: "token",
					logIndex: 4,
				},
			],
			createMockClient(values),
			{ beforeBlock: BEFORE_BLOCK, afterBlock: AFTER_BLOCK },
		);

		expect(result.confidence).toBe("high");
		expect(result.approvals).toEqual([
			{
				standard: "erc721",
				token: NFT_A,
				owner: OWNER,
				spender: SPENDER_B,
				tokenId: 123n,
				scope: "token",
				previousSpender: SPENDER_A,
			},
		]);
	});

	test("builds ApprovalForAll diffs for ERC721 and ERC1155", async () => {
		const values = new Map<string, ReadValue>();
		setRead(
			values,
			{
				address: NFT_A,
				functionName: "isApprovedForAll",
				args: [OWNER, SPENDER_A],
				blockNumber: BEFORE_BLOCK,
			},
			false,
		);
		setRead(
			values,
			{
				address: NFT_A,
				functionName: "isApprovedForAll",
				args: [OWNER, SPENDER_A],
				blockNumber: AFTER_BLOCK,
			},
			true,
		);
		setRead(
			values,
			{
				address: NFT_B,
				functionName: "isApprovedForAll",
				args: [OWNER, SPENDER_B],
				blockNumber: BEFORE_BLOCK,
			},
			true,
		);
		setRead(
			values,
			{
				address: NFT_B,
				functionName: "isApprovedForAll",
				args: [OWNER, SPENDER_B],
				blockNumber: AFTER_BLOCK,
			},
			false,
		);

		const result = await buildApprovalDiffs(
			[
				{
					standard: "erc721",
					token: NFT_A,
					owner: OWNER,
					spender: SPENDER_A,
					scope: "all",
					approved: true,
					logIndex: 1,
				},
				{
					standard: "erc1155",
					token: NFT_B,
					owner: OWNER,
					spender: SPENDER_B,
					scope: "all",
					approved: false,
					logIndex: 2,
				},
			],
			createMockClient(values),
			{ beforeBlock: BEFORE_BLOCK, afterBlock: AFTER_BLOCK },
		);

		expect(result.confidence).toBe("high");
		expect(result.approvals).toContainEqual({
			standard: "erc721",
			token: NFT_A,
			owner: OWNER,
			spender: SPENDER_A,
			scope: "all",
			previousApproved: false,
			approved: true,
		});
		expect(result.approvals).toContainEqual({
			standard: "erc1155",
			token: NFT_B,
			owner: OWNER,
			spender: SPENDER_B,
			scope: "all",
			previousApproved: true,
			approved: false,
		});
	});

	test("dedupes same approval slot and keeps latest logIndex event for fallback", async () => {
		const values = new Map<string, ReadValue>();
		setRead(
			values,
			{
				address: TOKEN_A,
				functionName: "allowance",
				args: [OWNER, SPENDER_A],
				blockNumber: BEFORE_BLOCK,
			},
			new Error("read fail"),
		);
		setRead(
			values,
			{
				address: TOKEN_A,
				functionName: "allowance",
				args: [OWNER, SPENDER_A],
				blockNumber: AFTER_BLOCK,
			},
			new Error("read fail"),
		);

		const result = await buildApprovalDiffs(
			[
				erc20Approval({ token: TOKEN_A, spender: SPENDER_A, amount: 1n, logIndex: 3 }),
				erc20Approval({ token: TOKEN_A, spender: SPENDER_A, amount: 999n, logIndex: 8 }),
			],
			createMockClient(values),
			{ beforeBlock: BEFORE_BLOCK, afterBlock: AFTER_BLOCK },
		);

		expect(result.confidence).toBe("low");
		expect(result.notes).toHaveLength(1);
		expect(result.notes[0]).toContain("Approval diff failed for erc20");
		expect(result.approvals).toEqual([
			{
				standard: "erc20",
				token: TOKEN_A,
				owner: OWNER,
				spender: SPENDER_A,
				amount: 999n,
				scope: "token",
			},
		]);
	});

	test("read failure falls back to parsed approval, lowers confidence, and adds note", async () => {
		const values = new Map<string, ReadValue>();
		setRead(
			values,
			{
				address: NFT_A,
				functionName: "isApprovedForAll",
				args: [OWNER, SPENDER_A],
				blockNumber: BEFORE_BLOCK,
			},
			true,
		);
		setRead(
			values,
			{
				address: NFT_A,
				functionName: "isApprovedForAll",
				args: [OWNER, SPENDER_A],
				blockNumber: AFTER_BLOCK,
			},
			new Error("rpc timeout"),
		);

		const result = await buildApprovalDiffs(
			[
				{
					standard: "erc721",
					token: NFT_A,
					owner: OWNER,
					spender: SPENDER_A,
					scope: "all",
					approved: false,
					logIndex: 10,
				},
			],
			createMockClient(values),
			{ beforeBlock: BEFORE_BLOCK, afterBlock: AFTER_BLOCK },
		);

		expect(result.confidence).toBe("low");
		expect(result.approvals).toEqual([
			{
				standard: "erc721",
				token: NFT_A,
				owner: OWNER,
				spender: SPENDER_A,
				scope: "all",
				approved: false,
			},
		]);
		expect(result.notes).toHaveLength(1);
		expect(result.notes[0]).toContain("ApprovalForAll");
	});
});
