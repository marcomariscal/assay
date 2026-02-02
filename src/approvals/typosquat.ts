import type { KnownSpender } from "./known-spenders";

const PREFIX_LENGTH = 4;
const SUFFIX_LENGTH = 4;
const MAX_DISTANCE = 2;

export interface TyposquatMatch {
	match: KnownSpender;
	distance: number;
}

export function isPossibleTyposquat(candidate: string, knownSpenders: KnownSpender[]): TyposquatMatch | null {
	const normalizedCandidate = normalizeAddress(candidate);
	const candidateBody = stripHexPrefix(normalizedCandidate);
	let best: TyposquatMatch | null = null;

	for (const known of knownSpenders) {
		const normalizedKnown = normalizeAddress(known.address);
		if (normalizedKnown === normalizedCandidate) {
			continue;
		}
		const knownBody = stripHexPrefix(normalizedKnown);
		if (candidateBody.length !== knownBody.length) {
			continue;
		}
		if (!prefixSuffixMatch(candidateBody, knownBody)) {
			continue;
		}
		const distance = levenshtein(candidateBody, knownBody);
		if (distance > MAX_DISTANCE) {
			continue;
		}
		if (!best || distance < best.distance) {
			best = { match: known, distance };
		}
	}

	return best;
}

export function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	const prev = new Array<number>(b.length + 1);
	const curr = new Array<number>(b.length + 1);

	for (let j = 0; j <= b.length; j += 1) {
		prev[j] = j;
	}

	for (let i = 1; i <= a.length; i += 1) {
		curr[0] = i;
		const aChar = a[i - 1];
		for (let j = 1; j <= b.length; j += 1) {
			const cost = aChar === b[j - 1] ? 0 : 1;
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
		}
		for (let j = 0; j <= b.length; j += 1) {
			prev[j] = curr[j];
		}
	}

	return prev[b.length];
}

function prefixSuffixMatch(candidate: string, known: string): boolean {
	return (
		candidate.slice(0, PREFIX_LENGTH) === known.slice(0, PREFIX_LENGTH) &&
		candidate.slice(-SUFFIX_LENGTH) === known.slice(-SUFFIX_LENGTH)
	);
}

function normalizeAddress(address: string): string {
	return address.toLowerCase();
}

function stripHexPrefix(address: string): string {
	return address.startsWith("0x") ? address.slice(2) : address;
}
