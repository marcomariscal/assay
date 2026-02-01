import { getChainConfig } from "../chains";
import type { Chain, VerificationResult } from "../types";

const SOURCIFY_API = "https://sourcify.dev/server";

interface SourcifyFile {
	name: string;
	path: string;
	content: string;
}

interface SourcifyAnyResponse {
	status: "full" | "partial";
	files: SourcifyFile[];
}

export async function checkVerification(
	address: string,
	chain: Chain,
): Promise<VerificationResult> {
	const chainConfig = getChainConfig(chain);
	const chainId = chainConfig.sourcifyChainId;

	// Use the /files/any/ endpoint which returns full or partial match
	const url = `${SOURCIFY_API}/files/any/${chainId}/${address}`;

	try {
		const response = await fetch(url);

		if (!response.ok) {
			return { verified: false };
		}

		const data: SourcifyAnyResponse = await response.json();
		const files = data.files;

		if (!files || files.length === 0) {
			return { verified: false };
		}

		// Find metadata.json for contract name
		const metadata = files.find((f) => f.name === "metadata.json");
		let name: string | undefined;

		if (metadata) {
			try {
				const meta = JSON.parse(metadata.content);
				const output = meta.output?.devdoc?.title || meta.settings?.compilationTarget;
				if (typeof output === "object") {
					name = Object.values(output)[0] as string;
				} else if (typeof output === "string") {
					name = output;
				}
			} catch {
				// Ignore parse errors
			}
		}

		// Find main source file
		const sourceFile = files.find(
			(f) => f.name.endsWith(".sol") && !f.path.includes("node_modules"),
		);

		return {
			verified: true,
			name,
			source: sourceFile?.content,
		};
	} catch {
		return { verified: false };
	}
}
