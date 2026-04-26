#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HC="${ROOT_DIR}/household-console"

require() {
  test -f "$1" || {
    echo "Missing required file: $1"
    exit 1
  }
}

require "${HC}/index.html"
require "${HC}/tv/index.html"
require "${HC}/tv/tv.css"
require "${HC}/tv/tv.js"
require "${HC}/manage/index.html"
require "${HC}/manage/manage.css"
require "${HC}/manage/manage.js"
require "${HC}/shared/store.js"
require "${HC}/shared/sync.js"

echo "Static bundle OK for Amplify Hosting (TV, Manage, shared)."
