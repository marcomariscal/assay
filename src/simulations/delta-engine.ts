import type { Address } from "viem";
import type { AssetChange } from "../types";
import type { ParsedTransfer } from "./logs";

export interface WalletFastDeltaEngineResult {
	tokens: Address[];
	assetChanges: AssetChange[];
	notes: string[];
	confidence: "high" | "medium" | "low";
}

export function selectWalletFastErc20Tokens(options: {
	actor: Address;
	transfers: ParsedTransfer[];
	maxTokens?: number;
}): { tokens: Address[]; truncated: boolean } {
	const actor = options.actor.toLowerCase();
	const sorted = [...options.transfers].sort((a, b) => a.logIndex - b.logIndex);
	const seen = new Set<string>();
	const out: Address[] = [];
	for (const transfer of sorted) {
		if (transfer.standard !== "erc20") continue;
		if (transfer.from.toLowerCase() !== actor && transfer.to.toLowerCase() !== actor) continue;
		const key = transfer.token.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(transfer.token);
		if (options.maxTokens !== undefined && out.length >= options.maxTokens) {
			break;
		}
	}

	const truncated =
		options.maxTokens !== undefined &&
		out.length >= options.maxTokens &&
		sorted.some((transfer) => {
			if (transfer.standard !== "erc20") return false;
			if (transfer.from.toLowerCase() !== actor && transfer.to.toLowerCase() !== actor)
				return false;
			return !seen.has(transfer.token.toLowerCase());
		});

	return { tokens: out, truncated };
}

export function buildWalletFastErc20Changes(options: {
	actor: Address;
	transfers: ParsedTransfer[];
	tokens: Address[];
	before: Map<Address, bigint>;
	after: Map<Address, bigint>;
}): AssetChange[] {
	const actor = options.actor.toLowerCase();
	const transfers = [...options.transfers].sort((a, b) => a.logIndex - b.logIndex);

	const changes: AssetChange[] = [];
	for (const token of options.tokens) {
		const before = options.before.get(token) ?? null;
		const after = options.after.get(token) ?? null;
		if (before === null || after === null) continue;
		const diff = after - before;
		if (diff === 0n) continue;

		const counterparty = uniqueCounterparty({ transfers, actor, token });
		changes.push({
			assetType: "erc20",
			address: token,
			amount: diff < 0n ? -diff : diff,
			direction: diff < 0n ? "out" : "in",
			counterparty: counterparty ?? undefined,
		});
	}

	changes.sort((a, b) => {
		const aAddr = (a.address ?? "").toLowerCase();
		const bAddr = (b.address ?? "").toLowerCase();
		if (aAddr < bAddr) return -1;
		if (aAddr > bAddr) return 1;
		if (a.direction === b.direction) return 0;
		return a.direction === "out" ? -1 : 1;
	});

	return changes;
}

function uniqueCounterparty(options: {
	transfers: ParsedTransfer[];
	actor: string;
	token: Address;
}): Address | null {
	const token = options.token.toLowerCase();
	let counterparty: Address | null = null;
	let counterpartyKey: string | null = null;

	for (const transfer of options.transfers) {
		if (transfer.standard !== "erc20") continue;
		if (transfer.token.toLowerCase() !== token) continue;

		if (transfer.from.toLowerCase() === options.actor) {
			const other = transfer.to;
			const otherKey = other.toLowerCase();
			if (counterpartyKey && counterpartyKey !== otherKey) {
				return null;
			}
			counterparty = other;
			counterpartyKey = otherKey;
			continue;
		}

		if (transfer.to.toLowerCase() === options.actor) {
			const other = transfer.from;
			const otherKey = other.toLowerCase();
			if (counterpartyKey && counterpartyKey !== otherKey) {
				return null;
			}
			counterparty = other;
			counterpartyKey = otherKey;
		}
	}

	return counterparty;
}
