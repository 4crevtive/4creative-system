# Deploy to Vercel

This project is a TanStack Start app built with Vite + Nitro. Nitro's `vercel` preset produces the Vercel Build Output (`.vercel/output`) that Vercel serves directly.

## One-time setup

1. Push the repo to GitHub (Lovable → GitHub → Connect project).
2. In Vercel: **Add New Project** → import the repo.
3. Framework Preset: **Other** (leave as-is; `vercel.json` handles it).
4. Build & Output Settings: leave defaults — `vercel.json` sets:
   - Install: `bun install`
   - Build: `NITRO_PRESET=vercel bun run build`
   - Output: `.vercel/output`

## Environment variables

If you self-host on Vercel, add these in **Vercel → Project → Settings → Environment Variables** (Production + Preview). Do not hardcode these values in `vercel.json`.

Client (public):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Server (private):
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_SERVICE_ROLE_KEY` (required for admin user-management screens)
- Any other secrets your server functions read via `process.env.*`

After changing variables in Vercel, trigger a fresh **Redeploy**. Vercel does not update the running deployment just because variables were edited.

## Deploy

Push to the default branch → Vercel builds & deploys automatically. Preview deploys are created for every PR.

## Notes

- Do NOT edit `src/integrations/supabase/*` auto-generated files.
- Server functions (`createServerFn`) run as Vercel serverless functions via Nitro's Vercel preset.
- If you hit `Node.js` runtime errors, ensure the packages you added are edge/Node-compatible.