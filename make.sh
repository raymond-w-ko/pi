#!/usr/bin/env bash
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
set -exu
git restore packages/ai/src/providers/openrouter.models.ts
git restore packages/ai/src/image-models.generated.ts
git restore packages/ai/src/providers/*.models.ts
git clean -fxd
npm ci
npm run build
git checkout -- packages/ai/src/models.generated.ts
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
"$PI" update --extensions
