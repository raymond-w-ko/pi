#!/usr/bin/env bash
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)

if [[ $# -eq 0 ]]; then
	set -- all
fi

exec node "$SCRIPT_DIR/raymond-w-ko/main.js" "$@"
