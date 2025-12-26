#!/usr/bin/env bash
set -exu
git clean -fxd
npm ci
npm run build
pushd packages/coding-agent
npm run build
popd
git checkout -- packages/ai/src/models.generated.ts
