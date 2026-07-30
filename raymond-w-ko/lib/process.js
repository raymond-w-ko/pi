import { spawnSync } from "node:child_process";

function quoteArgument(argument) {
	return /^[A-Za-z0-9_./:@%+=,-]+$/.test(argument) ? argument : JSON.stringify(argument);
}

export function run(command, args, context) {
	console.log(`$ ${[command, ...args].map(quoteArgument).join(" ")}`);
	const result = spawnSync(command, args, {
		cwd: context.repoRoot,
		env: context.env,
		stdio: "inherit",
	});

	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		const outcome = result.signal ? `signal ${result.signal}` : `exit code ${result.status}`;
		throw new Error(`${command} failed with ${outcome}`);
	}
}
