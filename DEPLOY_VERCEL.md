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

Use values from the Supabase project you own. Lovable-managed backend secrets are not exported to Vercel.

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

Compatibility aliases:
- If your Supabase dashboard shows an `anon` key instead of a `publishable` key, use the same value for `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_PUBLISHABLE_KEY`.
- If your host names the secret key `SUPABASE_SECRET_KEY`, also set `SUPABASE_SERVICE_ROLE_KEY` to that same secret value. This app's user-management functions require `SUPABASE_SERVICE_ROLE_KEY` for Auth Admin API calls such as create user, delete user, list auth users, and password resets.

Never use the anon/publishable key as `SUPABASE_SERVICE_ROLE_KEY`. They are different keys with different privileges.

After changing variables in Vercel, trigger a fresh **Redeploy**. Vercel does not update the running deployment just because variables were edited.

## Deploy

Push to the default branch → Vercel builds & deploys automatically. Preview deploys are created for every PR.

## Notes

- Do NOT edit `src/integrations/supabase/*` auto-generated files.
- Server functions (`createServerFn`) run as Vercel serverless functions via Nitro's Vercel preset.
- If you hit `Node.js` runtime errors, ensure the packages you added are edge/Node-compatible.