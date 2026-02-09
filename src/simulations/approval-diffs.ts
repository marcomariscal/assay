import type { Abi, Address } from "viem";
import { isAddress } from "viem";
import { PERMIT2_CANONICAL_ADDRESS } from "../permit2";
import type { ApprovalChange, ConfidenceLevel } from "../types";
import type { ParsedApproval } from "./logs";

export interface ApprovalDiffClient {
	readContract: (args: {
		address: Address;
		abi: Abi;
		functionName: string;
		args?: readonly unknown[];
		blockNumber?: bigint;
	}) => Promise<unknown>;
}

function requireAddress(value: string): Address {
	if (!isAddress(value)) {
		throw new Error(`Invalid address: ${value}`);
	}
	return value;
}

const PERMIT2_ADDRESS: Address = requireAddress(PERMIT2_CANONICAL_ADDRESS);

const ERC20_ALLOWANCE_ABI: Abi = [
	{
		type: "function",
		name: "allowance",
		stateMutability: "view",
		inputs: [
			{ name: "owner", type: "address" },
			{ name: "spender", type: "address" },
		],
		outputs: [{ name: "", type: "uint256" }],
	},
];

const ERC721_GET_APPROVED_ABI: Abi = [
	{
		type: "function",
		name: "getApproved",
		stateMutability: "view",
		inputs: [{ name: "tokenId", type: "uint256" }],
		outputs: [{ name: "", type: "address" }],
	},
];

const APPROVAL_FOR_ALL_ABI: Abi = [
	{
		type: "function",
		name: "isApprovedForAll",
		stateMutability: "view",
		inputs: [
			{ name: "owner", type: "address" },
			{ name: "operator", type: "address" },
		],
		outputs: [{ name: "", type: "bool" }],
	},
];

const PERMIT2_ALLOWANCE_ABI: Abi = [
	{
		type: "function",
		name: "allowance",
		stateMutability: "view",
		inputs: [
			{ name: "user", type: "address" },
			{ name: "token", type: "address" },
			{ name: "spender", type: "address" },
		],
		outputs: [
			{ name: "amount", type: "uint160" },
			{ name: "expiration", type: "uint48" },
			{ name: "nonce", type: "uint48" },
		],
	},
];

interface ApprovalSlot {
	standard: ParsedApproval["standard"];
	token: Address;
	owner: Address;
	scope: "token" | "all";
	spender?: Address;
	tokenId?: bigint;
	lastEvent: ParsedApproval;
}

export async function buildApprovalDiffs(
	approvals: ParsedApproval[],
	client: ApprovalDiffClient,
	options: { beforeBlock: bigint; afterBlock: bigint },
): Promise<{ approvals: ApprovalChange[]; confidence: ConfidenceLevel; notes: string[] }> {
	const slots = collectApprovalSlots(approvals);
	if (slots.length === 0) {
		return { approvals: [], confidence: "high", notes: [] };
	}

	let confidence: ConfidenceLevel = "high";
	const notes: string[] = [];

	const results = await Promise.all(
		slots.map(async (slot) => {
			try {
				const diff = await readApprovalSlotDiff(slot, client, options);
				return { slot, diff, error: null };
			} catch (error) {
				return { slot, diff: null, error };
			}
		}),
	);

	const changes: ApprovalChange[] = [];
	for (const entry of results) {
		if (entry.diff) {
			changes.push(entry.diff);
			continue;
		}

		if (entry.error) {
			confidence = "low";
			notes.push(formatSlotError(entry.slot, entry.error));
			const fallback = buildFallbackApproval(entry.slot);
			if (fallback) changes.push(fallback);
		}
	}

	return { approvals: changes, confidence, notes };
}

function collectApprovalSlots(approvals: ParsedApproval[]): ApprovalSlot[] {
	const byKey = new Map<string, ApprovalSlot>();
	for (const approval of approvals) {
		const key = slotKey(approval);
		const existing = byKey.get(key);
		if (!existing || approval.logIndex >= existing.lastEvent.logIndex) {
			const slot = buildSlot(approval);
			if (slot) {
				byKey.set(key, slot);
			}
		}
	}
	return [...byKey.values()];
}

