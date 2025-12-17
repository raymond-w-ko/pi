#!/usr/bin/env bash
set -exu
npm ci
npm run build
pushd packages/coding-agent
npm run build:binary
popd
git checkout upstream/main -- packages/ai/src/models.generated.ts
