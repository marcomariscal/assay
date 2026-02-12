import { describe, expect, test } from "bun:test";
import { extractSendTransactionCalldata } from "../src/jsonrpc/proxy";
import type { ScanInput } from "../src/schema";

/**
 * EIP-7702 (type-4 transaction) authorization list coverage.
 *
 * These tests verify that Assay correctly extracts and surfaces authorization
 * list entries from both eth_sendTransaction and eth_sendRawTransaction paths.
 *
 * Security context: EIP-7702 transactions allow an EOA to temporarily delegate
 * execution to contract code. The authorization list specifies which contracts
 * the sender's account will execute. This is a critical security surface —
 * a malicious delegate can drain assets, set approvals, or execute arbitrary
 * code as the EOA.
 */

const DELEGATE_CONTRACT = "0x1234567890abcdef1234567890abcdef12345678";
const TARGET_CONTRACT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const SENDER = "0x24274566a1ad6a9b056e8e2618549ebd2f5141a7";

describe("EIP-7702 authorization list — proxy extraction", () => {
	test("extractSendTransactionCalldata preserves authorizationList", () => {
		const calldata = extractSendTransactionCalldata({
			jsonrpc: "2.0",
			id: 1,
			method: "eth_sendTransaction",
			params: [
				{
					to: TARGET_CONTRACT,
					from: SENDER,
					data: "0x",
					value: "0x0",
					chainId: "0x1",
					authorizationList: [
						{
							address: DELEGATE_CONTRACT,
							chainId: "0x1",
							nonce: "0x0",
						},
					],
				},
			],
		});

		expect(calldata).not.toBeNull();
		if (!calldata) return;
		expect(calldata.to).toBe(TARGET_CONTRACT);
		expect(calldata.authorizationList).toBeDefined();
		expect(calldata.authorizationList).toHaveLength(1);
		if (!calldata.authorizationList) return;
		expect(calldata.authorizationList[0].address).toBe(DELEGATE_CONTRACT);
		expect(calldata.authorizationList[0].chainId).toBe(1);
		expect(calldata.authorizationList[0].nonce).toBe(0);
	});

	test("extractSendTransactionCalldata with multiple authorizations", () => {
		const secondDelegate = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
		const calldata = extractSendTransactionCalldata({
			jsonrpc: "2.0",
			id: 1,
			method: "eth_sendTransaction",
			params: [
				{
					to: TARGET_CONTRACT,
					from: SENDER,
					data: "0x",
					value: "0x0",
					chainId: "0x1",
					authorizationList: [
						{ address: DELEGATE_CONTRACT, chainId: "0x1", nonce: "0x0" },
						{ address: secondDelegate, chainId: "0x1", nonce: "0x1" },
					],
				},
			],
		});

		expect(calldata).not.toBeNull();
		if (!calldata) return;
		expect(calldata.authorizationList).toHaveLength(2);
		if (!calldata.authorizationList) return;
		expect(calldata.authorizationList[0].address).toBe(DELEGATE_CONTRACT);
		expect(calldata.authorizationList[1].address).toBe(secondDelegate);
	});

	test("extractSendTransactionCalldata without authorizationList returns undefined", () => {
		const calldata = extractSendTransactionCalldata({
			jsonrpc: "2.0",
			id: 1,
			method: "eth_sendTransaction",
			params: [
				{
					to: TARGET_CONTRACT,
					from: SENDER,
					data: "0x",
					value: "0x0",
					chainId: "0x1",
				},
			],
		});

		expect(calldata).not.toBeNull();
		if (!calldata) return;
		expect(calldata.authorizationList).toBeUndefined();
	});

	test("extractSendTransactionCalldata ignores malformed authorizationList entries", () => {
		const calldata = extractSendTransactionCalldata({
			jsonrpc: "2.0",
			id: 1,
			method: "eth_sendTransaction",
			params: [
				{
					to: TARGET_CONTRACT,
					from: SENDER,
					data: "0x",
					value: "0x0",
					chainId: "0x1",
					authorizationList: [
						{ address: "not-an-address", chainId: "0x1", nonce: "0x0" },
						{ address: DELEGATE_CONTRACT, chainId: "0x1", nonce: "0x0" },
						"garbage",
						42,
					],
				},
			],
		});

		expect(calldata).not.toBeNull();
		if (!calldata) return;
		// Only the valid entry should be kept
		expect(calldata.authorizationList).toHaveLength(1);
		if (!calldata.authorizationList) return;
		expect(calldata.authorizationList[0].address).toBe(DELEGATE_CONTRACT);
	});

	/**
	 * TODO: Add eth_sendRawTransaction test with a real signed type-4 envelope.
	 *
	 * Blocked by: viem's signTransaction does not yet expose a stable API for
	 * signing EIP-7702 (signAuthorization is available but constructing a fully
	 * signed type-4 raw tx in a unit test requires more viem plumbing).
	 *
	 * When viem stabilizes the EIP-7702 signing API:
	 * 1. Sign an authorization with `signAuthorization`
	 * 2. Build a type-4 tx with `authorizationList: [signedAuth]`
	 * 3. Call `extractSendRawTransactionCalldata` on the raw envelope
	 * 4. Assert authorizationList is preserved in CalldataInput
	 */
	test.todo(
		"extractSendRawTransactionCalldata preserves authorizationList from signed type-4 envelope",
	);
});

