# console_ipad — household dashboard

Static dashboard for **Fire TV** (four slides, remote-friendly) plus a **management** page for edits. Optional **Supabase** sync keeps the same data across TV and desktop browsers when both use the same sync key.

## URLs (Amplify site root = `household-console/`)

- `/` — landing with links
- `/tv/` — TV / 10-foot view (left/right on the remote)
- `/manage/` — edit slides, rotation (seconds), title, sync key, push/pull

## Supabase

1. Create a project and run the SQL migration:

   - `supabase/migrations/20260426000000_dashboard_kv.sql`

2. **Local / manual deploy:** copy `household-console/shared/sync-config.example.json` to `household-console/shared/sync-config.json` and fill in `supabaseUrl` and `supabaseAnonKey`. The real file is gitignored.

3. **AWS Amplify:** set environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY`. `scripts/amplify-prebuild.sh` writes `sync-config.json` at build time.

4. In **Manage**, generate or paste one **sync key** per household, save it on each device (TV browser session + desktop). **Push** from Manage after edits; the TV view **pulls** periodically and on load.

## Hosting (AWS Amplify)

`amplify.yml` publishes `household-console/` as static files. Build runs `scripts/amplify-prebuild.sh` then `scripts/amplify-verify.sh`.

## Local verify

```bash
bash scripts/amplify-verify.sh
```

## Fire TV

Open the hosted `/tv/` in the Silk browser (or your preferred browser), optionally full screen. Use the remote’s **Left** / **Right** to change slides. Open `/manage/` on desktop to edit content and sync.
