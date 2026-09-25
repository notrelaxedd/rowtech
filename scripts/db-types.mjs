// Rewrites lib/supabase/database.types.ts from the local database.
//
//   npm run db:types [-- more supabase gen types flags]
//
// The file is replaced only when the CLI succeeds, so a stopped stack or a
// failed npx download leaves the committed types as they were, not empty.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const OUT = "lib/supabase/database.types.ts";

const run = spawnSync(
  "npx",
  ["supabase", "gen", "types", "typescript", "--local", "--schema", "public", ...process.argv.slice(2)],
  { stdio: ["inherit", "pipe", "inherit"], encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: process.platform === "win32" },
);

if (run.status !== 0 || !run.stdout?.trim()) {
  if (run.error) console.error(run.error.message);
  console.error(`db:types: supabase gen types failed; ${OUT} is unchanged.`);
  process.exit(run.status || 1);
}
writeFileSync(OUT, run.stdout);
