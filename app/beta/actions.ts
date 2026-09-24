"use server";

import { supabaseAnon } from "@/lib/supabase/anon";
import { BOATS, cleanFrom, LIMITS, requiredError, ROLES, type ApplyState, type Values } from "./fields";

type Application = {
  name: string;
  email: string;
  organization: string;
  role: string | null;
  boat_types: string[] | null;
  location: string | null;
  message: string | null;
  from_cta: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string | null;
};

function text(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}
const clip = (v: string, n: number) => v.slice(0, n) || null;

/**
 * What's safe to log from a failure. A Postgres error's `details` can quote
 * the failing row, which here is the applicant's name, email and message.
 */
function loggable(e: unknown) {
  if (e && typeof e === "object") {
    const { code, message } = e as { code?: unknown; message?: unknown };
    return { code, message };
  }
  return { message: String(e) };
}

/**
 * Confirmation email to the applicant. No provider is set up yet, so this does
 * nothing; the on-page confirmation carries "what happens next" for now.
 */
async function sendConfirmation(application: Application): Promise<void> {
  // TODO: send confirmation email -- drop the provider call in here (Resend,
  // Postmark, SES...). Must never throw into the submit path: log and move on.
  void application;
}

/**
 * Test runs (Playwright) exercise the whole path except the write. Never in
 * production: a stray BETA_DRY_RUN there would drop every application while
 * telling each applicant it was saved, so it is ignored, loudly.
 */
function dryRun() {
  if (process.env.BETA_DRY_RUN !== "1") return false;
  if (process.env.VERCEL_ENV === "production") {
    console.error("BETA_DRY_RUN is set in production; ignoring it and saving the application");
    return false;
  }
  return true;
}

/** The single submit path for beta applications. */
export async function submitApplication(_prev: ApplyState, fd: FormData): Promise<ApplyState> {
  const boats = [...new Set(fd.getAll("boats").filter((b): b is string => typeof b === "string"))];
  const [name, email, organization] = [text(fd, "name"), text(fd, "email"), text(fd, "organization")];
  const values: Values = {
    name,
    email,
    organization,
    role: text(fd, "role"),
    location: text(fd, "location"),
    message: text(fd, "message"),
    boats,
  };

  // Honeypot: a field people never see. Bots that fill it get the success
  // screen and nothing is stored. Logged, without anything they sent, so a
  // run of these (or a real person caught by it) shows up.
  if (text(fd, "leave_blank")) {
    console.warn("beta application dropped: honeypot filled", { from: cleanFrom(text(fd, "from")) || null });
    return { status: "ok", errors: {}, message: "", values };
  }

  const errors: ApplyState["errors"] = {};
  for (const f of ["name", "email", "organization"] as const) {
    const msg = requiredError(f, values[f] ?? "");
    if (msg) errors[f] = msg;
  }
  if (values.role && !ROLES.some((r) => r.value === values.role)) errors.role = "Pick one of the options.";
  if (boats.some((b) => !(BOATS as readonly string[]).includes(b))) errors.boats = "Pick from the boats listed.";
  if (values.location && values.location.length > LIMITS.location) errors.location = `Keep it under ${LIMITS.location} characters.`;
  if (values.message && values.message.length > LIMITS.message) errors.message = `Keep it under ${LIMITS.message} characters.`;

  if (Object.keys(errors).length) {
    return { status: "error", errors, message: "A couple of things need fixing before we can send this.", values };
  }

  const application: Application = {
    name,
    email,
    organization,
    role: values.role || null,
    boat_types: boats.length ? boats : null,
    location: values.location || null,
    message: values.message || null,
    from_cta: cleanFrom(text(fd, "from")) || null,
    utm_source: clip(text(fd, "utm_source"), LIMITS.utm),
    utm_medium: clip(text(fd, "utm_medium"), LIMITS.utm),
    utm_campaign: clip(text(fd, "utm_campaign"), LIMITS.utm),
    utm_term: clip(text(fd, "utm_term"), LIMITS.utm),
    utm_content: clip(text(fd, "utm_content"), LIMITS.utm),
    referrer: clip(text(fd, "referrer"), LIMITS.referrer),
  };

  if (dryRun()) return { status: "ok", errors: {}, message: "", values };

  try {
    const { error } = await supabaseAnon().from("beta_signups").insert(application);
    // 23505: this address has already applied. Treat it as success so the
    // form never reveals who has applied.
    if (error && error.code !== "23505") throw error;
    if (!error) {
      try {
        await sendConfirmation(application);
      } catch (e) {
        console.error("beta confirmation email failed", loggable(e));
      }
    }
  } catch (e) {
    console.error("beta application failed", loggable(e));
    return {
      status: "error",
      errors: {},
      message: "Something went wrong on our side and your application wasn't saved. Please try again in a minute.",
      values,
    };
  }

  return { status: "ok", errors: {}, message: "", values };
}
