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

/**
 * What's wrong with one of the three required fields, if anything. The action
 * decides with this, and the form uses it to say so as soon as a field is left.
 */
export function requiredError(f: "name" | "email" | "organization", value: string): string | undefined {
  const v = value.trim();
  if (f === "name") {
    if (!v) return "Tell us your name.";
    if (v.length > LIMITS.name) return `Keep it under ${LIMITS.name} characters.`;
  } else if (f === "email") {
    if (!v) return "We need an email address to reply to.";
    if (v.length > LIMITS.email || !EMAIL.test(v)) return "That doesn't look like an email address. Check for a typo.";
  } else if (f === "organization") {
    if (!v) return "Which club, school or program do you row with?";
    if (v.length > LIMITS.organization) return `Keep it under ${LIMITS.organization} characters.`;
  }
  return undefined;
}

/**
 * The line over the form when fields need fixing, counted. The action sends
 * it, and the form recounts as fields are fixed, so it stays true.
 */
export function fixSummary(n: number): string {
  const things = n === 1 ? "One thing needs" : n === 2 ? "A couple of things need" : "A few things need";
  return `${things} fixing before we can send this.`;
}

/** Which link someone came in on (`from_cta`): a short tag, letters, digits, - and _. */
export const cleanFrom = (v: string) => v.replace(/[^a-z0-9_-]/gi, "").slice(0, LIMITS.from);
