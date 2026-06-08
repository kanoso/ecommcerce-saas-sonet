#!/bin/sh
# EAS passes --platform android as arguments to this script.
# We forward them to expo prebuild so it knows which platform to target.
set -e

npx expo prebuild --no-install "$@"

node scripts/patch-expo-modules-core.js
