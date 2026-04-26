#!/usr/bin/env bash
set -euo pipefail
test -f household-console/index.html || {
  echo "Missing household-console/index.html"
  exit 1
}
echo "Static bundle OK for Amplify Hosting."
