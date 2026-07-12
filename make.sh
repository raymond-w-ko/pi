#!/usr/bin/env bash
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
set -exu
PI_CODING_AGENT_DIR=$(CDPATH= cd -- "${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}" && pwd -P)
export PI_CODING_AGENT_DIR
NPM_INSTALL_ROOT="$PI_CODING_AGENT_DIR/npm"
NPM_PACKAGE_LOCK="$NPM_INSTALL_ROOT/package-lock.json"
if [[ -f "$NPM_PACKAGE_LOCK" ]] && grep -Eq '^[[:space:]]+"(\.\./)+' "$NPM_PACKAGE_LOCK"; then
	rm -f "$NPM_PACKAGE_LOCK" "$NPM_INSTALL_ROOT/node_modules/.package-lock.json"
fi
restore_generated_models() {
	git restore packages/ai/src/models.generated.ts
	git restore packages/ai/src/image-models.generated.ts
	git restore packages/ai/src/providers/*.models.ts
}
git clean -fxd
npm ci
npm run build
case "$(uname -s)-$(uname -m)" in
Darwin-arm64)
	BINARY_PLATFORM=darwin-arm64
	;;
Darwin-x86_64)
	BINARY_PLATFORM=darwin-x64
	;;
Linux-x86_64)
	BINARY_PLATFORM=linux-x64
	;;
Linux-aarch64|Linux-arm64)
	BINARY_PLATFORM=linux-arm64
	;;
MINGW*|MSYS*|CYGWIN*)
	case "$(uname -m)" in
	x86_64)
		BINARY_PLATFORM=windows-x64
		;;
	aarch64|arm64)
		BINARY_PLATFORM=windows-arm64
		;;
	*)
		echo "Unsupported Windows architecture: $(uname -m)" >&2
		exit 1
		;;
	esac
	;;
*)
	echo "Unsupported platform: $(uname -s)-$(uname -m)" >&2
	exit 1
	;;
esac
./scripts/build-binaries.sh --skip-install --skip-deps --skip-build --platform "$BINARY_PLATFORM"
if [[ "$BINARY_PLATFORM" == windows-* ]]; then
	PI="$SCRIPT_DIR/packages/coding-agent/binaries/$BINARY_PLATFORM/pi.exe"
else
	PI="$SCRIPT_DIR/packages/coding-agent/binaries/$BINARY_PLATFORM/pi"
fi
"$PI" install npm:pi-powerline-footer
"$PI" install npm:pi-intercom
"$PI" install npm:@ff-labs/pi-fff
"$PI" install npm:pi-goal
npm rebuild esbuild --prefix "$NPM_INSTALL_ROOT"
"$PI" update --extensions
restore_generated_models
node - "$PI_CODING_AGENT_DIR/settings.json" <<'NODE'
const fs = require("node:fs");
const settingsPath = process.argv[2];
const settings = fs.existsSync(settingsPath)
	? JSON.parse(fs.readFileSync(settingsPath, "utf8"))
	: {};
if (settings === null || typeof settings !== "object" || Array.isArray(settings)) {
	throw new Error(`${settingsPath} must contain a JSON object`);
}
const existingPowerline = settings.powerline;
settings.powerline = existingPowerline !== null && typeof existingPowerline === "object" && !Array.isArray(existingPowerline)
	? { ...existingPowerline, welcome: false }
	: typeof existingPowerline === "string"
		? { preset: existingPowerline, welcome: false }
		: { welcome: false };
fs.mkdirSync(require("node:path").dirname(settingsPath), { recursive: true });
fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
NODE
