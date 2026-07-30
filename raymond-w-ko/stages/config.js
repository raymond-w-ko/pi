import { join } from "node:path";
import { isObject, readJsonObject, writeJson } from "../lib/json.js";

export function configureAgent(context) {
	configureSettings(join(context.agentDir, "settings.json"));
	configureKeybindings(join(context.agentDir, "keybindings.json"));
}

function configureSettings(path) {
	const settings = readJsonObject(path, {});
	const existingPowerline = settings.powerline;
	settings.powerline = isObject(existingPowerline)
		? { ...existingPowerline, welcome: false, fixedEditor: false }
		: typeof existingPowerline === "string"
			? { preset: existingPowerline, welcome: false, fixedEditor: false }
			: { welcome: false, fixedEditor: false };
	const existingSubagents = settings.subagents;
	settings.subagents = isObject(existingSubagents)
		? { ...existingSubagents, disableBuiltins: true }
		: { disableBuiltins: true };
	writeJson(path, settings);
}

function configureKeybindings(path) {
	const keybindings = readJsonObject(path, {});
	keybindings["tui.input.submit"] = "alt+enter";
	keybindings["app.message.followUp"] = "enter";
	writeJson(path, keybindings);
}
