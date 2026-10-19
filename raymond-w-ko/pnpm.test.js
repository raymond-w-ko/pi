import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parse } from "yaml";
import { configurePnpm, withPnpmWorkspace } from "./lib/pnpm.js";
import { prepareWorkspace } from "./stages/workspace.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fixture(action) {
	const root = mkdtempSync(join(tmpdir(), "pi-personal-pnpm-"));
	try {
		writeFileSync(
			join(root, "package.json"),
			JSON.stringify({
				name: "fixture",
				private: true,
				workspaces: ["packages/*"],
				overrides: { protobufjs: "7.6.6" },
			}),
		);
		action({ repoRoot: root, agentDir: root });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test("workspace configuration preserves linking, hoisting, overrides, and release age", () => {
	fixture((context) => {
		const path = join(context.repoRoot, "pnpm-workspace.yaml");
		assert.throws(
			() =>
				withPnpmWorkspace(context, () => {
					const contents = readFileSync(path, "utf8");
					assert.match(contents, /^packages:\n  - /);
					const configuration = parse(contents);
					assert.deepEqual(configuration.packages, ["packages/*"]);
					assert.equal(configuration.nodeLinker, "hoisted");
					assert.equal(configuration.linkWorkspacePackages, true);
					assert.equal(configuration.minimumReleaseAge, 2880);
					assert.equal(configuration.verifyDepsBeforeRun, false);
					assert.equal(configuration.ignoreScripts, true);
					assert.equal(configuration.lockfileDir, context.repoRoot);
					assert.deepEqual(configuration.overrides, { protobufjs: "7.6.6" });
					throw new Error("build failed");
				}),
			/build failed/,
		);
		assert.equal(existsSync(path), false);
		writeFileSync(path, "packages: []\n");
		assert.throws(() => withPnpmWorkspace(context, () => assert.fail()), /Refusing to overwrite/);
		assert.equal(readFileSync(path, "utf8"), "packages: []\n");
	});
});

for (const hasPreviousLockfile of [false, true]) {
	for (const fails of [false, true]) {
		test(`workspace archives its lockfile and restores prior state (existing=${hasPreviousLockfile}, failure=${fails})`, () => {
			fixture((context) => {
				const lockfilePath = join(context.repoRoot, "pnpm-lock.yaml");
				if (hasPreviousLockfile) writeFileSync(lockfilePath, "previous lockfile\n");
				const action = () =>
					withPnpmWorkspace(context, () => {
						writeFileSync(lockfilePath, "generated lockfile\n");
						if (fails) throw new Error("build failed");
					});
				if (fails) assert.throws(action, /build failed/);
				else action();
				assert.equal(
					readFileSync(join(context.repoRoot, "raymond-w-ko", ".pnpm", "pnpm-lock.yaml"), "utf8"),
					"generated lockfile\n",
				);
				if (hasPreviousLockfile) assert.equal(readFileSync(lockfilePath, "utf8"), "previous lockfile\n");
				else assert.equal(existsSync(lockfilePath), false);
				assert.equal(existsSync(join(context.repoRoot, "pnpm-workspace.yaml")), false);
			});
		});
	}
}

test("workspace rejects conflicting configuration before attempting destructive cleanup", () => {
	fixture((context) => {
		writeFileSync(join(context.repoRoot, "pnpm-workspace.yaml"), "packages: []\n");
		assert.throws(() => prepareWorkspace({ ...context, env: { PATH: "" } }), /Refusing to overwrite/);
	});
});

test("extension manager uses pnpm before installs and preserves other settings", () => {
	fixture((context) => {
		const path = join(context.agentDir, "settings.json");
		writeFileSync(path, JSON.stringify({ theme: "dark", packages: ["npm:pi-goal"] }));
		configurePnpm(context);
		assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), {
			theme: "dark",
			packages: ["npm:pi-goal"],
			npmCommand: ["pnpm", "--config.ignore-scripts=true"],
		});
	});
});

