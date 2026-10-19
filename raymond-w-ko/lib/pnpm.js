import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
	const overrides = Object.entries(manifest.overrides ?? {});
	// Keep this bootstrap dependency-free. JSON quoting also safely quotes YAML scalars.
	const configuration = `${[
		manifest.workspaces.length ? "packages:" : "packages: []",
		...manifest.workspaces.map((pattern) => `  - ${JSON.stringify(pattern)}`),
		// The binary assembler reads assets from root node_modules paths.
		"nodeLinker: hoisted",
		"linkWorkspacePackages: true",
		"minimumReleaseAge: 2880",
		"verifyDepsBeforeRun: false",
		"ignoreScripts: true",
		`lockfileDir: ${JSON.stringify(context.repoRoot)}`,
		overrides.length ? "overrides:" : "overrides: {}",
		...overrides.map(([name, version]) => `  ${JSON.stringify(name)}: ${JSON.stringify(version)}`),
	].join("\n")}\n`;
	const exists = existsSync(path);
	if (exists && readFileSync(path, "utf8") !== configuration) {
		throw new Error(`Refusing to overwrite existing workspace configuration: ${path}`);
	}
	const lockfilePath = join(context.repoRoot, "pnpm-lock.yaml");
	const previousLockfile = existsSync(lockfilePath) ? readFileSync(lockfilePath) : undefined;
	if (!exists) writeFileSync(path, configuration, { flag: "wx" });
	try {
		action();
	} finally {
		try {
			// Hoisted installs use lockfileDir as their dependency root. Archive only after building.
			if (existsSync(lockfilePath)) {
				const archiveDir = join(context.repoRoot, "raymond-w-ko", ".pnpm");
				mkdirSync(archiveDir, { recursive: true });
				copyFileSync(lockfilePath, join(archiveDir, "pnpm-lock.yaml"));
			}
		} finally {
			try {
				if (previousLockfile !== undefined) writeFileSync(lockfilePath, previousLockfile);
				else rmSync(lockfilePath, { force: true });
			} finally {
				if (!exists) rmSync(path);
			}
		}
	}
}
