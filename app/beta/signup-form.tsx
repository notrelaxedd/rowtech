"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { readAttribution, takeCta, UTM } from "@/components/site/attribution";
import { ctaPrimary, ctaSecondary } from "@/components/site/cta";
import { ContactEmail, PolicyLinks } from "@/components/site/legal";
import { formField } from "@/components/ui/field";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { submitApplication } from "./actions";
import { BOATS, cleanFrom, EMAIL, EMPTY_STATE, LIMITS, REQUIRED, requiredError, ROLES, type ApplyState, type Field } from "./fields";

const input = cn(formField, "placeholder:text-muted-foreground");
const chip =
  "relative flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-input px-4 text-[0.9375rem] text-muted-foreground transition-colors hover:border-white/30 hover:text-foreground has-[:checked]:border-trace has-[:checked]:bg-trace/10 has-[:checked]:text-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-trace";
const label = "text-[0.9375rem] font-semibold";
const optional = <span className="font-normal text-muted-foreground">(optional)</span>;

type Required = "name" | "email" | "organization";
const isRequired = (n: string): n is Required => (REQUIRED as readonly string[]).includes(n);

const NEXT_STEPS = [
  { t: "We read your application.", d: "Every one, properly." },
  { t: "We get in touch by email.", d: "To talk through your boat, your rigging, your schedule and what you want to see." },
];

/**
 * Which link brought them here: the beta link they used on the site (its
 * data-cta, handed over by AttributionCapture), or an older /beta?from=
 * link's tag.
 * Read in the browser, so /beta itself can be one static page. The server's
 * render, and a form sent without JavaScript, say "direct".
 */
function readFrom() {
  return cleanFrom(new URLSearchParams(location.search).get("from") ?? "") || cleanFrom(takeCta()) || "direct";
}
const noSubscribe = () => () => {};

function Err({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="mt-2 text-sm text-destructive">
      {msg}
    </p>
  );
}

/**
 * "Thanks, Coach Jones.": the name as they wrote it, since a first word can
 * be a title ("Coach", "Dr."), ending in one full stop even when the name
 * ends in ".", "!" or "?".
 */
function thanks(name = "") {
  const n = name.trim().replace(/[.!?]+$/, "");
  return n ? `Thanks, ${n}.` : "Thanks.";
}

