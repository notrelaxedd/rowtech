"use server";

import { supabaseAnon } from "@/lib/supabase/anon";
import { BOATS, EMAIL, LIMITS, ROLES, type ApplyState, type Values } from "./fields";

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
 * Confirmation email to the applicant. No provider is set up yet, so this does
 * nothing; the on-page confirmation carries "what happens next" for now.
 */
async function sendConfirmation(application: Application): Promise<void> {
  // TODO: send confirmation email -- drop the provider call in here (Resend,
  // Postmark, SES...). Must never throw into the submit path: log and move on.
  void application;
}

/** The single submit path for beta applications. */
export async function submitApplication(_prev: ApplyState, fd: FormData): Promise<ApplyState> {
  const boats = [...new Set(fd.getAll("boats").filter((b): b is string => typeof b === "string"))];
  const values: Values = {
    name: text(fd, "name"),
    email: text(fd, "email"),
    organization: text(fd, "organization"),
    role: text(fd, "role"),
    location: text(fd, "location"),
    message: text(fd, "message"),
    boats,
  };

  // Honeypot: a field people never see. Bots that fill it get the success
  // screen and nothing is stored.
  if (text(fd, "website")) return { status: "ok", errors: {}, message: "", values };

  const errors: ApplyState["errors"] = {};
  if (!values.name) errors.name = "Tell us your name.";
  else if (values.name.length > LIMITS.name) errors.name = `Keep it under ${LIMITS.name} characters.`;
  if (!values.email) errors.email = "We need an email address to reply to.";
  else if (values.email.length > LIMITS.email || !EMAIL.test(values.email))
    errors.email = "That doesn't look like an email address. Check for a typo.";
  if (!values.organization) errors.organization = "Which club, school or program do you row with?";
  else if (values.organization.length > LIMITS.organization)
    errors.organization = `Keep it under ${LIMITS.organization} characters.`;
  if (values.role && !ROLES.some((r) => r.value === values.role)) errors.role = "Pick one of the options.";
  if (boats.some((b) => !(BOATS as readonly string[]).includes(b))) errors.boats = "Pick from the boats listed.";
  if (values.location && values.location.length > LIMITS.location) errors.location = `Keep it under ${LIMITS.location} characters.`;
  if (values.message && values.message.length > LIMITS.message) errors.message = `Keep it under ${LIMITS.message} characters.`;

  if (Object.keys(errors).length) {
    return { status: "error", errors, message: "A couple of things need fixing before we can send this.", values };
  }

  const application: Application = {
    name: values.name!,
    email: values.email!,
    organization: values.organization!,
    role: values.role || null,
    boat_types: boats.length ? boats : null,
    location: values.location || null,
    message: values.message || null,
    from_cta: clip(text(fd, "from").replace(/[^a-z0-9_-]/gi, ""), LIMITS.from),
    utm_source: clip(text(fd, "utm_source"), LIMITS.utm),
    utm_medium: clip(text(fd, "utm_medium"), LIMITS.utm),
    utm_campaign: clip(text(fd, "utm_campaign"), LIMITS.utm),
    utm_term: clip(text(fd, "utm_term"), LIMITS.utm),
    utm_content: clip(text(fd, "utm_content"), LIMITS.utm),
    referrer: clip(text(fd, "referrer"), LIMITS.referrer),
  };

  // Test runs (Playwright) exercise the whole path except the write.
  if (process.env.BETA_DRY_RUN === "1") return { status: "ok", errors: {}, message: "", values };

  try {
    const { error } = await supabaseAnon().from("beta_signups").insert(application);
    // 23505: this address has already applied. Treat it as success so the
    // form never reveals who has applied.
    if (error && error.code !== "23505") throw error;
    if (!error) {
      try {
        await sendConfirmation(application);
      } catch (e) {
        console.error("beta confirmation email failed", e);
      }
    }
  } catch (e) {
    console.error("beta application failed", e);
    return {
      status: "error",
      errors: {},
      message: "Something went wrong on our side and your application wasn't saved. Please try again in a minute.",
      values,
    };
  }

  return { status: "ok", errors: {}, message: "", values };
}
