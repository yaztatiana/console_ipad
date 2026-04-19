#!/usr/bin/env bash
# Called from amplify.yml build. Verifies artifact paths before Amplify publishes.
set -euo pipefail
test -f household-console/tv/index.html || { echo "Missing household-console/tv/index.html"; exit 1; }
test -f household-console/manage/index.html || { echo "Missing household-console/manage/index.html"; exit 1; }
test -f household-console/shared/store.js || { echo "Missing household-console/shared/store.js"; exit 1; }
echo "Household console static bundle verified for Amplify Hosting."
