#!/usr/bin/env bash
set -exu
npm install
cd packages/coding-agent
npm run build:binary
