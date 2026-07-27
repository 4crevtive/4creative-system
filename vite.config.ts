// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const viteSupabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const viteSupabasePublishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY;
const viteSupabaseProjectId = process.env.VITE_SUPABASE_PROJECT_ID ?? process.env.SUPABASE_PROJECT_ID;

export default defineConfig({
  plugins: [],
  vite: {
    define: {
      ...(viteSupabaseUrl ? { "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(viteSupabaseUrl) } : {}),
      ...(viteSupabasePublishableKey
        ? { "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(viteSupabasePublishableKey) }
        : {}),
      ...(viteSupabaseProjectId ? { "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(viteSupabaseProjectId) } : {}),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
