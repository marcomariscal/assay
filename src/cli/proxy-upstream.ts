import { resolveUserConfigPathForWrite } from "../config";
import { resolveScanChain } from "../scan";
import type { Chain, Config } from "../types";

export const RUGSCAN_UPSTREAM_ENV = "RUGSCAN_UPSTREAM";

export type UpstreamSource = "cli" | "env" | "config";

export interface UpstreamResolution {
	upstreamUrl: string;
	source: UpstreamSource;
	chain: Chain | null;
}

function normalizeNonEmptyString(value: string | undefined): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function resolveChainForRpcUrls(chainArg: string | undefined): Chain | null {
	return resolveScanChain(chainArg);
}

export function resolveProxyUpstreamUrl(options: {
	cliUpstream: string | undefined;
	chainArg: string | undefined;
	config: Config;
	envUpstream?: string | undefined;
}): UpstreamResolution | null {
	const chain = resolveChainForRpcUrls(options.chainArg);

	const cliUpstream = normalizeNonEmptyString(options.cliUpstream);
	if (cliUpstream) {
		return { upstreamUrl: cliUpstream, source: "cli", chain };
	}

	const envUpstream = normalizeNonEmptyString(options.envUpstream);
	if (envUpstream) {
		return { upstreamUrl: envUpstream, source: "env", chain };
	}

	const configUpstream = chain
		? normalizeNonEmptyString(options.config.rpcUrls?.[chain])
		: undefined;
	if (configUpstream) {
		return { upstreamUrl: configUpstream, source: "config", chain };
	}

	return null;
}

export function formatMissingUpstreamError(options: { chainArg: string | undefined }): string {
	const chain = resolveChainForRpcUrls(options.chainArg);
	const chainKey = chain ?? "<chain>";
	const configPath = resolveUserConfigPathForWrite();

	return [
		"Error: Missing upstream RPC URL.",
		"",
		"Set it using one of:",
		"  1) CLI flag:",
		"     rugscan proxy --upstream https://your-rpc.example",
		"  2) Environment variable:",
		`     export ${RUGSCAN_UPSTREAM_ENV}=https://your-rpc.example`,
		"  3) Config file:",
		`     ${configPath}`,
		`     { "rpcUrls": { "${chainKey}": "https://your-rpc.example" } }`,
	].join("\n");
}
