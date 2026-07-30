import { resolve } from "node:path";
import { isObject, readJsonObject } from "./json.js";

const REMOTE_SOURCE_PATTERN = /^(?:npm:|git:|https?:\/\/|ssh:\/\/|git:\/\/)/;

export function readPackageSources(settingsPath) {
	const settings = readJsonObject(settingsPath, {});
	const packages = settings.packages ?? [];
	if (!Array.isArray(packages)) {
		throw new Error(`${settingsPath} packages must be an array`);
	}

	return packages.map((entry, index) => {
		const source = typeof entry === "string" ? entry : isObject(entry) ? entry.source : undefined;
		if (typeof source !== "string" || source.length === 0) {
			throw new Error(`${settingsPath} packages[${index}] must be a package source or filtered package object`);
		}
		return source;
	});
}

export function getRemovalSource(source, agentDir) {
	return REMOTE_SOURCE_PATTERN.test(source) ? source : resolve(agentDir, source);
}
