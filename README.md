# console_ipad

Repository reset: previous app content was removed so you can rebuild from scratch.

## Hosting (AWS Amplify)

This repo includes a minimal `amplify.yml` that publishes the `household-console/` folder as static files. Connect the branch in Amplify as before; build runs `scripts/amplify-verify.sh`.

## Local check

```bash
bash scripts/amplify-verify.sh
```

## Next

Add your new static site under `household-console/` (or change `amplify.yml` if you prefer a different layout).
