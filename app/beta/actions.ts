"use server";

import { redirect } from "next/navigation";
import { supabaseAnon } from "@/lib/supabase";
import { LIMITS, ROLES, SEATS, type Field, type SignupState } from "./fields";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function text(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function submitSignup(_prev: SignupState, fd: FormData): Promise<SignupState> {
  // Honeypot: a field people never see. Bots that fill it get the thank-you
  // page and nothing is stored.
  if (text(fd, "website")) redirect("/beta/thanks");

  const values = {
    name: text(fd, "name"),
    email: text(fd, "email"),
    role: text(fd, "role"),
    organization: text(fd, "organization"),
    seats: text(fd, "seats"),
    location: text(fd, "location"),
    message: text(fd, "message"),
  } satisfies Record<Field, string>;
  const source = text(fd, "source").slice(0, LIMITS.source);

  const errors: SignupState["errors"] = {};
  if (!values.name) errors.name = "Tell us your name.";
  else if (values.name.length > LIMITS.name) errors.name = `Keep it under ${LIMITS.name} characters.`;
  if (!values.email) errors.email = "We need an email address to reply to.";
  else if (values.email.length > LIMITS.email || !EMAIL.test(values.email))
    errors.email = "That doesn't look like an email address. Check for a typo.";
  if (!ROLES.some((r) => r.value === values.role)) errors.role = "Pick the one that fits best.";
  if (values.seats && !(SEATS as readonly string[]).includes(values.seats)) errors.seats = "Pick one of the options.";
  if (values.organization.length > LIMITS.organization)
    errors.organization = `Keep it under ${LIMITS.organization} characters.`;
  if (values.location.length > LIMITS.location) errors.location = `Keep it under ${LIMITS.location} characters.`;
  if (values.message.length > LIMITS.message) errors.message = `Keep it under ${LIMITS.message} characters.`;

  if (Object.keys(errors).length) {
    return { errors, message: "A couple of things need fixing before we can send this.", values };
  }

  try {
    const { error } = await supabaseAnon()
      .from("beta_signups")
      .insert({
        name: values.name,
        email: values.email,
        role: values.role,
        organization: values.organization || null,
        seats: values.seats || null,
        location: values.location || null,
        message: values.message || null,
        source: source || null,
      });
    // 23505: this address is already on the list. Treat it as success so the
    // form never reveals who has applied.
    if (error && error.code !== "23505") throw error;
  } catch (e) {
    console.error("beta signup failed", e);
    return {
      errors: {},
      message: "Something went wrong on our side and your application wasn't saved. Please try again in a minute.",
      values,
    };
  }

  redirect("/beta/thanks");
}
