#!/usr/bin/env bash
set -exu
npm ci
npm run build
cd packages/coding-agent
npm run build:binary
