// Shared by the form (client) and the action (server). Limits mirror the CHECK
// constraints on public.beta_signups (supabase/migrations).
export const ROLES = [
  { value: "coach", label: "Coach" },
  { value: "program", label: "Club or program" },
  { value: "athlete", label: "Athlete" },
  { value: "other", label: "Other" },
] as const;

export const BOATS = ["1x", "2x", "2-", "2+", "4x", "4-", "4+", "8+"] as const;

export const LIMITS = {
  name: 120,
  email: 254,
  organization: 160,
  location: 120,
  message: 2000,
  from: 40,
  utm: 100,
  referrer: 200,
} as const;

export type Field = "name" | "email" | "organization" | "role" | "boats" | "location" | "message";
export const REQUIRED: readonly Field[] = ["name", "email", "organization"];

export type Values = Partial<Record<Exclude<Field, "boats">, string>> & { boats?: string[] };

export type ApplyState = {
  status: "idle" | "error" | "ok";
  errors: Partial<Record<Field, string>>;
  message: string;
  values: Values;
};

export const EMPTY_STATE: ApplyState = { status: "idle", errors: {}, message: "", values: {} };

export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
