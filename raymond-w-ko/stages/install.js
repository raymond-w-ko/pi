import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function installBinary(context) {
	mkdirSync(context.installDir, { recursive: true });
	for (const entry of readdirSync(context.binaryDir)) {
		cpSync(join(context.binaryDir, entry), join(context.installDir, entry), { recursive: true, force: true });
	}
}
