#!/usr/bin/env node
import {
  analyzeContract,
  formatAnalysis
} from "../chunk-OFKWHJGT.js";

// src/cli/index.ts
import { program } from "commander";
var VALID_CHAINS = [
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
  "polygon"
];
program.name("rugscan").description("Pre-transaction security analysis for EVM").version("0.1.0");
program.command("analyze").description("Analyze a contract for risk factors").argument("<address>", "Contract address to analyze").option("-c, --chain <chain>", "Chain to analyze on", "ethereum").option("--json", "Output as JSON").action(async (address, options) => {
  const chain = options.chain.toLowerCase();
  if (!VALID_CHAINS.includes(chain)) {
    console.error(
      `Invalid chain: ${chain}. Valid options: ${VALID_CHAINS.join(", ")}`
    );
    process.exit(1);
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    console.error("Invalid address format");
    process.exit(1);
  }
  console.log(`Analyzing ${address} on ${chain}...
`);
  try {
    const analysis = await analyzeContract(address, { chain });
    if (options.json) {
      console.log(JSON.stringify(analysis, null, 2));
    } else {
      console.log(formatAnalysis(analysis));
    }
    if (analysis.riskLevel === "high" || analysis.riskLevel === "critical") {
      process.exit(1);
    }
  } catch (error) {
    console.error("Analysis failed:", error);
    process.exit(1);
  }
});
program.command("check").description("Quick check if a contract is verified").argument("<address>", "Contract address").option("-c, --chain <chain>", "Chain", "ethereum").action(async (address, options) => {
  const chain = options.chain.toLowerCase();
  try {
    const analysis = await analyzeContract(address, { chain });
    const icon = analysis.verified ? "\u2705" : "\u274C";
    console.log(
      `${icon} ${address} is ${analysis.verified ? "verified" : "NOT verified"} on ${chain}`
    );
    process.exit(analysis.verified ? 0 : 1);
  } catch (error) {
    console.error("Check failed:", error);
    process.exit(1);
  }
});
program.parse();
//# sourceMappingURL=index.js.map