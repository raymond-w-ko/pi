import { run } from "../lib/process.js";

export function prepareWorkspace(context) {
	run("git", ["clean", "-fxd", "-e", "raymond-w-ko/"], context);
	run("npm", ["ci"], context);
	run("npm", ["run", "build"], context);
}
