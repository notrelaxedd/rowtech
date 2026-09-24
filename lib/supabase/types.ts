import type { Database as Generated } from "./database.types";

// database.types.ts is generated from the local database (npm run db:types);
// don't edit it. Postgres reports every column of a view as nullable, so the
// one correction is here: session_stats groups by sessions.id, and these
// columns are NOT NULL in sessions or a count(), so never null in the view
// (supabase/migrations/20260922181900_session_stats_view.sql).
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
    // Every generated view, with session_stats' row corrected.
    Views: Omit<Generated["public"]["Views"], "session_stats"> & {
      session_stats: Omit<Generated["public"]["Views"]["session_stats"], "Row"> & { Row: SessionStats };
    };
  };
};
