import type { Database as Generated } from "./database.types";

// database.types.ts is generated from the local database (npm run db:types);
// don't edit it. Corrections go here. Postgres reports every column of a view
// as nullable, but session_stats is one row per session and these columns are
// NOT NULL in sessions, so never null in the view. And Postgres calls the view
// updatable, but only select on it is granted
// (supabase/migrations/20260925050000_stored_session_stats.sql).
type StatsRow = Generated["public"]["Views"]["session_stats"]["Row"];
export type SessionStats = Omit<StatsRow, "session_id" | "team_id" | "recorded_at" | "strokes"> & {
  session_id: string;
  team_id: string;
  recorded_at: string;
  strokes: number;
};

/** A table's row, as the generated types have it. */
export type TableRow<T extends keyof Generated["public"]["Tables"]> = Generated["public"]["Tables"][T]["Row"];

export type Database = Omit<Generated, "public"> & {
  public: Omit<Generated["public"], "Views"> & {
    // Every generated view, with session_stats' row corrected and no writes.
    Views: Omit<Generated["public"]["Views"], "session_stats"> & {
      session_stats: Omit<Generated["public"]["Views"]["session_stats"], "Row" | "Insert" | "Update"> & { Row: SessionStats };
    };
  };
};
