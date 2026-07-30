#!/usr/bin/env node

import { createContext } from "./lib/context.js";
import { buildBinary } from "./stages/binary.js";
import { configureAgent } from "./stages/config.js";
import { installExtensions } from "./stages/extensions.js";
import { installBinary } from "./stages/install.js";
import { prepareWorkspace } from "./stages/workspace.js";

const STAGES = [
	["workspace", prepareWorkspace],
	["binary", buildBinary],
	["extensions", installExtensions],
	["config", configureAgent],
	["install", installBinary],
];

function printUsage() {
	console.log(`Usage: ./make.sh <stage>

Stages:
  all         Run every stage in order
  workspace   Clean repository, install dependencies, and build packages
  binary      Build the standalone binary for this host
  extensions  Strictly sync global Pi packages to the configured list
  config      Update Pi settings and keybindings
  install     Copy the standalone binary distribution to ~/pi
  help        Show this help`);
}

function main() {
	const [stage = "all", ...extraArgs] = process.argv.slice(2);
	if (stage === "help" || stage === "--help" || stage === "-h") {
		printUsage();
		return;
	}
	if (extraArgs.length > 0) {
		throw new Error(`Unexpected arguments: ${extraArgs.join(" ")}`);
	}

	const selectedStages = stage === "all" ? STAGES : STAGES.filter(([name]) => name === stage);
	if (selectedStages.length === 0) {
		throw new Error(`Unknown stage: ${stage}. Run with --help to list stages.`);
	}

	const context = createContext();
	for (const [name, runStage] of selectedStages) {
		console.log(`\n== ${name} ==`);
		runStage(context);
	}
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.stack : String(error));
	process.exitCode = 1;
}
