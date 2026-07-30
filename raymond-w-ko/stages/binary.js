import { run } from "../lib/process.js";

export function buildBinary(context) {
	run(
		"bash",
		[
			"./scripts/build-binaries.sh",
			"--skip-install",
			"--skip-deps",
			"--skip-build",
			"--platform",
			context.binaryPlatform,
		],
		context,
	);
}
