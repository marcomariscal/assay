import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const DEFAULT_TELEMETRY_DIR = path.join(os.homedir(), ".config", "assay", "telemetry");
const DEFAULT_SALT_PATH = path.join(DEFAULT_TELEMETRY_DIR, "salt");

function normalize(value: string): string {
	return value.trim().toLowerCase();
}

function parsePositiveBigInt(value: string): bigint | null {
	const normalized = value.trim();
	if (normalized.length === 0) return null;
	try {
		if (normalized.startsWith("0x") || normalized.startsWith("0X")) {
			return BigInt(normalized);
		}
		if (/^\d+$/.test(normalized)) {
			return BigInt(normalized);
		}
		return null;
	} catch {
		return null;
	}
}

function selectorFromCalldata(data: string): string {
	const normalized = normalize(data);
	if (!normalized.startsWith("0x")) return "none";
	if (normalized.length < 10) return "none";
	return normalized.slice(0, 10);
}

function valueBucket(value: string | undefined): string {
	if (!value) return "unknown";
	const parsed = parsePositiveBigInt(value);
	if (parsed === null) return "unknown";
	if (parsed === 0n) return "zero";
	if (parsed < 1_000_000_000_000_000n) return "dust";
	if (parsed < 1_000_000_000_000_000_000n) return "small";
	return "large";
}

export function hashWithSalt(value: string, salt: string): string {
	return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

export function hashAddress(address: string | undefined, salt: string): string | null {
	if (!address) return null;
	return hashWithSalt(normalize(address), salt);
}

export function buildTransactionFingerprint(options: {
	chain: string;
	to?: string;
	data?: string;
	value?: string;
	salt: string;
}): string | null {
	if (!options.to) return null;
	const normalized = [
		normalize(options.chain),
		normalize(options.to),
		selectorFromCalldata(options.data ?? "0x"),
		valueBucket(options.value),
	].join("|");
	return hashWithSalt(normalized, options.salt);
}

export function buildActionFingerprint(options: {
	chain: string;
	to?: string;
	data?: string;
	salt: string;
}): string | null {
	if (!options.to) return null;
	const normalized = [
		normalize(options.chain),
		normalize(options.to),
		selectorFromCalldata(options.data ?? "0x"),
	].join("|");
	return hashWithSalt(normalized, options.salt);
}

export async function resolveTelemetrySalt(options?: {
	env?: NodeJS.ProcessEnv;
	saltPath?: string;
}): Promise<string> {
	const env = options?.env ?? process.env;
	const envSalt = env.ASSAY_TELEMETRY_SALT;
	if (typeof envSalt === "string" && envSalt.trim().length > 0) {
		return envSalt.trim();
	}

	const saltPath = options?.saltPath ?? DEFAULT_SALT_PATH;
	try {
		const existing = (await readFile(saltPath, "utf-8")).trim();
		if (existing.length > 0) {
			return existing;
		}
	} catch {
		// Continue to create a new salt.
	}

	try {
		await mkdir(path.dirname(saltPath), { recursive: true });
		const generated = randomBytes(32).toString("hex");
		await writeFile(saltPath, `${generated}\n`, { mode: 0o600 });
		return generated;
	} catch {
		// Last-resort fallback keeps telemetry non-blocking.
		return randomBytes(32).toString("hex");
	}
}
