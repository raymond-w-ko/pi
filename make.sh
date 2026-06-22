#!/usr/bin/env bash
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
set -exu
git clean -fxd
npm ci
npm run build
pushd packages/coding-agent
npm run build
popd
git checkout -- packages/ai/src/models.generated.ts
PI="$SCRIPT_DIR/packages/coding-agent/dist/cli.js"
"$PI" install npm:pi-powerline-footer
"$PI" install npm:pi-intercom
"$PI" install npm:@ff-labs/pi-fff
"$PI" update --extensions