function Done({ name }: { name?: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div>
      {/* Received, not saved: said for an address that has already applied
          too, and for the bot trap, where nothing new is stored. */}
      <p className="text-sm font-semibold text-muted-foreground">Application received</p>
      <h1 ref={heading} tabIndex={-1} className="type-h2 mt-4 outline-none">
        {`${thanks(name)} We have your application.`}
      </h1>
      <p className="type-lead mt-5 text-muted-foreground">Here&rsquo;s what happens next.</p>
      <ol className="mt-8 space-y-6 border-t border-line pt-8">
        {NEXT_STEPS.map((s, i) => (
          <li key={s.t} className="grid grid-cols-[1.75rem_1fr] gap-3">
            <span className="pt-0.5 text-sm font-semibold tabular-nums text-trace">{i + 1}</span>
            <div>
              <p className="font-semibold">{s.t}</p>
              <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted-foreground">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-sm text-muted-foreground">
        No email from us yet? That&rsquo;s expected: we reply personally, not automatically. [OWNER: how soon
        applicants can expect to hear back]
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        Something to add, or a question? Write to <ContactEmail />.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className={ctaSecondary}>
          Back to the site
        </Link>
      </div>
    </div>
  );
}

export function SignupForm() {
  const from = useSyncExternalStore(noSubscribe, readFrom, () => "direct");
  // The action itself, so the form posts without JavaScript too (and before
  // it has loaded); what JavaScript adds rides along in the effects below.
  const [state, action, pending] = useActionState(submitApplication, EMPTY_STATE);

  const started = useRef(false);
  const completed = useRef(new Set<string>());
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const details = useRef<HTMLDetailsElement>(null);

  // First-touch UTM/referrer is added to what's sent, read as the form is
  // sent. Without JavaScript the form posts without it.
  useEffect(() => {
    const el = form.current;
    if (!el) return;
    const send = (ev: FormDataEvent) => {
      const a = readAttribution();
      for (const k of [...UTM, "referrer"] as const) {
        const x = a[k];
        if (x) ev.formData.set(k, x);
      }
    };
    el.addEventListener("formdata", send);
    return () => el.removeEventListener("formdata", send);
  }, []);

  const tracked = useRef(EMPTY_STATE);
  useEffect(() => {
    if (state === tracked.current) return;
    tracked.current = state;
    track("beta_form_submit", { ok: state.status === "ok", from, errors: Object.keys(state.errors).join(",") || undefined });
  }, [state, from]);

  // The required fields are checked as they're left, with the action's own
  // messages. A result from the action starts over from what it found; null
  // means checked here and fine, which clears the action's error for it.
  const typed = useRef(new Set<string>());
  const [checked, setChecked] = useState<{ for: ApplyState; errors: Partial<Record<Required, string | null>> }>({ for: state, errors: {} });
  // By the time a left field's error shows, focus is on the next one, so it's
  // also said in the live region, with the field's label. Cleared on sending:
  // the action's errors have the alert and focus.
  const [said, setSaid] = useState("");

  // A result with an error in an optional field opens the details, even ones
  // the user closed after an earlier result (the form isn't remounted).
  useEffect(() => {
    const x = state.errors;
    if (details.current && (x.role || x.boats || x.location || x.message)) details.current.open = true;
  }, [state]);

  // A result with errors takes focus to the first field to fix, or to the
  // message when no one field is at fault, rather than leaving it on the button.
  const alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.status !== "error") return;
    (form.current?.querySelector<HTMLElement>("[aria-invalid=true]") ?? alert.current)?.focus();
  }, [state]);

  if (state.status === "ok") return <Done name={state.values.name} />;

  const here = checked.for === state ? checked.errors : {};
  const e: ApplyState["errors"] = { ...state.errors };
  for (const f of REQUIRED.filter(isRequired)) if (f in here) e[f] = here[f] ?? undefined;
  const v = state.values;
  const invalid = (f: Field) => (e[f] ? true : undefined);
  const describe = (f: Field) => (e[f] ? `${f}-error` : undefined);
  const check = (f: Required, value: string) =>
    setChecked((c) => ({ for: state, errors: { ...(c.for === state ? c.errors : {}), [f]: requiredError(f, value) ?? null } }));

  // Progressive disclosure: the optional details open by themselves once the
  // three required fields hold something plausible.
  const checkRequired = () => {
    const el = form.current;
    if (!el || open) return;
    const val = (n: string) => ((el.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "").trim();
    if (REQUIRED.every((f) => val(f)) && EMAIL.test(val("email"))) setOpen(true);
  };

  return (
    <>
    <h1 className="type-h2">Apply for the beta.</h1>
    <p className="type-lead mt-5 text-muted-foreground">
      Three fields are required: your name, email and program. Tell us more about your boats if you like.
    </p>
    {/* Outside the form: a busy region's announcements can wait until it isn't. */}
    <p aria-live="polite" className="sr-only">
      {pending ? "Sending your application…" : said}
    </p>
    {/* React resets the form once the action returns. By then each field's
        default is what was sent (state.values), so the reset keeps what
        people typed, without remounting the form. */}
    <form
      ref={form}
      action={action}
      noValidate
      aria-busy={pending}
      className="mt-10 space-y-7"
      // The button stays focusable while sending (aria-disabled, not
      // disabled), so this is what stops a second send.
      onSubmit={(ev) => {
        if (pending) ev.preventDefault();
        else setSaid("");
      }}
      onFocus={() => {
        if (started.current) return;
        started.current = true;
        track("beta_form_start", { from });
      }}
      onBlur={(ev) => {
        const t = ev.target;
        if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) return;
        // Tabbing past an empty field doesn't count as getting it wrong.
        if (isRequired(t.name) && (t.value.trim() || typed.current.has(t.name) || e[t.name])) {
          check(t.name, t.value);
          const msg = requiredError(t.name, t.value);
          setSaid(msg ? `${t.labels?.[0]?.textContent?.trim()}: ${msg}` : "");
        }
        if (!t.name || completed.current.has(t.name)) return;
        const done = t instanceof HTMLInputElement && (t.type === "radio" || t.type === "checkbox") ? t.checked : t.value.trim() !== "";
        if (!done) return;
        completed.current.add(t.name);
        track("beta_field_complete", { field: t.name, from });
      }}
      onInput={(ev) => {
        const t = ev.target;
        if (t instanceof HTMLInputElement && isRequired(t.name)) {
          typed.current.add(t.name);
          // Once a field shows an error, it clears as soon as it's right.
          if (e[t.name]) check(t.name, t.value);
        }
        checkRequired();
      }}
    >
      {state.message && (
        <p ref={alert} role="alert" tabIndex={-1} className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-[0.9375rem] text-foreground outline-none">
          {state.message}
        </p>
      )}

      <div>
        <label htmlFor="name" className={label}>
          Name
        </label>
        <input id="name" name="name" autoComplete="name" required maxLength={LIMITS.name} defaultValue={v.name} aria-invalid={invalid("name")} aria-describedby={describe("name")} className={cn(input, "mt-2 h-12")} />
        <Err id="name-error" msg={e.name} />
      </div>

      <div>
        <label htmlFor="email" className={label}>
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={LIMITS.email} defaultValue={v.email} aria-invalid={invalid("email")} aria-describedby={describe("email")} className={cn(input, "mt-2 h-12")} />
        <Err id="email-error" msg={e.email} />
      </div>

      <div>
        <label htmlFor="organization" className={label}>
          Club, school or program
        </label>
        <input id="organization" name="organization" autoComplete="organization" required maxLength={LIMITS.organization} defaultValue={v.organization} aria-invalid={invalid("organization")} aria-describedby={describe("organization")} className={cn(input, "mt-2 h-12")} />
        <Err id="organization-error" msg={e.organization} />
      </div>

      <details
        ref={details}
        open={open || Boolean(v.role || v.boats?.length || v.location || v.message || e.role || e.boats || e.location || e.message)}
        onToggle={(ev) => setOpen((ev.currentTarget as HTMLDetailsElement).open)}
        className="group rounded-lg border border-line"
      >
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace [&::-webkit-details-marker]:hidden">
          <span>
            <span className="font-semibold">Tell us about your boat</span>{" "}
            <span className="text-sm text-muted-foreground">optional, and it helps us pick crews</span>
          </span>
          <span aria-hidden className="relative size-3.5 shrink-0">
            <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-muted-foreground" />
            <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-muted-foreground transition-transform duration-200 ease-out group-open:scale-y-0" />
          </span>
        </summary>

        <div className="space-y-7 border-t border-line px-4 pt-6 pb-6">
          <fieldset aria-describedby={describe("role")}>
            <legend className={label}>I&rsquo;m a&hellip; {optional}</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ROLES.map((r) => (
                <label key={r.value} className={chip}>
                  <input type="radio" name="role" value={r.value} defaultChecked={v.role === r.value} className="sr-only" />
                  {r.label}
                </label>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              [OWNER: the age rule for applicants, for example who under 18 should ask a coach or parent to apply for them]
            </p>
            <Err id="role-error" msg={e.role} />
          </fieldset>

          <fieldset aria-describedby={describe("boats")}>
            <legend className={label}>Boats you row {optional}</legend>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {BOATS.map((b) => (
                <label key={b} className={cn(chip, "readout px-2")}>
                  <input type="checkbox" name="boats" value={b} defaultChecked={v.boats?.includes(b)} className="sr-only" />
                  {b}
                </label>
              ))}
            </div>
            <Err id="boats-error" msg={e.boats} />
          </fieldset>

          <div>
            <label htmlFor="location" className={label}>
              Where do you row? {optional}
            </label>
            <input id="location" name="location" placeholder="City, country" maxLength={LIMITS.location} defaultValue={v.location} aria-invalid={invalid("location")} aria-describedby={describe("location")} className={cn(input, "mt-2 h-12")} />
            <Err id="location-error" msg={e.location} />
          </div>

          <div>
            <label htmlFor="message" className={label}>
              What do you want to see inside your boat? {optional}
            </label>
            <textarea id="message" name="message" rows={4} maxLength={LIMITS.message} defaultValue={v.message} aria-invalid={invalid("message")} aria-describedby={describe("message")} className={cn(input, "mt-2 resize-y py-3 leading-relaxed")} />
            <Err id="message-error" msg={e.message} />
          </div>
        </div>
      </details>

      {/* Honeypot: hidden from people and assistive tech; bots fill it. Named
          like nothing a browser or password manager fills in (an address's
          "website" was), and marked for the managers to leave alone. */}
      <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
        <label htmlFor="leave_blank">Leave this blank</label>
        <input id="leave_blank" name="leave_blank" type="text" tabIndex={-1} autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore />
      </div>
      <input type="hidden" name="from" value={from} />

      <div className="flex flex-col gap-4 pt-1">
        <button type="submit" aria-disabled={pending || undefined} className={cn(ctaPrimary, "h-13 w-full px-7 text-base aria-disabled:cursor-wait aria-disabled:opacity-70 sm:w-auto sm:self-start")}>
          {pending ? (
            <>
              <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
              Sending&hellip;
            </>
          ) : (
            <>
              Apply for the beta
              <ArrowRight aria-hidden className="size-4" />
            </>
          )}
        </button>
        <p className="text-sm text-muted-foreground">
          We use this to talk to you about the beta, and we note which link brought you here. <PolicyLinks />
        </p>
      </div>
    </form>
    </>
  );
}
