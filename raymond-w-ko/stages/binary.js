import { run } from "../lib/process.js";

export function buildBinary(context) {
	run(
		"bash",
		[
			"./scripts/build-binaries.sh",
			"--skip-install",
			"--skip-deps",
			"--skip-build",
			"--skip-archives",
			"--platform",
			context.binaryPlatform,
		],
		context,
	);
}
