import { z } from "zod";
import type { Recommendation as BaseRecommendation } from "./types";

export type Recommendation = BaseRecommendation;

export interface ScanFinding {
	code: string;
	severity: Recommendation;
	message: string;
	details?: Record<string, unknown>;
	refs?: string[];
}

export interface ContractInfo {
	address: string;
	chain?: string;
	isContract?: boolean;
	name?: string;
	symbol?: string;
	isProxy?: boolean;
	implementation?: string;
	verifiedSource?: boolean;
	tags?: string[];
}

export interface CalldataInput {
	to: string;
	data: string;
	value?: string;
	chain?: string;
}

export interface ScanInput {
	address?: string;
	calldata?: CalldataInput;
}

export interface ScanResult {
	input: ScanInput;
	recommendation: Recommendation;
	confidence: number;
	findings: ScanFinding[];
	contract?: ContractInfo;
}

export interface AnalyzeResponse {
	requestId: string;
	scan: ScanResult;
}

const recommendationSchema = z.enum(["ok", "caution", "warning", "danger"]);

const addressSchema = z.string().refine((value) => isAddress(value), {
	message: "Invalid address",
});

const hexDataSchema = z.string().refine((value) => isHexString(value), {
	message: "Invalid hex data",
});

const chainSchema = z.string().min(1);

const calldataInputSchema = z
	.object({
		to: addressSchema,
		data: hexDataSchema,
		value: z.string().refine((value) => isNumericString(value), {
			message: "Invalid value",
		}).optional(),
		chain: chainSchema.optional(),
	})
	.strict();

export const scanInputSchema = z
	.object({
		address: addressSchema.optional(),
		calldata: calldataInputSchema.optional(),
	})
	.strict()
	.refine((value) => hasSingleInput(value.address, value.calldata), {
		message: "Provide either address or calldata",
	});

export const scanRequestSchema = scanInputSchema.extend({
	chain: chainSchema.optional(),
});

export const scanFindingSchema = z
	.object({
		code: z.string().min(1),
		severity: recommendationSchema,
		message: z.string().min(1),
		details: z.record(z.string(), z.unknown()).optional(),
		refs: z.array(z.string()).optional(),
	})
	.strict();

export const contractInfoSchema = z
	.object({
		address: addressSchema,
		chain: chainSchema.optional(),
		isContract: z.boolean().optional(),
		name: z.string().optional(),
		symbol: z.string().optional(),
		isProxy: z.boolean().optional(),
		implementation: addressSchema.optional(),
		verifiedSource: z.boolean().optional(),
		tags: z.array(z.string()).optional(),
	})
	.strict();

export const scanResultSchema = z
	.object({
		input: scanInputSchema,
		recommendation: recommendationSchema,
		confidence: z.number().min(0).max(1),
		findings: z.array(scanFindingSchema),
		contract: contractInfoSchema.optional(),
	})
	.strict();

export const analyzeResponseSchema = z
	.object({
		requestId: z.string().uuid(),
		scan: scanResultSchema,
	})
	.strict();

export function parseScanInput(value: unknown): ScanInput {
	return scanInputSchema.parse(value);
}

export function parseScanRequest(value: unknown): { input: ScanInput; chain?: string } {
	const parsed = scanRequestSchema.parse(value);
	return { input: { address: parsed.address, calldata: parsed.calldata }, chain: parsed.chain };
}

export function parseAnalyzeResponse(value: unknown): AnalyzeResponse {
	return analyzeResponseSchema.parse(value);
}

function hasSingleInput(address?: string, calldata?: CalldataInput): boolean {
	const count = (address ? 1 : 0) + (calldata ? 1 : 0);
	return count === 1;
}

function isAddress(value: string): boolean {
	return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isHexString(value: string): boolean {
	return /^0x[0-9a-fA-F]*$/.test(value);
}

function isNumericString(value: string): boolean {
	if (value.startsWith("0x")) {
		return isHexString(value);
	}
	return /^[0-9]+$/.test(value);
}
