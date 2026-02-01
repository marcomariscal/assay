import { describe, expect, test } from "bun:test";
import { analyze } from "../src/analyzer";

/**
 * rugscan analyzer tests
 * 
 * These tests verify real-world contracts produce expected findings.
 * They hit live APIs (Sourcify, GoPlus) so results are authentic.
 */

describe("analyzer", () => {
  describe("safe tokens", () => {
    test("UNI token → OK (verified, no red flags)", async () => {
      const result = await analyze(
        "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        "ethereum"
      );

      expect(result.contract.verified).toBe(true);
      expect(result.contract.name).toBe("Uni");
      expect(result.recommendation).toBe("ok");
      expect(result.findings.some(f => f.code === "VERIFIED")).toBe(true);
    });

    test("WETH on Base → OK (verified, no red flags)", async () => {
      const result = await analyze(
        "0x4200000000000000000000000000000000000006",
        "base"
      );

      expect(result.contract.verified).toBe(true);
      expect(result.contract.name).toBe("WETH9");
      expect(result.recommendation).toBe("ok");
    });
  });

  describe("tokens with centralization risks", () => {
    test("USDT → DANGER (mintable, blacklist, owner can drain)", async () => {
      const result = await analyze(
        "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "ethereum"
      );

      expect(result.contract.verified).toBe(true);
      expect(result.contract.name).toBe("TetherToken");
      expect(result.recommendation).toBe("danger");
      
      // GoPlus should flag these
      expect(result.findings.some(f => f.code === "HIDDEN_MINT")).toBe(true);
      expect(result.findings.some(f => f.code === "BLACKLIST")).toBe(true);
      expect(result.findings.some(f => f.code === "OWNER_DRAIN")).toBe(true);
    });
  });

  describe("proxy contracts", () => {
    test("USDC (Ethereum) → CAUTION (upgradeable proxy)", async () => {
      const result = await analyze(
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "ethereum"
      );

      expect(result.contract.verified).toBe(true);
      expect(result.contract.is_proxy).toBe(true);
      expect(result.contract.implementation).toBeDefined();
      expect(result.recommendation).toBe("caution");
      expect(result.findings.some(f => f.code === "UPGRADEABLE")).toBe(true);
    });

    test("USDC (Base) → CAUTION (upgradeable proxy)", async () => {
      const result = await analyze(
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "base"
      );

      expect(result.contract.verified).toBe(true);
      expect(result.contract.is_proxy).toBe(true);
      expect(result.recommendation).toBe("caution");
    });
  });

  describe("non-contracts", () => {
    test("EOA address → warning", async () => {
      // Random EOA with no bytecode (not a smart wallet)
      const result = await analyze(
        "0x0000000000000000000000000000000000000001",
        "ethereum"
      );

      expect(result.contract.verified).toBe(false);
      expect(result.recommendation).toBe("caution");
      expect(result.findings.some(f => 
        f.code === "LOW_ACTIVITY" && f.message.includes("not a contract")
      )).toBe(true);
    });

    test("dead address → warning", async () => {
      const result = await analyze(
        "0x000000000000000000000000000000000000dEaD",
        "ethereum"
      );

      expect(result.contract.verified).toBe(false);
      expect(result.findings.some(f => f.message.includes("not a contract"))).toBe(true);
    });
  });

  describe("confidence levels", () => {
    test("verified contract without etherscan key → MEDIUM confidence", async () => {
      const result = await analyze(
        "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        "ethereum"
        // no config = no etherscan key
      );

      expect(result.confidence.level).toBe("medium");
      expect(result.confidence.reasons).toContain("no etherscan key - limited data");
    });
  });
});
