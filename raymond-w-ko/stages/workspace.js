import { delimiter, join } from "node:path";
import { withPnpmWorkspace } from "../lib/pnpm.js";
import { run } from "../lib/process.js";

export function prepareWorkspace(context) {
	withPnpmWorkspace(context, () => {
		run("git", ["clean", "-fxd", "-e", "raymond-w-ko/", "-e", "pnpm-workspace.yaml", "-e", "pnpm-lock.yaml"], context);
		run("pnpm", ["import"], context);
		run("pnpm", ["install", "--ignore-scripts", "--frozen-lockfile"], context);
		// Upstream build scripts use nested `npm run`; route only those calls to pnpm.
		const buildContext = {
			...context,
			env: {
				...context.env,
				PATH: `${join(context.repoRoot, "raymond-w-ko", "bin")}${delimiter}${context.env.PATH ?? ""}`,
			},
		};
		run("pnpm", ["run", "build"], buildContext);
	});
}
