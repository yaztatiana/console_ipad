#!/usr/bin/env bash
# Called from amplify.yml preBuild. No colons in amplify.yml command strings.
set -euo pipefail
if [[ -n "${SUPABASE_URL:-}" && -n "${SUPABASE_ANON_KEY:-}" ]]; then
  node -e "const fs=require('fs');const p='household-console/shared/sync-config.json';fs.writeFileSync(p,JSON.stringify({supabaseUrl:process.env.SUPABASE_URL,supabaseAnonKey:process.env.SUPABASE_ANON_KEY}));console.log('Wrote',p);"
else
  echo "Skipping sync-config. Set SUPABASE_URL and SUPABASE_ANON_KEY in Amplify env to generate it."
fi
