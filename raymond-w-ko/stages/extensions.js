import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { isObject, readJsonObject, writeJson } from "../lib/json.js";
import { getRemovalSource, readPackageSources } from "../lib/package-settings.js";
import { run } from "../lib/process.js";

const EXTENSIONS = [
	"npm:@juicesharp/rpiv-ask-user-question",
	"npm:@ff-labs/pi-fff",
	"npm:@quintinshaw/pi-dynamic-workflows",
	"npm:pi-anthropic-oauth",
	"npm:pi-goal",
	"npm:pi-powerline-footer",
	"npm:pi-intercom",
	"npm:pi-interactive-shell",
	// "npm:pi-tool-display",
  "npm:pi-web-access",
];

export function installExtensions(context) {
	repairExtensionPackageLock(context.npmInstallRoot);
	configureExtensionPackage(join(context.npmInstallRoot, "package.json"));
	run(
		"npm",
		["install", "--ignore-scripts", "--save-exact", "--prefix", context.npmInstallRoot, "@ff-labs/fff-bun"],
		context,
	);
	for (const extension of EXTENSIONS) {
		if (isExtensionInstalled(context.npmInstallRoot, extension)) {
			console.log(`skip: ${extension} already installed`);
			continue;
		}
		run(context.binaryPath, ["install", extension], context);
	}
	removeUnlistedPackages(context);
	run("npm", ["rebuild", "esbuild", "--prefix", context.npmInstallRoot], context);
	run(context.binaryPath, ["update", "--extensions"], context);
	restoreGeneratedModels(context);
}

function getNpmPackageName(source) {
	return source.startsWith("npm:") ? source.slice("npm:".length) : undefined;
}

function isExtensionInstalled(npmInstallRoot, source) {
	const packageName = getNpmPackageName(source);
	if (!packageName) {
		return false;
	}
	return existsSync(join(npmInstallRoot, "node_modules", ...packageName.split("/")));
}

function removeUnlistedPackages(context) {
	const desiredPackages = new Set(EXTENSIONS);
	const settingsPath = join(context.agentDir, "settings.json");
	const configuredPackages = new Set(readPackageSources(settingsPath));
	for (const source of configuredPackages) {
		if (!desiredPackages.has(source)) {
			run(context.binaryPath, ["remove", getRemovalSource(source, context.agentDir)], context);
		}
	}
}

function repairExtensionPackageLock(npmInstallRoot) {
	const packageLock = join(npmInstallRoot, "package-lock.json");
	if (existsSync(packageLock) && /^[\t ]+"(?:\.\.\/)+/m.test(readFileSync(packageLock, "utf8"))) {
		rmSync(packageLock, { force: true });
		rmSync(join(npmInstallRoot, "node_modules", ".package-lock.json"), { force: true });
	}
}

function configureExtensionPackage(path) {
	const packageJson = readJsonObject(path, { name: "pi-extensions", private: true });
	const existingAllowScripts = packageJson.allowScripts;
	packageJson.allowScripts = {
		...(isObject(existingAllowScripts) ? existingAllowScripts : {}),
		esbuild: true,
		fsevents: true,
	};
	writeJson(path, packageJson);
}

function restoreGeneratedModels(context) {
	run(
		"git",
		[
			"restore",
			"--",
			"packages/ai/src/models.generated.ts",
			"packages/ai/src/image-models.generated.ts",
			"packages/ai/src/providers/*.models.ts",
		],
		context,
	);
}
