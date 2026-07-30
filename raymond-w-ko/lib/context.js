import { mkdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function getBinaryPlatform() {
	const supportedPlatforms = new Map([
		["darwin-arm64", "darwin-arm64"],
		["darwin-x64", "darwin-x64"],
		["linux-x64", "linux-x64"],
		["linux-arm64", "linux-arm64"],
		["win32-x64", "windows-x64"],
		["win32-arm64", "windows-arm64"],
	]);
	const hostPlatform = `${process.platform}-${process.arch}`;
	const binaryPlatform = supportedPlatforms.get(hostPlatform);
	if (!binaryPlatform) {
		throw new Error(`Unsupported platform: ${hostPlatform}`);
	}
	return binaryPlatform;
}

export function createContext() {
	const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
	const requestedAgentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
	mkdirSync(requestedAgentDir, { recursive: true });
	const agentDir = realpathSync(requestedAgentDir);
	const npmInstallRoot = join(agentDir, "npm");
	let binaryPlatform;
	const resolveBinaryPlatform = () => {
		binaryPlatform ??= getBinaryPlatform();
		return binaryPlatform;
	};
	const resolveBinaryDir = () =>
		join(repoRoot, "packages", "coding-agent", "binaries", resolveBinaryPlatform());

	return {
		agentDir,
		get binaryDir() {
			return resolveBinaryDir();
		},
		get binaryPath() {
			const binaryName = resolveBinaryPlatform().startsWith("windows-") ? "pi.exe" : "pi";
			return join(resolveBinaryDir(), binaryName);
		},
		get binaryPlatform() {
			return resolveBinaryPlatform();
		},
		env: { ...process.env, PI_CODING_AGENT_DIR: agentDir },
		installDir: join(homedir(), "pi"),
		npmInstallRoot,
		repoRoot,
	};
}