test("build adapter forwards npm run to pnpm and rejects other npm commands", () => {
	fixture((context) => {
		const bin = join(context.repoRoot, "bin");
		mkdirSync(bin);
		writeFileSync(join(bin, "pnpm"), '#!/bin/sh\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
		const adapter = join(repoRoot, "raymond-w-ko", "bin", "npm");
		const options = { encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } };
		const success = spawnSync("bash", [adapter, "run", "build:offline"], options);
		assert.equal(success.status, 0, success.stderr);
		assert.equal(success.stdout, "run\nbuild:offline\n");
		assert.equal(spawnSync("bash", [adapter, "ci"], options).status, 1);
	});
});

for (const command of [[process.execPath, join(repoRoot, "node_modules/pnpm/bin/pnpm.cjs")], ["pnpm"]])
	test(`pnpm installs then runs nested scripts without reinstalling or lifecycle hooks (${command[0]})`, () => {
		fixture((context) => {
			const child = join(context.repoRoot, "packages", "child");
			mkdirSync(child, { recursive: true });
			writeFileSync(
				join(context.repoRoot, "package.json"),
				JSON.stringify({
					name: "fixture",
					private: true,
					workspaces: ["packages/*"],
					devDependencies: { child: "1.0.0" },
					scripts: {
						prepare: "node prepare.cjs",
						smoke: "cd packages/child && npm run smoke",
					},
				}),
			);
			writeFileSync(
				join(child, "package.json"),
				JSON.stringify({
					name: "child",
					version: "1.0.0",
					bin: { "fixture-compiler": "compiler.cjs" },
					scripts: { smoke: "fixture-compiler" },
				}),
			);
			writeFileSync(
				join(context.repoRoot, "package-lock.json"),
				JSON.stringify({
					name: "fixture",
					lockfileVersion: 3,
					packages: {
						"": { name: "fixture", devDependencies: { child: "1.0.0" }, workspaces: ["packages/*"] },
						"packages/child": { name: "child", version: "1.0.0" },
						"node_modules/child": { resolved: "packages/child", link: true },
					},
				}),
			);
			writeFileSync(
				join(context.repoRoot, "prepare.cjs"),
				'require("node:fs").writeFileSync("prepare-ran", "unexpected");\n',
			);
			writeFileSync(
				join(child, "compiler.cjs"),
				'#!/usr/bin/env node\nrequire("node:assert/strict").equal(require("child/package.json").version, "1.0.0"); console.log("SMOKE_OK");\n',
				{ mode: 0o755 },
			);
			let installedLockfile;
			withPnpmWorkspace(context, () => {
				const lockfilePath = join(context.repoRoot, "pnpm-lock.yaml");
				for (const args of [["import"], ["install", "--offline", "--frozen-lockfile"]]) {
					const result = spawnSync(command[0], [...command.slice(1), ...args], {
						cwd: context.repoRoot,
						encoding: "utf8",
					});
					assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
				}
				assert.equal(existsSync(lockfilePath), true);
				assert.equal(existsSync(join(context.repoRoot, "node_modules", ".bin", "fixture-compiler")), true);
				assert.equal(existsSync(join(context.repoRoot, "node_modules/child/package.json")), true);
				assert.equal(existsSync(join(context.repoRoot, "prepare-ran")), false);
				installedLockfile = readFileSync(lockfilePath, "utf8");
				const result = spawnSync(command[0], [...command.slice(1), "run", "smoke"], {
					cwd: context.repoRoot,
					encoding: "utf8",
					env: { ...process.env, PATH: `${join(repoRoot, "raymond-w-ko", "bin")}:${process.env.PATH}` },
				});
				assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
				assert.match(result.stdout, /SMOKE_OK/);
				assert.doesNotMatch(
					`${result.stdout}\n${result.stderr}`,
					/ERR_|installing dependencies|install that runs before scripts|prepare\$|Scope:|Lockfile|Progress:|Done in/,
				);
				assert.equal(existsSync(join(context.repoRoot, "prepare-ran")), false);
				assert.equal(readFileSync(lockfilePath, "utf8"), installedLockfile);
			});
			assert.equal(existsSync(join(context.repoRoot, "pnpm-lock.yaml")), false);
			assert.equal(
				readFileSync(join(context.repoRoot, "raymond-w-ko", ".pnpm", "pnpm-lock.yaml"), "utf8"),
				installedLockfile,
			);
		});
	});
