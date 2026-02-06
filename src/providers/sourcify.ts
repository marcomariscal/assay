import type { Abi } from "viem";
import { getChainConfig } from "../chains";
import { fetchWithTimeout } from "../http";
import type { Chain, VerificationResult } from "../types";

const SOURCIFY_API = "https://sourcify.dev/server";
const SOURCIFY_CACHE = new Map<string, Promise<SourcifyResult> | SourcifyResult>();

// Sourcify response is treated as untyped JSON; we validate fields at runtime.

interface SourcifyResult extends VerificationResult {
	abi?: Abi;
}

export async function checkVerification(
	address: string,
	chain: Chain,
): Promise<VerificationResult> {
	const result = await getSourcifyResult(address, chain);
	return {
		verified: result.verified,
		verificationKnown: result.verificationKnown,
		name: result.name,
		source: result.source,
		abi: result.abi,
	};
}

export async function getABI(address: string, chain: Chain): Promise<Abi | null> {
	const result = await getSourcifyResult(address, chain);
	if (!result.verified || !result.abi) return null;
	return result.abi;
}

async function getSourcifyResult(address: string, chain: Chain): Promise<SourcifyResult> {
	const chainId = getChainConfig(chain).sourcifyChainId;
	const key = `${chainId}:${address.toLowerCase()}`;
	const cached = SOURCIFY_CACHE.get(key);
	if (cached) {
		if (cached instanceof Promise) {
			return cached;
		}
		return cached;
	}

	const fetchPromise = fetchSourcifyResult(address, chainId);
	SOURCIFY_CACHE.set(key, fetchPromise);

	try {
		const resolved = await fetchPromise;
		// Do not cache unknown results: transient network/provider issues should be retryable.
		if (resolved.verificationKnown) {
			SOURCIFY_CACHE.set(key, resolved);
		} else {
			SOURCIFY_CACHE.delete(key);
		}
		return resolved;
	} catch (error) {
		SOURCIFY_CACHE.delete(key);
		throw error;
	}
}

async function fetchSourcifyResult(address: string, chainId: number): Promise<SourcifyResult> {
	const url = `${SOURCIFY_API}/files/any/${chainId}/${address}`;

	let response: Response;
	try {
		response = await fetchWithTimeout(url);
	} catch {
		return { verified: false, verificationKnown: false };
	}

	if (!response.ok) {
		// 404 = contract not present on Sourcify (treat as truly unverified).
		if (response.status === 404) {
			return { verified: false, verificationKnown: true };
		}
		// Other non-2xx can be transient/network/provider errors.
		return { verified: false, verificationKnown: false };
	}

	let data: unknown;
	try {
		data = await response.json();
	} catch {
		return { verified: false, verificationKnown: false };
	}

	if (!isRecord(data)) {
		return { verified: false, verificationKnown: false };
	}

	const filesRaw = data.files;
	const files = Array.isArray(filesRaw) ? filesRaw : null;
	if (!files) {
		return { verified: false, verificationKnown: false };
	}

	if (files.length === 0) {
		return { verified: false, verificationKnown: true };
	}

	const metadata = files.find((file: unknown) => {
		if (!isRecord(file)) return false;
		return file.name === "metadata.json";
	});
	const parsedMetadata =
		isRecord(metadata) && isNonEmptyString(metadata.content)
			? parseMetadata(metadata.content)
			: undefined;

	const sourceFile = files.find((file: unknown) => {
		if (!isRecord(file)) return false;
		if (!isNonEmptyString(file.name) || !isNonEmptyString(file.path)) return false;
		return file.name.endsWith(".sol") && !file.path.includes("node_modules");
	});

	return {
		verified: true,
		verificationKnown: true,
		name: parsedMetadata?.name,
		source:
			isRecord(sourceFile) && isNonEmptyString(sourceFile.content) ? sourceFile.content : undefined,
		abi: parsedMetadata?.abi,
	};
}

function parseMetadata(content: string): { name?: string; abi?: Abi } | undefined {
	try {
		const parsed = JSON.parse(content);
		const name = extractContractName(parsed);
		const abi = extractAbi(parsed);
		return { name, abi };
	} catch {
		return undefined;
	}
}

function extractContractName(value: unknown): string | undefined {
	if (!isRecord(value)) return undefined;
	const output = value.output;
	if (isRecord(output)) {
		const devdoc = output.devdoc;
		if (isRecord(devdoc)) {
			const title = devdoc.title;
			if (isNonEmptyString(title)) {
				return title;
			}
		}
	}
	const settings = value.settings;
	if (isRecord(settings)) {
		const compilationTarget = settings.compilationTarget;
		const targetName = extractCompilationTarget(compilationTarget);
		if (targetName) return targetName;
	}
	return undefined;
}

function extractCompilationTarget(value: unknown): string | undefined {
	if (!isRecord(value)) return undefined;
	for (const entry of Object.values(value)) {
		if (isNonEmptyString(entry)) return entry;
	}
	return undefined;
}

function extractAbi(value: unknown): Abi | undefined {
	if (!isRecord(value)) return undefined;
	const output = value.output;
	if (!isRecord(output)) return undefined;
	const abi = output.abi;
	if (isAbi(abi)) return abi;
	return undefined;
}

function isAbi(value: unknown): value is Abi {
	if (!Array.isArray(value)) return false;
	return value.every(isAbiItem);
}

function isAbiItem(value: unknown): value is { type: string } {
	return isRecord(value) && typeof value.type === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}
