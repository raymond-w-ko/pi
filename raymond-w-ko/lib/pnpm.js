import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readJsonObject, writeJson } from "./json.js";

export function configurePnpm(context) {
	const path = join(context.agentDir, "settings.json");
	const settings = readJsonObject(path, {});
	settings.npmCommand = ["pnpm", "--config.ignore-scripts=true"];
	writeJson(path, settings);
}

export function withPnpmWorkspace(context, action) {
	const manifest = readJsonObject(join(context.repoRoot, "package.json"), {});
	const path = join(context.repoRoot, "pnpm-workspace.yaml");
	// Hoisting preserves the root node_modules paths used by the binary assembler.
	const configuration = `${JSON.stringify(
		{
			packages: manifest.workspaces,
			nodeLinker: "hoisted",
			linkWorkspacePackages: true,
			minimumReleaseAge: 2880,
			overrides: manifest.overrides ?? {},
		},
		null,
		2,
	)}\n`;
	const exists = existsSync(path);
	if (exists && readFileSync(path, "utf8") !== configuration) {
		throw new Error(`Refusing to overwrite existing workspace configuration: ${path}`);
	}
	if (!exists) writeFileSync(path, configuration, { flag: "wx" });
	try {
		action();
	} finally {
		if (!exists) rmSync(path);
	}
}
