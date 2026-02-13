export { isTelemetryEnabled } from "./gate";
export {
	buildActionFingerprint,
	buildTransactionFingerprint,
	hashAddress,
	hashWithSalt,
	resolveTelemetrySalt,
} from "./hash";
export {
	createProxyTelemetry,
	type ProxyScanResultInput,
	type ProxyScanStartedInput,
	type ProxyTelemetry,
	type ProxyUserActionOutcomeInput,
	type TelemetryDecision,
	type TelemetryPromptResponse,
} from "./proxy";
export {
	type TelemetryEvent,
	type TelemetrySeverityBucket,
	telemetryEventSchema,
	telemetrySeverityBucketSchema,
} from "./schema";
export { createAppendOnlyTelemetryWriter, type TelemetryWriter } from "./writer";
