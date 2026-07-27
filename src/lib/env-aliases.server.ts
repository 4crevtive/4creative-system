import process from "node:process";

type EnvName = keyof NodeJS.ProcessEnv;

const aliases: Array<[EnvName, EnvName[]]> = [
  ["SUPABASE_URL", ["VITE_SUPABASE_URL"]],
  ["VITE_SUPABASE_URL", ["SUPABASE_URL"]],
  ["SUPABASE_PUBLISHABLE_KEY", ["SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY"]],
  ["VITE_SUPABASE_PUBLISHABLE_KEY", ["VITE_SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"]],
  ["SUPABASE_PROJECT_ID", ["VITE_SUPABASE_PROJECT_ID"]],
  ["VITE_SUPABASE_PROJECT_ID", ["SUPABASE_PROJECT_ID"]],
  ["SUPABASE_SERVICE_ROLE_KEY", ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_KEY"]],
];

for (const [target, sources] of aliases) {
  if (process.env[target]) continue;

  const value = sources.map((source) => process.env[source]).find((candidate) => candidate);
  if (value) process.env[target] = value;
}