#!/usr/bin/env bash
set -exu
npm install
npm run build
cd packages/coding-agent
npm run build:binary
