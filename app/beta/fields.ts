// Shared by the form (client) and the action (server). Limits mirror the
// CHECK constraints on public.beta_signups.
export const ROLES = [
  { value: "coach", label: "Coach" },
  { value: "program", label: "Club or program" },
  { value: "athlete", label: "Athlete" },
  { value: "other", label: "Other" },
] as const;

export const SEATS = ["1", "2", "4", "8", "9+"] as const;

export const LIMITS = {
  name: 120,
  email: 254,
  organization: 160,
  location: 120,
  message: 2000,
  source: 200,
} as const;

export type Field = "name" | "email" | "role" | "organization" | "seats" | "location" | "message";

export type SignupState = {
  errors: Partial<Record<Field, string>>;
  message: string;
  values: Partial<Record<Field, string>>;
};

export const EMPTY_STATE: SignupState = { errors: {}, message: "", values: {} };
