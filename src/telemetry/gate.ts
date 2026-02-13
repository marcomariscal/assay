function isTruthy(value: string): boolean {
	const normalized = value.trim().toLowerCase();
	return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isFalsy(value: string): boolean {
	const normalized = value.trim().toLowerCase();
	return (
		normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off"
	);
}

export function isTelemetryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
	const explicit = env.ASSAY_TELEMETRY;
	if (typeof explicit === "string" && explicit.trim().length > 0) {
		return !isFalsy(explicit);
	}

	const optOut = env.ASSAY_TELEMETRY_OPTOUT;
	if (typeof optOut === "string" && optOut.trim().length > 0) {
		return !isTruthy(optOut);
	}

	return true;
}