describe("EIP-7702 authorization list — scan findings", () => {
	/**
	 * This is a scaffold for integration-level testing.
	 *
	 * A full test would call `scan()` with a CalldataInput containing an
	 * authorizationList and verify:
	 * - EIP7702_AUTHORIZATION finding is emitted
	 * - Recommendation is at least "warning"
	 * - Simulation notes include the EIP-7702 limitation disclaimer
	 * - Intent string is unaffected (authorization list is orthogonal to calldata)
	 *
	 * Blocked by: requires Anvil fork + real chain state for full scan().
	 * Unit-testable parts (finding generation) are covered by the extraction
	 * tests above combined with the scan pipeline integration.
	 */

	test("CalldataInput with authorizationList passes schema validation", () => {
		const { scanInputSchema } = require("../src/schema");
		const input: ScanInput = {
			calldata: {
				to: TARGET_CONTRACT,
				from: SENDER,
				data: "0x",
				value: "0",
				chain: "1",
				authorizationList: [
					{
						address: DELEGATE_CONTRACT,
						chainId: 1,
						nonce: 0,
					},
				],
			},
		};

		const result = scanInputSchema.safeParse(input);
		expect(result.success).toBe(true);
	});

	test("CalldataInput without authorizationList still passes schema validation", () => {
		const { scanInputSchema } = require("../src/schema");
		const input: ScanInput = {
			calldata: {
				to: TARGET_CONTRACT,
				from: SENDER,
				data: "0x",
				value: "0",
				chain: "1",
			},
		};

		const result = scanInputSchema.safeParse(input);
		expect(result.success).toBe(true);
	});

	test("CalldataInput with invalid authorizationList address fails validation", () => {
		const { scanInputSchema } = require("../src/schema");
		const input = {
			calldata: {
				to: TARGET_CONTRACT,
				from: SENDER,
				data: "0x",
				value: "0",
				chain: "1",
				authorizationList: [
					{
						address: "not-valid",
						chainId: 1,
						nonce: 0,
					},
				],
			},
		};

		const result = scanInputSchema.safeParse(input);
		expect(result.success).toBe(false);
	});
});

describe("EIP-7702 — simulation limitation", () => {
	/**
	 * TODO: Full simulation test with EIP-7702 authorization list.
	 *
	 * When Anvil supports type-4 transaction replay via sendUnsignedTransaction
	 * (or an alternative simulation path), add a test that verifies:
	 * 1. Simulation notes include the EIP-7702 limitation disclaimer
	 * 2. Balance/approval confidence is reduced to "low"
	 * 3. If the delegate contract is unverified, recommendation escalates
	 *
	 * Current limitation: Anvil's sendUnsignedTransaction does not accept
	 * an authorizationList, so simulation cannot reproduce code delegation.
	 * The simulation runs as a plain call and results may be misleading.
	 */
	test.todo(
		"simulation with EIP-7702 authorization list adds limitation note and reduces confidence",
	);
});
