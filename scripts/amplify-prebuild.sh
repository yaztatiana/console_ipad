#!/usr/bin/env bash
# Writes household-console/shared/sync-config.json when Amplify env vars are set.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${ROOT_DIR}/household-console/shared/sync-config.json"

if [[ -n "${SUPABASE_URL:-}" && -n "${SUPABASE_ANON_KEY:-}" ]]; then
  python3 -c 'import json, sys
path, url, key = sys.argv[1], sys.argv[2].strip(), sys.argv[3].strip()
with open(path, "w", encoding="utf-8") as f:
    json.dump({"supabaseUrl": url, "supabaseAnonKey": key}, f, indent=2)
    f.write("\n")
print("Wrote", path)
' "$OUT" "${SUPABASE_URL}" "${SUPABASE_ANON_KEY}"
else
  echo "amplify-prebuild: SUPABASE_URL / SUPABASE_ANON_KEY not both set — skipping sync-config.json (use sync-config.example.json locally)."
fi
