import type { AnalyzeResponse, CalldataInput, ScanInput } from "../schema";
import { analyzeResponseSchema, scanInputSchema } from "../schema";

export interface ScanClientOptions {
	apiKey?: string;
	baseUrl?: string;
}

export class ScanError extends Error {
	status?: number;
	requestId?: string;

	constructor(message: string, status?: number, requestId?: string) {
		super(message);
		this.status = status;
		this.requestId = requestId;
	}
}

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_TIMEOUT_MS = 10_000;

export async function scan(
	input: ScanInput,
	options?: ScanClientOptions,
): Promise<AnalyzeResponse> {
	const validation = scanInputSchema.safeParse(input);
	if (!validation.success) {
		throw new ScanError("Invalid scan input");
	}
	return requestScan(input, options);
}

export async function scanAddress(
	address: string,
	chain?: string,
	options?: ScanClientOptions,
): Promise<AnalyzeResponse> {
	const validation = scanInputSchema.safeParse({ address });
	if (!validation.success) {
		throw new ScanError("Invalid address");
	}
	const body = chain ? { address, chain } : { address };
	return requestScan(body, options);
}

export async function scanCalldata(
	calldata: CalldataInput,
	options?: ScanClientOptions,
): Promise<AnalyzeResponse> {
	const validation = scanInputSchema.safeParse({ calldata });
	if (!validation.success) {
		throw new ScanError("Invalid calldata");
	}
	return requestScan({ calldata }, options);
}

async function requestScan(body: unknown, options?: ScanClientOptions): Promise<AnalyzeResponse> {
	const baseUrl = normalizeBaseUrl(options?.baseUrl ?? DEFAULT_BASE_URL);
	const headers: Record<string, string> = {
		"content-type": "application/json",
	};
	if (options?.apiKey) {
		headers.authorization = `Bearer ${options.apiKey}`;
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
	try {
		const response = await fetch(`${baseUrl}/v1/scan`, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
			signal: controller.signal,
		});

		const payload = await readJson(response);
		if (!response.ok) {
			throw buildScanError(payload, response.status);
		}

		const parsed = analyzeResponseSchema.safeParse(payload);
		if (!parsed.success) {
			throw new ScanError("Invalid scan response", response.status);
		}
		return parsed.data;
	} catch (error) {
		if (error instanceof ScanError) {
			throw error;
		}
		if (error instanceof Error && error.name === "AbortError") {
			throw new ScanError("Request timed out");
		}
		const message = error instanceof Error ? error.message : "Request failed";
		throw new ScanError(message);
	} finally {
		clearTimeout(timeoutId);
	}
}

function normalizeBaseUrl(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function readJson(response: Response): Promise<unknown> {
	const text = await response.text();
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

function buildScanError(payload: unknown, status: number): ScanError {
	if (isRecord(payload)) {
		const requestId = typeof payload.requestId === "string" ? payload.requestId : undefined;
		const messageValue = payload.error ?? payload.message;
		if (typeof messageValue === "string") {
			return new ScanError(messageValue, status, requestId);
		}
		if (requestId) {
			return new ScanError(`Request failed with status ${status}`, status, requestId);
		}
	}
	return new ScanError(`Request failed with status ${status}`, status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
