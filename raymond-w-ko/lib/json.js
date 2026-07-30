import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function isObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readJsonObject(path, fallback) {
	const value = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
	if (!isObject(value)) {
		throw new Error(`${path} must contain a JSON object`);
	}
	return value;
}

export function writeJson(path, value) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