function buildSlot(approval: ParsedApproval): ApprovalSlot | null {
	if (approval.standard === "erc20" || approval.standard === "permit2") {
		return {
			standard: approval.standard,
			token: approval.token,
			owner: approval.owner,
			spender: approval.spender,
			scope: "token",
			lastEvent: approval,
		};
	}

	if (approval.scope === "all") {
		const standard = approval.standard === "erc1155" ? "erc1155" : "erc721";
		return {
			standard,
			token: approval.token,
			owner: approval.owner,
			spender: approval.spender,
			scope: "all",
			lastEvent: approval,
		};
	}

	if (approval.standard === "erc721" && approval.tokenId !== undefined) {
		return {
			standard: "erc721",
			token: approval.token,
			owner: approval.owner,
			scope: "token",
			tokenId: approval.tokenId,
			lastEvent: approval,
		};
	}

	return null;
}

function slotKey(approval: ParsedApproval): string {
	const token = approval.token.toLowerCase();
	const owner = approval.owner.toLowerCase();
	if (approval.standard === "erc20" || approval.standard === "permit2") {
		return `${approval.standard}|${token}|${owner}|${approval.spender.toLowerCase()}|amount`;
	}
	if (approval.scope === "all") {
		return `${approval.standard}|${token}|${owner}|${approval.spender.toLowerCase()}|all`;
	}
	if (approval.standard === "erc721") {
		return `${approval.standard}|${token}|${owner}|${approval.tokenId?.toString() ?? ""}|tokenId`;
	}
	return `${approval.standard}|${token}|${owner}|unknown`;
}

async function readApprovalSlotDiff(
	slot: ApprovalSlot,
	client: ApprovalDiffClient,
	options: { beforeBlock: bigint; afterBlock: bigint },
): Promise<ApprovalChange | null> {
	if (slot.standard === "erc20") {
		if (!slot.spender) return null;
		const before = await readErc20Allowance(client, slot.token, slot.owner, slot.spender, {
			blockNumber: options.beforeBlock,
		});
		const after = await readErc20Allowance(client, slot.token, slot.owner, slot.spender, {
			blockNumber: options.afterBlock,
		});
		if (before === null || after === null) {
			throw new Error("ERC-20 allowance read failed");
		}
		if (before === after) return null;
		return {
			standard: "erc20",
			token: slot.token,
			owner: slot.owner,
			spender: slot.spender,
			previousAmount: before,
			amount: after,
			scope: "token",
		};
	}

	if (slot.standard === "permit2") {
		if (!slot.spender) return null;
		const before = await readPermit2AllowanceAmount(client, slot.owner, slot.token, slot.spender, {
			blockNumber: options.beforeBlock,
		});
		const after = await readPermit2AllowanceAmount(client, slot.owner, slot.token, slot.spender, {
			blockNumber: options.afterBlock,
		});
		if (before === null || after === null) {
			throw new Error("Permit2 allowance read failed");
		}
		if (before === after) return null;
		return {
			standard: "permit2",
			token: slot.token,
			owner: slot.owner,
			spender: slot.spender,
			previousAmount: before,
			amount: after,
			scope: "token",
		};
	}

	if (slot.scope === "all") {
		if (!slot.spender) return null;
		const before = await readApprovalForAll(client, slot.token, slot.owner, slot.spender, {
			blockNumber: options.beforeBlock,
		});
		const after = await readApprovalForAll(client, slot.token, slot.owner, slot.spender, {
			blockNumber: options.afterBlock,
		});
		if (before === null || after === null) {
			throw new Error("ApprovalForAll read failed");
		}
		if (before === after) return null;
		return {
			standard: slot.standard === "erc1155" ? "erc1155" : "erc721",
			token: slot.token,
			owner: slot.owner,
			spender: slot.spender,
			scope: "all",
			previousApproved: before,
			approved: after,
		};
	}

	if (slot.standard === "erc721" && slot.tokenId !== undefined) {
		const before = await readErc721Approved(client, slot.token, slot.tokenId, {
			blockNumber: options.beforeBlock,
		});
		const after = await readErc721Approved(client, slot.token, slot.tokenId, {
			blockNumber: options.afterBlock,
		});
		if (!before || !after) {
			throw new Error("ERC-721 approved address read failed");
		}
		if (before.toLowerCase() === after.toLowerCase()) return null;
		return {
			standard: "erc721",
			token: slot.token,
			owner: slot.owner,
			spender: after,
			tokenId: slot.tokenId,
			scope: "token",
			previousSpender: before,
		};
	}

	return null;
}

