#!/usr/bin/env bun
import { analyze } from "../analyzer";
import type { Chain, Config } from "../types";
import { createProgressRenderer, renderError, renderHeading, renderResultBox } from "./ui";

const VALID_CHAINS: Chain[] = ["ethereum", "base", "arbitrum", "optimism", "polygon"];

function printUsage() {
	console.log(`
rugscan - Pre-transaction security analysis for EVM contracts

Usage:
  rugscan analyze <address> [--chain <chain>]

Options:
  --chain, -c    Chain to analyze on (default: ethereum)
                 Valid: ethereum, base, arbitrum, optimism, polygon

Environment:
  ETHERSCAN_API_KEY       Etherscan API key (enables full analysis)
  BASESCAN_API_KEY        BaseScan API key
  ARBISCAN_API_KEY        Arbiscan API key
  OPTIMISM_API_KEY        Optimistic Etherscan API key
  POLYGONSCAN_API_KEY     PolygonScan API key

Examples:
  rugscan analyze 0x1234...
  rugscan analyze 0x1234... --chain base
`);
}

function getConfig(): Config {
	return {
		etherscanKeys: {
			ethereum: process.env.ETHERSCAN_API_KEY,
			base: process.env.BASESCAN_API_KEY,
			arbitrum: process.env.ARBISCAN_API_KEY,
			optimism: process.env.OPTIMISM_API_KEY,
			polygon: process.env.POLYGONSCAN_API_KEY,
		},
	};
}

async function main() {
	const args = process.argv.slice(2);

	if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
		printUsage();
		process.exit(0);
	}

	if (args[0] !== "analyze") {
		console.error(`Unknown command: ${args[0]}`);
		printUsage();
		process.exit(1);
	}

	// Parse arguments
	const address = args[1];
	if (!address || !address.startsWith("0x")) {
		console.error(renderError("Error: Please provide a valid contract address"));
		process.exit(1);
	}

	let chain: Chain = "ethereum";
	const chainIndex = args.findIndex((a) => a === "--chain" || a === "-c");
	if (chainIndex !== -1 && args[chainIndex + 1]) {
		const requestedChain = args[chainIndex + 1] as Chain;
		if (!VALID_CHAINS.includes(requestedChain)) {
			console.error(`Error: Invalid chain "${requestedChain}"`);
			console.error(`Valid chains: ${VALID_CHAINS.join(", ")}`);
			process.exit(1);
		}
		chain = requestedChain;
	}

	const config = getConfig();

	console.log(renderHeading(`Analyzing ${address} on ${chain}...`));
	console.log("");

	try {
		const renderProgress = createProgressRenderer(process.stdout.isTTY);
		const result = await analyze(address, chain, config, renderProgress);

		console.log("");
		console.log(renderResultBox(result));
		console.log("");

		// Exit code based on recommendation
		if (result.recommendation === "danger") {
			process.exit(2);
		}
		if (result.recommendation === "warning" || result.recommendation === "caution") {
			process.exit(1);
		}
	} catch (error) {
		console.error(renderError("Analysis failed:"));
		console.error(error);
		process.exit(1);
	}
}

main();
