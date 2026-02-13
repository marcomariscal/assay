import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_TELEMETRY_DIR } from "./hash";
import { type TelemetryEvent, telemetryEventSchema } from "./schema";

export interface TelemetryWriter {
	write(event: TelemetryEvent): void;
	flush(): Promise<void>;
	getDroppedCount(): number;
	readonly filePath: string;
}

interface AppendOnlyWriterOptions {
	filePath?: string;
	onError?: (error: unknown) => void;
	appendLine?: (filePath: string, line: string) => Promise<void>;
}

function defaultTelemetryFilePath(now: Date): string {
	const day = now.toISOString().slice(0, 10);
	return path.join(DEFAULT_TELEMETRY_DIR, "events", `${day}.jsonl`);
}

export function createAppendOnlyTelemetryWriter(
	options?: AppendOnlyWriterOptions,
): TelemetryWriter {
	const filePath = options?.filePath ?? defaultTelemetryFilePath(new Date());
	const appendLine =
		options?.appendLine ??
		(async (targetPath: string, line: string) => {
			await appendFile(targetPath, line, "utf-8");
		});

	const init = mkdir(path.dirname(filePath), { recursive: true });
	let queue: Promise<void> = Promise.resolve();
	let dropped = 0;

	function onError(error: unknown) {
		dropped += 1;
		options?.onError?.(error);
	}

	return {
		filePath,
		write(event) {
			const parsed = telemetryEventSchema.safeParse(event);
			if (!parsed.success) {
				onError(parsed.error);
				return;
			}

			const line = `${JSON.stringify(parsed.data)}\n`;
			queue = queue
				.then(async () => {
					await init;
					await appendLine(filePath, line);
				})
				.catch((error) => {
					onError(error);
				});
		},
		async flush() {
			await queue;
		},
		getDroppedCount() {
			return dropped;
		},
	};
}