async function readErc20Allowance(
	client: ApprovalDiffClient,
	token: Address,
	owner: Address,
	spender: Address,
	options: { blockNumber: bigint },
): Promise<bigint | null> {
	try {
		const result = await client.readContract({
			address: token,
			abi: ERC20_ALLOWANCE_ABI,
			functionName: "allowance",
			args: [owner, spender],
			blockNumber: options.blockNumber,
		});
		return typeof result === "bigint" ? result : null;
	} catch {
		return null;
	}
}

async function readPermit2AllowanceAmount(
	client: ApprovalDiffClient,
	owner: Address,
	token: Address,
	spender: Address,
	options: { blockNumber: bigint },
): Promise<bigint | null> {
	try {
		const result = await client.readContract({
			address: PERMIT2_ADDRESS,
			abi: PERMIT2_ALLOWANCE_ABI,
			functionName: "allowance",
			args: [owner, token, spender],
			blockNumber: options.blockNumber,
		});
		if (!Array.isArray(result)) return null;
		const amount = result[0];
		return typeof amount === "bigint" ? amount : null;
	} catch {
		return null;
	}
}

async function readApprovalForAll(
	client: ApprovalDiffClient,
	token: Address,
	owner: Address,
	operator: Address,
	options: { blockNumber: bigint },
): Promise<boolean | null> {
	try {
		const result = await client.readContract({
			address: token,
			abi: APPROVAL_FOR_ALL_ABI,
			functionName: "isApprovedForAll",
			args: [owner, operator],
			blockNumber: options.blockNumber,
		});
		return typeof result === "boolean" ? result : null;
	} catch {
		return null;
	}
}

async function readErc721Approved(
	client: ApprovalDiffClient,
	token: Address,
	tokenId: bigint,
	options: { blockNumber: bigint },
): Promise<Address | null> {
	try {
		const result = await client.readContract({
			address: token,
			abi: ERC721_GET_APPROVED_ABI,
			functionName: "getApproved",
			args: [tokenId],
			blockNumber: options.blockNumber,
		});
		if (typeof result !== "string") return null;
		return isAddress(result) ? result : null;
	} catch {
		return null;
	}
}

function buildFallbackApproval(slot: ApprovalSlot): ApprovalChange | null {
	const approval = slot.lastEvent;
	if (slot.standard === "erc20" || slot.standard === "permit2") {
		if (!slot.spender) return null;
		return {
			standard: slot.standard,
			token: slot.token,
			owner: slot.owner,
			spender: slot.spender,
			amount: approval.amount,
			scope: "token",
		};
	}

	if (slot.scope === "all") {
		if (!slot.spender) return null;
		return {
			standard: slot.standard === "erc1155" ? "erc1155" : "erc721",
			token: slot.token,
			owner: slot.owner,
			spender: slot.spender,
			scope: "all",
			approved: approval.approved,
		};
	}

	if (slot.standard === "erc721" && slot.tokenId !== undefined) {
		return {
			standard: "erc721",
			token: slot.token,
			owner: slot.owner,
			spender: approval.spender,
			tokenId: slot.tokenId,
			scope: "token",
		};
	}

	return null;
}

function formatSlotError(slot: ApprovalSlot, error: unknown): string {
	const message = error instanceof Error ? error.message : "unknown";
	if (slot.standard === "erc20" || slot.standard === "permit2") {
		return `Approval diff failed for ${slot.standard} ${slot.token} ${slot.owner} -> ${slot.spender ?? "unknown"}: ${message}`;
	}
	if (slot.scope === "all") {
		return `Approval diff failed for ${slot.standard} ApprovalForAll ${slot.token} ${slot.owner} -> ${slot.spender ?? "unknown"}: ${message}`;
	}
	if (slot.standard === "erc721" && slot.tokenId !== undefined) {
		return `Approval diff failed for ERC-721 ${slot.token} #${slot.tokenId.toString()}: ${message}`;
	}
	return `Approval diff failed: ${message}`;
}
